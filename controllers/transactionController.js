// naanas/money-tracker-backend/controllers/transactionController.js
const createAuthClient = require('../utils/createAuthClient');
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants'); 
const redisClient = require('../config/redisClient'); // Impor klien Vercel KV

// [BARU] Fungsi helper untuk menghapus cache yang relevan
const invalidateTransactionCaches = async (userId, transactionDate) => {
  if (!redisClient.isOpen) return;
  
  const date = new Date(transactionDate);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Kunci cache yang mungkin terpengaruh oleh transaksi
  // Vercel KV bisa menghapus banyak kunci sekaligus
  const keysToDel = [
    `accounts:${userId}`,        // Saldo akun
    `trends:${userId}`,          // Tren 6 bulan
    `summary:${userId}:${year}-${month}`, // Ringkasan bulan ini
    // Kita juga hapus cache list transaksi (cara simpel)
    // Cara lebih baik adalah menghapus key spesifik, tapi ini lebih aman
  ];
  
  // Hapus juga cache bulan sebelumnya jika tanggalnya di awal bulan
  if (date.getDate() < 3) {
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevYear = prevMonthDate.getFullYear();
    keysToDel.push(`summary:${userId}:${prevYear}-${prevMonth}`);
  }
  
  try {
    // Hapus semua kunci yang relevan
    if (keysToDel.length > 0) {
      await redisClient.del(...keysToDel);
    }
    
    // Hapus juga cache `transactions` (agak boros tapi aman)
    const transactionKeys = await redisClient.keys(`transactions:${userId}:*`);
    if (transactionKeys.length > 0) {
      await redisClient.del(...transactionKeys);
    }
  } catch (err) {
    console.error("Gagal menghapus cache:", err);
  }
};

// [MODIFIKASI] getAllTransactions dengan Caching
const getAllTransactions = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 50, type, category, month, year, account_id } = req.query; 

  const queryParams = [page, limit, type, category, month, year, account_id].join('-');
  const cacheKey = `transactions:${userId}:${queryParams}`;
  const CACHE_TTL_LIST = 600; // Cache daftar transaksi selama 10 menit

  try {
    // 1. Coba ambil dari Cache
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json({ success: true, data: cachedData, fromCache: true });
      }
    }

    // 2. Jika tidak ada di cache, query Supabase
    const supabaseAuth = createAuthClient(req.token);
    const effectiveLimit = Math.min(parseInt(limit) || 50, 100);
    const effectivePage = parseInt(page) || 1;
    const startIndex = (effectivePage - 1) * effectiveLimit;

    let query = supabaseAuth
      .from('transactions')
      .select(`
        *, 
        accounts:account_id!left(name, type),
        destination_accounts:destination_account_id!left(name, type)
      `)
      .order('date', { ascending: false })
      .range(startIndex, startIndex + effectiveLimit - 1);

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
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
      console.error('Supabase query error in getAllTransactions:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    const responseData = {
      transactions,
      pagination: {
        page: effectivePage,
        limit: effectiveLimit,
        total: count,
        totalPages: Math.ceil(count / effectiveLimit)
      }
    };
    
    // 3. Simpan hasil di Cache
    if (redisClient.isOpen) {
      await redisClient.set(cacheKey, responseData, { ex: CACHE_TTL_LIST });
    }

    res.json({
      success: true,
      data: responseData,
      fromCache: false
    });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// [MODIFIKASI] createTransaction dengan Invalidation
const createTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { amount, category, description, type, date, receipt_url, account_id } = req.body;
    const transactionDate = date || new Date().toISOString();

    const { data: transaction, error } = await supabaseAuth
      .from('transactions')
      .insert([
        {
          user_id: req.user.id, 
          amount: parseFloat(amount),
          category,
          description: description || '',
          type,
          date: transactionDate,
          receipt_url: receipt_url || null,
          account_id: account_id 
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    await invalidateTransactionCaches(req.user.id, transactionDate);

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

// [MODIFIKASI] createTransfer dengan Invalidation
const createTransfer = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { from_account_id, to_account_id, amount, date, description } = req.body;
    const userId = req.user.id;
    const parsedAmount = parseFloat(amount);
    const transactionDate = date || new Date().toISOString();

    const { data, error } = await supabaseAuth
      .from('transactions')
      .insert([
        //... (insert logic)
        {
          user_id: userId,
          amount: parsedAmount,
          category: 'Transfer', 
          type: 'expense',
          description: description || 'Transfer Keluar',
          date: transactionDate,
          account_id: from_account_id,
          destination_account_id: to_account_id 
        },
        {
          user_id: userId,
          amount: parsedAmount,
          category: 'Transfer', 
          type: 'income',
          description: description || 'Transfer Masuk',
          date: transactionDate,
          account_id: to_account_id,
          destination_account_id: from_account_id 
        }
      ])
      .select();
    
    if (error) {
        return res.status(500).json({ success: false, error: error.message });
    }

    await invalidateTransactionCaches(userId, transactionDate);

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

// [MODIFIKASI] updateTransaction dengan Invalidation
const updateTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;
    const updates = req.body;
    
    delete updates.user_id;
    const transactionDate = updates.date || new Date().toISOString();

    // Ambil tanggal lama sebelum update
    const { data: oldTransaction, error: findError } = await supabaseAuth
      .from('transactions')
      .select('date')
      .eq('id', id)
      .single();
    if (findError) throw findError;

    const { data: transaction, error } = await supabaseAuth
      .from('transactions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    await invalidateTransactionCaches(req.user.id, transactionDate);
    // Hapus juga cache tanggal lama jika tanggalnya berubah
    if (oldTransaction && oldTransaction.date !== transactionDate) {
      await invalidateTransactionCaches(req.user.id, oldTransaction.date);
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

// [MODIFIKASI] deleteTransaction dengan Invalidation
const deleteTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;

    const { data: transaction, error: findError } = await supabaseAuth
      .from('transactions')
      .select('date')
      .eq('id', id)
      .single();

    if (findError || !transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found or user not authorized'
      });
    }

    const { error } = await supabaseAuth
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    await invalidateTransactionCaches(req.user.id, transaction.date);

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Transaction deletion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// [MODIFIKASI] resetTransactions dengan Invalidation
const resetTransactions = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const userId = req.user.id;

    const { error } = await supabaseAuth
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); 

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    await supabaseAuth
      .from('savings_goals')
      .update({ current_amount: 0 });

    if (redisClient.isOpen) {
        const keys = await redisClient.keys(`*:${userId}*`); // Hapus semua cache user ini
        if (keys.length > 0) {
            await redisClient.del(...keys);
        }
    }

    res.json({
      success: true,
      message: 'All transactions and savings progress have been reset.'
    });

  } catch (error) {
    console.error('Transaction reset error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// [MODIFIKASI] addFundsToSavings dengan Invalidation
const addFundsToSavings = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { goal_id, amount, date, account_id } = req.body;
    const transactionDate = date || new Date().toISOString().split('T')[0];

    if (!account_id) {
      return res.status(400).json({ success: false, error: 'Akun sumber (account_id) harus diisi' });
    }

    const { error } = await supabaseAuth.rpc('add_to_savings_from_account', {
      goal_id_input: goal_id,
      amount_to_add: parseFloat(amount),
      transaction_date_input: transactionDate,
      account_id_input: account_id 
    });

    if (error) throw error;
    
    await invalidateTransactionCaches(req.user.id, transactionDate);

    res.json({ success: true, message: 'Dana berhasil ditambahkan ke tabungan' });
  } catch (error) {
    console.error('Add funds to savings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getAllTransactions,
  createTransaction,
  createTransfer, 
  updateTransaction,
  deleteTransaction,
  resetTransactions,
  addFundsToSavings
};