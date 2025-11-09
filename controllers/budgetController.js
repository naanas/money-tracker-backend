// naanas/money-tracker-backend/controllers/budgetController.js

const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient');

// Helper untuk menghapus cache summary saat budget berubah
const invalidateBudgetCaches = async (userId, month, year) => {
  if (!redisClient.isOpen) return;
  const cacheKey = `summary:${userId}:${year}-${month}`;
  try {
    await redisClient.del(cacheKey);
  } catch (err) {
    console.error("Gagal menghapus cache budget:", err);
  }
};

// GET Budgets
const getBudgets = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { month, year } = req.query;
    
    let query = supabaseAuth.from('budgets').select('*');
    if (month && year) {
      query = query.eq('month', parseInt(month)).eq('year', parseInt(year));
    }
    
    const { data: budgets, error } = await query;
    if (error) throw error;
    
    res.json({ success: true, data: budgets });
  } catch (error) {
    console.error('Budgets fetch error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// === [ANTI RIBET - NUCLEAR OPTION] ===
// Hapus dulu semua yang cocok, baru buat lagi kalau perlu.
const createOrUpdateBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { amount, month, year, category_name } = req.body;
    const userId = req.user.id;
    const finalAmount = parseFloat(amount) || 0;

    // 1. LANGKAH NUKLIR: Hapus SEMUA budget yang cocok untuk user, bulan, tahun, dan kategori ini.
    // Ini akan membersihkan jika ada 1, 2, atau 10 data duplikat sekalipun.
    const { error: deleteError } = await supabaseAuth
      .from('budgets')
      .delete()
      .match({
         user_id: userId,
         month: parseInt(month),
         year: parseInt(year),
         category_name: category_name
      });

    if (deleteError) throw deleteError;

    // 2. Jika amount > 0, buat entry baru yang bersih.
    let newData = null;
    let message = 'Budget direset ke 0';

    if (finalAmount > 0) {
        const { data: insertData, error: insertError } = await supabaseAuth
        .from('budgets')
        .insert([{
            user_id: userId,
            amount: finalAmount,
            month: parseInt(month),
            year: parseInt(year),
            category_name: category_name
        }])
        .select()
        .single();

        if (insertError) throw insertError;
        newData = insertData;
        message = 'Budget berhasil disimpan';
    }

    // 3. Bersihkan cache agar dashboard update
    await invalidateBudgetCaches(userId, parseInt(month), parseInt(year));

    res.json({ success: true, message, data: newData });

  } catch (error) {
    console.error('Budget upsert error FATAL:', error.message);
    // Kembalikan error aslinya biar ketahuan di frontend kalau masih gagal
    res.status(500).json({ success: false, error: error.message || 'Terjadi kesalahan server' });
  }
};

// Delete Budget (via ID)
const deleteBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params; 

    // Ambil data dulu untuk invalidasi cache
    const { data: budget } = await supabaseAuth
      .from('budgets')
      .select('user_id, month, year')
      .eq('id', id)
      .single();

    const { error } = await supabaseAuth.from('budgets').delete().eq('id', id);
    if (error) throw error;
    
    if (budget) {
        await invalidateBudgetCaches(budget.user_id, budget.month, budget.year);
    }

    res.json({ success: true, message: 'Budget berhasil dihapus' });
  } catch (error) {
    console.error('Budget deletion error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget
};