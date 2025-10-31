const supabase = require('../config/database');

// getBudgets (Tidak berubah)
const getBudgets = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = supabase
      .from('budgets')
      .select('*')
      .eq('user_id', req.user.id);

    if (month && year) {
      query = query.eq('month', parseInt(month)).eq('year', parseInt(year));
    }
    const { data: budgets, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, data: budgets });
  } catch (error) {
    console.error('Budgets fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// === [FUNGSI CREATE/UPDATE DIMODIFIKASI] ===
const createOrUpdateBudget = async (req, res) => {
  try {
    const { amount, month, year, category_name } = req.body;

    const { data: existingBudget } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .eq('category_name', category_name)
      .single();

    let result;
    
    // [MODIFIKASI] Jika amount 0, kita hapus saja budgetnya
    // Ini menangani "reset value budget"
    if (existingBudget && parseFloat(amount) === 0) {
      result = await supabase
        .from('budgets')
        .delete()
        .eq('id', existingBudget.id)
        .select()
        .single();
    } else if (existingBudget) {
      // JIKA SUDAH ADA & amount > 0: UPDATE
      result = await supabase
        .from('budgets')
        .update({
          amount: parseFloat(amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBudget.id)
        .select()
        .single();
    } else if (!existingBudget && parseFloat(amount) > 0) {
      // JIKA BELUM ADA & amount > 0: INSERT
      result = await supabase
        .from('budgets')
        .insert([
          {
            user_id: req.user.id,
            amount: parseFloat(amount),
            month: parseInt(month),
            year: parseInt(year),
            category_name: category_name
          }
        ])
        .select()
        .single();
    } else {
      // Kasus: Buat budget baru dengan amount 0, tidak perlu_
      return res.status(200).json({
        success: true,
        message: 'Budget set to 0, no entry created.',
        data: null
      });
    }

    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }

    res.status(existingBudget ? 200 : 201).json({
      success: true,
      message: existingBudget ? 'Budget updated successfully' : 'Budget created successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Budget creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// === [FUNGSI DELETE DIMODIFIKASI TOTAL] ===
const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params; // ID dari budget

    // 1. Ambil detail budget untuk tahu apa yang harus dihapus
    const { data: budget, error: findError } = await supabase
      .from('budgets')
      .select('id, user_id, category_name, month, year')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (findError) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or user not authorized'
      });
    }

    // 2. Tentukan rentang tanggal
    const startDate = new Date(budget.year, budget.month - 1, 1).toISOString();
    const endDate = new Date(budget.year, budget.month, 0).toISOString();

    // 3. Hapus semua transaksi yang cocok (SESUAI PERMINTAAN)
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', req.user.id)
      .eq('category', budget.category_name)
      .gte('date', startDate)
      .lte('date', endDate);

    if (txError) {
      console.error("Transaction deletion part failed:", txError.message);
      return res.status(500).json({
        success: false,
        error: `Failed to delete related transactions: ${txError.message}`
      });
    }

    // 4. Hapus budget pocket itu sendiri
    const { error: budgetError } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (budgetError) {
      console.error("Budget deletion part failed:", budgetError.message);
      return res.status(500).json({
        success: false,
        error: `Failed to delete budget: ${budgetError.message}`
      });
    }

    res.json({
      success: true,
      message: `Budget and related transactions for '${budget.category_name}' deleted successfully`
    });

  } catch (error) {
    console.error('Budget deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
// === [AKHIR FUNGSI DELETE] ===

module.exports = {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget
};