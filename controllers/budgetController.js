// naanas/money-tracker-backend/controllers/budgetController.js

const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient'); // <-- BARU: Impor redisClient

// [BARU] Helper untuk invalidation
const invalidateBudgetCaches = async (userId, month, year) => {
  if (!redisClient.isOpen) return;
  
  // Kunci cache yang harus dihapus adalah 'summary'
  const cacheKey = `summary:${userId}:${year}-${month}`;
  
  try {
    await redisClient.del(cacheKey);
  } catch (err) {
    console.error("Gagal menghapus cache budget (summary):", err);
  }
};

const getBudgets = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { month, year } = req.query;
    
    let query = supabaseAuth
      .from('budgets')
      .select('*');

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

const createOrUpdateBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { amount, month, year, category_name } = req.body;
    
    const finalAmount = parseFloat(amount) || 0;

    const { data: existingBudget } = await supabaseAuth
      .from('budgets')
      .select('id')
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .eq('category_name', category_name)
      .single();

    let result;
    let message = 'Budget is 0, no entry created or updated.'; 

    // [MODIFIKASI] Logika baru untuk DELETE, UPDATE, atau CREATE
    if (existingBudget && finalAmount === 0) { 
      // Kasus 1: Budget sudah ada dan di-reset ke 0 -> Hapus
      result = await supabaseAuth
        .from('budgets')
        .delete()
        .eq('id', existingBudget.id)
        .select()
        .single();
      message = 'Budget reset successfully';
    } else if (existingBudget && finalAmount > 0) {
      // Kasus 2: Budget sudah ada dan di-update
      result = await supabaseAuth
        .from('budgets')
        .update({
          amount: finalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBudget.id)
        .select()
        .single();
      message = 'Budget updated successfully';
    } else if (!existingBudget && finalAmount > 0) {
      // Kasus 3: Budget belum ada dan di-create
      result = await supabaseAuth
        .from('budgets')
        .insert([
          {
            user_id: req.user.id, 
            amount: finalAmount,
            month: parseInt(month),
            year: parseInt(year),
            category_name: category_name
          }
        ])
        .select()
        .single();
      message = 'Budget created successfully';
    } else {
      // Kasus 4: Budget belum ada dan amount-nya 0 (Tidak ada yang dilakukan)
      return res.status(200).json({
        success: true,
        message: message,
        data: null
      });
    }

    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }

    // <-- INI PERBAIKANNYA -->
    // Panggil invalidation cache setelah database berhasil diubah
    await invalidateBudgetCaches(req.user.id, parseInt(month), parseInt(year));
    // <-- AKHIR PERBAIKAN -->

    res.status(message.includes('created') ? 201 : 200).json({
      success: true,
      message: message,
      data: result.data
    });
  } catch (error) {
    console.error('Budget creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// <-- [PERBAIKAN] Fungsi deleteBudget diubah total -->
const deleteBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params; 

    // 1. Ambil data budget (termasuk month, year, user_id) SEBELUM dihapus
    const { data: budgetToDelete, error: findError } = await supabaseAuth
      .from('budgets')
      .select('id, user_id, month, year') // Ambil detail untuk invalidation
      .eq('id', id)
      .single();

    if (findError || !budgetToDelete) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or user not authorized'
      });
    }

    // 2. Lakukan proses hapus
    const { error: deleteError } = await supabaseAuth
      .from('budgets')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({ success: false, error: deleteError.message });
    }
    
    // 3. Panggil invalidation menggunakan data yang tadi diambil
    await invalidateBudgetCaches(budgetToDelete.user_id, budgetToDelete.month, budgetToDelete.year);

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
// <-- AKHIR PERBAIKAN -->

module.exports = {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget
};