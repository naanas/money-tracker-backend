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

// createOrUpdateBudget (Tidak berubah)
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
    
    if (existingBudget && parseFloat(amount) === 0) {
      result = await supabase
        .from('budgets')
        .delete()
        .eq('id', existingBudget.id)
        .select()
        .single();
    } else if (existingBudget) {
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
// Perilaku berbahaya telah dihapus.
// Fungsi ini sekarang HANYA menghapus budget, tidak lagi menghapus transaksi.
const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params; // ID dari budget

    const { data, error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id) // Pastikan hanya pemilik yang bisa hapus
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or user not authorized'
      });
    }

    res.json({
      success: true,
      message: `Budget pocket deleted successfully`
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