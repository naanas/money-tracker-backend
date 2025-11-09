// naanas/money-tracker-backend/controllers/budgetController.js

const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient');

// Helper untuk menghapus cache summary saat budget berubah
const invalidateBudgetCaches = async (userId, month, year) => {
  if (!redisClient.isOpen) return;
  
  // Budget berdampak pada 'summary' bulan tersebut
  const cacheKey = `summary:${userId}:${year}-${month}`;
  
  try {
    await redisClient.del(cacheKey);
  } catch (err) {
    console.error("Gagal menghapus cache budget (summary):", err);
  }
};

// Mendapatkan semua budget (bisa difilter bulan/tahun via query)
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

// Membuat atau Memperbarui (Upsert) Budget
const createOrUpdateBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { amount, month, year, category_name } = req.body;
    
    const finalAmount = parseFloat(amount) || 0;

    // [PERBAIKAN UTAMA DI SINI]
    // Cari budget yang sudah ada. Gunakan .limit(1) alih-alih .single()
    // untuk menghindari error jika tidak sengaja ada data duplikat.
    const { data: existingBudgets, error: fetchError } = await supabaseAuth
      .from('budgets')
      .select('id')
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .eq('category_name', category_name)
      .limit(1); // Paksa cuma ambil 1

    if (fetchError) {
       console.warn('Warning fetching existing budget:', fetchError.message);
    }

    // Ambil item pertama jika array tidak kosong
    const existingBudget = existingBudgets && existingBudgets.length > 0 ? existingBudgets[0] : null;

    let result;
    let message = 'Budget is 0, no entry created or updated.'; 

    if (existingBudget && finalAmount === 0) { 
      // Kasus 1: Budget ada dan di-set ke 0 -> Hapus
      result = await supabaseAuth
        .from('budgets')
        .delete()
        .eq('id', existingBudget.id)
        .select()
        .maybeSingle();
      message = 'Budget reset successfully';
    } else if (existingBudget && finalAmount > 0) {
      // Kasus 2: Budget ada dan di-update nilainya
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
      // Kasus 3: Budget belum ada -> Buat baru
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
      // Kasus 4: Budget belum ada dan input 0 -> Tidak lakukan apa-apa
      return res.status(200).json({
        success: true,
        message: message,
        data: null
      });
    }

    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }

    // Invalidate cache agar dashboard refresh
    await invalidateBudgetCaches(req.user.id, parseInt(month), parseInt(year));

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

// Menghapus Budget
const deleteBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params; 

    // 1. Ambil data budget dulu sebelum dihapus (untuk tahu bulan/tahunnya buat cache)
    const { data: budgetToDelete, error: findError } = await supabaseAuth
      .from('budgets')
      .select('id, user_id, month, year')
      .eq('id', id)
      .single();

    if (findError || !budgetToDelete) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or user not authorized'
      });
    }

    // 2. Hapus data
    const { error: deleteError } = await supabaseAuth
      .from('budgets')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({ success: false, error: deleteError.message });
    }
    
    // 3. Bersihkan cache terkait
    await invalidateBudgetCaches(budgetToDelete.user_id, budgetToDelete.month, budgetToDelete.year);

    res.json({
      success: true,
      message: 'Budget pocket deleted successfully'
    });

  } catch (error) {
    console.error('Budget deletion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget
};