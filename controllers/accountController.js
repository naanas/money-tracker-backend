// naanas/money-tracker-backend/controllers/accountController.js
const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient'); // Impor

// [MODIFIKASI] getAccounts dengan Caching
const getAccounts = async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `accounts:${userId}`; // Kunci ini sama dengan yang di analytics

  try {
    // 1. Coba dari Cache
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json({ success: true, data: cachedData, fromCache: true });
      }
    }
    
    // 2. Query Supabase
    const supabaseAuth = createAuthClient(req.token);
    const { data: accountsWithBalance, error } = await supabaseAuth
      .rpc('get_accounts_with_balance');
    
    if (error) throw error;

    // 3. Simpan di Cache
    if (redisClient.isOpen) {
      await redisClient.set(cacheKey, accountsWithBalance, { ex: 3600 }); // 1 jam
    }

    res.json({ success: true, data: accountsWithBalance, fromCache: false });
    
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [BARU] Helper invalidation
const invalidateAccountCache = async (userId) => {
  if (redisClient.isOpen) {
    await redisClient.del(`accounts:${userId}`);
  }
};

// [MODIFIKASI] createAccount
const createAccount = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { name, type, initial_balance } = req.body;

    const { data: account, error } = await supabaseAuth
      .from('accounts')
      .insert({
        name: name.trim(),
        type,
        initial_balance: parseFloat(initial_balance) || 0,
        user_id: req.user.id
      })
      .select()
      .single();

    if (error) { /* ... (error handling) ... */
      if (error.code === '23505') { 
        return res.status(409).json({ success: false, error: 'Anda sudah punya akun dengan nama ini.' });
      }
      throw error;
    }
    
    await invalidateAccountCache(req.user.id); // Invalidate
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [MODIFIKASI] updateAccount
const updateAccount = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;
    const { name, type, initial_balance } = req.body;

    const { data: account, error } = await supabaseAuth
      .from('accounts')
      .update({
        name: name.trim(),
        type,
        initial_balance: parseFloat(initial_balance) || 0
      })
      .eq('id', id)
      .select()
      .single();

    if (error) { /* ... (error handling) ... */
         if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'Nama akun itu sudah dipakai.' });
        }
        throw error;
    }
    if (!account) {
      return res.status(404).json({ success: false, error: 'Akun tidak ditemukan' });
    }

    await invalidateAccountCache(req.user.id); // Invalidate
    res.json({ success: true, data: account });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [MODIFIKASI] deleteAccount
const deleteAccount = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;

    // ... (Cek transaksi)
    const { count, error: txError } = await supabaseAuth
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .or(`account_id.eq.${id},destination_account_id.eq.${id}`);
    if (txError) throw txError;
    if (count > 0) {
      return res.status(409).json({ success: false, error: `Tidak bisa hapus akun. Masih ada ${count} transaksi terkait.` });
    }
    
    const { data: account, error } = await supabaseAuth
      .from('accounts')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!account) {
      return res.status(404).json({ success: false, error: 'Akun tidak ditemukan' });
    }

    await invalidateAccountCache(req.user.id); // Invalidate
    res.json({ success: true, message: 'Akun berhasil dihapus' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount
};