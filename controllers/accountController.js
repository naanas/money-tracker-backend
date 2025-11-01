const createAuthClient = require('../utils/createAuthClient');
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants');

// @desc    Get all accounts for a user
// @route   GET /api/accounts
const getAccounts = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    
    // 1. Ambil semua akun (RLS handles user_id)
    const { data: accounts, error: accountsError } = await supabaseAuth
      .from('accounts')
      .select('id, name, type, initial_balance')
      .order('name');
    
    if (accountsError) throw accountsError;

    // 2. Ambil semua transaksi untuk kalkulasi saldo
    const { data: transactions, error: txError } = await supabaseAuth
      .from('transactions')
      .select('amount, type, account_id, destination_account_id');
      
    if (txError) throw txError;

    // 3. Kalkulasi saldo di server
    const accountsWithBalance = accounts.map(acc => {
        let balance = parseFloat(acc.initial_balance);
        
        const relevantTransactions = transactions.filter(
            t => t.account_id === acc.id || t.destination_account_id === acc.id
        );
        
        for (const t of relevantTransactions) {
            const amount = parseFloat(t.amount);
            if (t.account_id === acc.id) {
                if (t.type === 'income') balance += amount;
                if (t.type === 'expense') balance -= amount;
            } else if (t.destination_account_id === acc.id && t.type === 'income') {
                // Ini adalah transfer masuk, tapi sudah dihitung di 'income' t.account_id
                // Kita harus pastikan tidak double count.
                // Logika sederhana: expense dari A, income ke B.
                // Jadi, filter di atas sudah cukup.
            }
        }
        
        return {
            ...acc,
            current_balance: balance
        };
    });

    res.json({ success: true, data: accountsWithBalance });
    
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
      .from('accounts')
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
      .from('accounts')
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
      .from('accounts')
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