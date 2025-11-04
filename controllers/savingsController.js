// naanas/money-tracker-backend/controllers/savingsController.js
const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient'); // Impor

// [MODIFIKASI] getSavingsGoals
const getSavingsGoals = async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `savings:${userId}`;
  const CACHE_TTL = 3600; // 1 jam

  try {
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        // [PERBAIKAN] Tambahkan JSON.parse
        return res.json({ success: true, data: JSON.parse(cachedData), fromCache: true });
      }
    }

    const supabaseAuth = createAuthClient(req.token);
    let query = supabaseAuth
      .from('savings_goals')
      .select('*')
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    if (redisClient.isOpen) {
      // [PERBAIKAN] Tambahkan JSON.stringify
      await redisClient.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    }

    res.json({ success: true, data, fromCache: false });
  } catch (error) {
    console.error('Get savings goals error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [BARU] Helper invalidation
const invalidateSavingsCache = async (userId) => {
  if (redisClient.isOpen) {
    // Menghapus dana tabungan juga memengaruhi saldo akun & summary
    await redisClient.del([`savings:${userId}`, `accounts:${userId}`, `trends:${userId}`]);
    
    // Hapus semua cache summary
    const summaryKeys = await redisClient.keys(`summary:${userId}:*`);
    if(summaryKeys.length > 0) {
        await redisClient.del(summaryKeys);
    }
  }
};


// [MODIFIKASI] createSavingsGoal
const createSavingsGoal = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { name, target_amount, target_date } = req.body; 

    const { data, error } = await supabaseAuth
      .from('savings_goals')
      .insert({
        user_id: req.user.id, 
        name: name,
        target_amount: parseFloat(target_amount),
        target_date: target_date || null 
      })
      .select()
      .single();

    if (error) throw error;
    
    await invalidateSavingsCache(req.user.id); // Invalidate
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Create savings goal error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [MODIFIKASI] addFundsToSavings (Ini sudah di transactionController, tapi kita buat invalidation di sini juga)
// CATATAN: Fungsi ini sebenarnya ada di transactionController.js dan sudah di-patch.
// Kita biarkan fungsi di sini (jika dipanggil) tetap aman.
const addFundsToSavings = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { goal_id, amount, date } = req.body;

    const { error } = await supabaseAuth.rpc('add_to_savings', {
      goal_id: goal_id,
      amount_to_add: parseFloat(amount),
      transaction_date: date || new Date().toISOString().split('T')[0]
    });

    if (error) throw error;
    
    await invalidateSavingsCache(req.user.id); // Invalidate
    res.json({ success: true, message: 'Dana berhasil ditambahkan ke tabungan' });
  } catch (error) {
    console.error('Add funds to savings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [MODIFIKASI] deleteSavingsGoal
const deleteSavingsGoal = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { id } = req.params;

    const { data, error } = await supabaseAuth
      .from('savings_goals')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Target tabungan tidak ditemukan' });
    }

    await invalidateSavingsCache(req.user.id); // Invalidate
    res.json({ success: true, message: 'Target tabungan dihapus' });
  } catch (error) {
    console.error('Delete savings goal error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getSavingsGoals,
  createSavingsGoal,
  addFundsToSavings,
  deleteSavingsGoal
};