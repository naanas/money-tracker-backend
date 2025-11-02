// naanas/money-tracker-backend/money-tracker-backend-6b4b299fa281a79b543fdf06b86981328b3f1877/controllers/accountController.js

const createAuthClient = require('../utils/createAuthClient');
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants');

// @desc    Get all accounts for a user
// @route   GET /api/accounts
const getAccounts = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    
    // === [PERUBAHAN DI SINI] ===
    // Kita tidak lagi fetch 'transactions' dan menghitung manual.
    // Kita langsung select dari 'view' yang sudah kita buat di SQL.
    
    const { data: accountsWithBalance, error } = await supabaseAuth
      .from('accounts_with_balances') // <-- Memanggil view, bukan tabel
      .select('id, name, type, initial_balance, current_balance') // <-- current_balance sudah dihitung
      .order('name');
    
    if (error) throw error;

    res.json({ success: true, data: accountsWithBalance });
    // === [AKHIR PERUBAHAN] ===
    
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// @desc    Create a new account
// @route   POST /api/accounts
const createAccount = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { name, type, initial_balance } = req.body;

    const { data: account, error } = await supabaseAuth
      .from('accounts') // <-- create tetap di tabel 'accounts'
      .insert({
        name: name.trim(),
        type,
        initial_balance: parseFloat(initial_balance) || 0,
        user_id: req.user.id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ success: false, error: 'Anda sudah punya akun dengan nama ini.' });
      }
      throw error;
    }
    
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// @desc    Update an account
// @route   PUT /api/accounts/:id
const updateAccount = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;
    const { name, type, initial_balance } = req.body;

    const { data: account, error } = await supabaseAuth
      .from('accounts') // <-- update tetap di tabel 'accounts'
      .update({
        name: name.trim(),
        type,
        initial_balance: parseFloat(initial_balance) || 0
      })
      .eq('id', id) // RLS handles user_id
      .select()
      .single();

    if (error) {
         if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'Nama akun itu sudah dipakai.' });
        }
        throw error;
    }

    if (!account) {
      return res.status(404).json({ success: false, error: 'Akun tidak ditemukan' });
    }

    res.json({ success: true, data: account });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// @desc    Delete an account
// @route   DELETE /api/accounts/:id
const deleteAccount = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;

    // Cek apakah akun masih dipakai di transaksi
    const { count, error: txError } = await supabaseAuth
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .or(`account_id.eq.${id},destination_account_id.eq.${id}`);

    if (txError) throw txError;
    
    if (count > 0) {
      return res.status(409).json({ success: false, error: `Tidak bisa hapus akun. Masih ada ${count} transaksi terkait.` });
    }
    
    // Hapus akun
    const { data: account, error } = await supabaseAuth
      .from('accounts') // <-- delete tetap di tabel 'accounts'
      .delete()
      .eq('id', id) // RLS handles user_id
      .select()
      .single();

    if (error) throw error;

    if (!account) {
      return res.status(404).json({ success: false, error: 'Akun tidak ditemukan' });
    }

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