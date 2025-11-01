const createAuthClient = require('../utils/createAuthClient');
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants'); // [BARU]

const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, category, month, year, account_id } = req.query; // [TAMBAH] account_id
    const supabaseAuth = createAuthClient(req.token);

    const effectiveLimit = Math.min(parseInt(limit) || 50, 100);
    const effectivePage = parseInt(page) || 1;
    const startIndex = (effectivePage - 1) * effectiveLimit;

    let query = supabaseAuth
      .from('transactions')
      .select('*, accounts!left(name, type)') // [MODIFIKASI] Join dengan tabel accounts
      // RLS akan menangani ini
      .order('date', { ascending: false })
      .range(startIndex, startIndex + effectiveLimit - 1);

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    
    // [BARU] Filter berdasarkan akun
    if (account_id) {
        query = query.or(`account_id.eq.${account_id},destination_account_id.eq.${account_id}`);
    }
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query = query.gte('date', startDate.toISOString()).lte('date', endDate.toISOString());
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: effectivePage,
          limit: effectiveLimit,
          total: count,
          totalPages: Math.ceil(count / effectiveLimit)
        }
      }
    });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const createTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    // [MODIFIKASI] Ambil account_id
    const { amount, category, description, type, date, receipt_url, account_id } = req.body;

    const { data: transaction, error } = await supabaseAuth
      .from('transactions')
      .insert([
        {
          user_id: req.user.id, // RLS Policy (WITH CHECK) akan memvalidasi ini
          amount: parseFloat(amount),
          category,
          description: description || '',
          type,
          date: date || new Date().toISOString(),
          receipt_url: receipt_url || null,
          account_id: account_id // [MODIFIKASI] Simpan account_id
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Transaction creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// === [FUNGSI BARU] ===
const createTransfer = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { from_account_id, to_account_id, amount, date, description } = req.body;
    const userId = req.user.id;
    const parsedAmount = parseFloat(amount);

    // Buat 2 transaksi dalam satu batch
    const { data, error } = await supabaseAuth
      .from('transactions')
      .insert([
        // 1. Pengeluaran dari akun asal
        {
          user_id: userId,
          amount: parsedAmount,
          category: 'Transfer', // Kategori khusus
          type: 'expense',
          description: description || 'Transfer Keluar',
          date: date,
          account_id: from_account_id,
          destination_account_id: to_account_id // Tautkan ke tujuan
        },
        // 2. Pemasukan ke akun tujuan
        {
          user_id: userId,
          amount: parsedAmount,
          category: 'Transfer', // Kategori khusus
          type: 'income',
          description: description || 'Transfer Masuk',
          date: date,
          account_id: to_account_id,
          destination_account_id: from_account_id // Tautkan ke asal
        }
      ])
      .select();
    
    if (error) {
        return res.status(500).json({ success: false, error: error.message });
    }

    res.status(201).json({
        success: true,
        message: 'Transfer created successfully',
        data: data
      });

  } catch (error) {
    console.error('Transfer creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const updateTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;
    const updates = req.body;

    // [MODIFIKASI] Pastikan user_id tidak terupdate
    delete updates.user_id;

    const { data: transaction, error } = await supabaseAuth
      .from('transactions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      // RLS akan menangani ini
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found or user not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Transaction update error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;

    const { data, error } = await supabaseAuth
      .from('transactions')
      .delete()
      .eq('id', id)
      // RLS akan menangani ini
      .select()
      .single();


    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found or user not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Transaction deletion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const resetTransactions = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);

    // RLS akan membatasi delete() hanya ke data milik user
    const { error } = await supabaseAuth
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); 

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    // [BARU] Hapus juga semua data tabungan terkait
    await supabaseAuth
      .from('savings_goals')
      .update({ current_amount: 0 });

    res.json({
      success: true,
      message: 'All transactions and savings progress have been reset.'
    });

  } catch (error) {
    console.error('Transaction reset error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// [PERBAIKAN] Modifikasi RPC 'add_to_savings' untuk menyertakan account_id
const addFundsToSavings = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    // [MODIFIKASI] Ambil account_id
    const { goal_id, amount, date, account_id } = req.body;

    // [VALIDASI] Pastikan account_id ada
    if (!account_id) {
      return res.status(400).json({ success: false, error: 'Akun sumber (account_id) harus diisi' });
    }

    // [MODIFIKASI] Panggil RPC baru (Anda harus mengupdate fungsi RPC di Supabase)
    // SQL untuk fungsi RPC baru ada di bawah
    const { error } = await supabaseAuth.rpc('add_to_savings_from_account', {
      goal_id_input: goal_id,
      amount_to_add: parseFloat(amount),
      transaction_date_input: date || new Date().toISOString().split('T')[0],
      account_id_input: account_id // [BARU]
    });

    if (error) throw error;
    res.json({ success: true, message: 'Dana berhasil ditambahkan ke tabungan' });
  } catch (error) {
    console.error('Add funds to savings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};


module.exports = {
  getAllTransactions,
  createTransaction,
  createTransfer, // [BARU]
  updateTransaction,
  deleteTransaction,
  resetTransactions,
  addFundsToSavings // [MODIFIKASI]
};