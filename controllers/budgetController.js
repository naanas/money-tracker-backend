// naanas/money-tracker-backend/controllers/budgetController.js

const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient');

// Helper untuk invalidasi cache
const invalidateBudgetCaches = async (userId, month, year) => {
  if (!redisClient.isOpen) return;
  const cacheKey = `summary:${userId}:${year}-${month}`;
  try {
    await redisClient.del(cacheKey);
  } catch (err) {
    console.error("Gagal menghapus cache budget:", err);
  }
};

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

const createOrUpdateBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { amount, month, year, category_name } = req.body;
    const userId = req.user.id;
    const finalAmount = parseFloat(amount) || 0;

    // 1. Hapus SEMUA yang cocok (membersihkan duplikat jika ada)
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

    // 2. Buat baru jika amount > 0
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

    await invalidateBudgetCaches(userId, parseInt(month), parseInt(year));
    res.json({ success: true, message, data: newData });

  } catch (error) {
    console.error('Budget upsert error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// === [PERBAIKAN TOTAL PADA DELETE] ===
const deleteBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params; 

    // 1. Cari tahu dulu budget ini milik kategori/bulan/tahun apa
    // Kita pakai .limit(1) biar nggak error kalau ID-nya aneh, meski seharusnya ID unik.
    const { data: targetBudgets, error: findError } = await supabaseAuth
      .from('budgets')
      .select('user_id, month, year, category_name')
      .eq('id', id)
      .limit(1);

    if (findError || !targetBudgets || targetBudgets.length === 0) {
      return res.status(404).json({ success: false, error: 'Budget tidak ditemukan' });
    }

    const target = targetBudgets[0];

    // 2. HAPUS TOTAL berdasarkan Kategori + Bulan + Tahun + User
    // Ini akan menghapus item yang dimaksud DAN kembarannya jika ada.
    const { error: deleteError } = await supabaseAuth
      .from('budgets')
      .delete()
      .match({
        user_id: target.user_id,
        month: target.month,
        year: target.year,
        category_name: target.category_name
      });

    if (deleteError) throw deleteError;
    
    // 3. Bersihkan cache
    await invalidateBudgetCaches(target.user_id, target.month, target.year);

    res.json({ success: true, message: 'Budget berhasil dihapus total' });
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