const createAuthClient = require('../utils/createAuthClient');
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants'); 
const redisClient = require('../config/redisClient');

// [HELPER] Invalidation Cache
const invalidateTransactionCaches = async (userId, transactionDate) => {
  if (!redisClient.isOpen) return;
  
  const date = new Date(transactionDate);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const keysToDel = [
    `accounts:${userId}`,
    `trends:${userId}`,
    `summary:${userId}:${year}-${month}`,
    `savings:${userId}` 
  ];
  
  if (date.getDate() < 3) {
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevYear = prevMonthDate.getFullYear();
    keysToDel.push(`summary:${userId}:${prevYear}-${prevMonth}`);
  }
  
  try {
    if (keysToDel.length > 0) await redisClient.del(keysToDel);
    
    // Scan & delete transaction lists
    const transactionKeys = await redisClient.keys(`transactions:${userId}:*`);
    if (transactionKeys.length > 0) await redisClient.del(transactionKeys);
  } catch (err) {
    console.error("Gagal menghapus cache:", err);
  }
};

const getAllTransactions = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 50, type, category, month, year, account_id } = req.query; 

  const queryParams = [page, limit, type, category, month, year, account_id].join('-');
  const cacheKey = `transactions:${userId}:${queryParams}`;
  const CACHE_TTL_LIST = 600; 

  try {
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json({ success: true, data: JSON.parse(cachedData), fromCache: true });
      }
    }

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
    if (account_id) query = query.or(`account_id.eq.${account_id},destination_account_id.eq.${account_id}`);
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query = query.gte('date', startDate.toISOString()).lte('date', endDate.toISOString());
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
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
    
    if (redisClient.isOpen) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: CACHE_TTL_LIST });
    }

    res.json({ success: true, data: responseData, fromCache: false });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const createTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { amount, category, description, type, date, receipt_url, account_id } = req.body;
    const transactionDate = date || new Date().toISOString();

    const { data: transaction, error } = await supabaseAuth
      .from('transactions')
      .insert([{
          user_id: req.user.id, 
          amount: parseFloat(amount),
          category,
          description: description || '',
          type,
          date: transactionDate,
          receipt_url: receipt_url || null,
          account_id: account_id 
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    
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
    
    if (error) return res.status(500).json({ success: false, error: error.message });

    await invalidateTransactionCaches(userId, transactionDate);

    res.status(201).json({ success: true, message: 'Transfer created successfully', data: data });
  } catch (error) {
    console.error('Transfer creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// [PERBAIKAN] updateTransaction
// Hapus logika manual saldo karena Trigger Database sudah mengurusnya otomatis
const updateTransaction = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;
    
    // 1. Ambil HANYA field yang diizinkan (Whitelist)
    const { 
      amount, 
      category, 
      description, 
      type, 
      date, 
      receipt_url, 
      account_id 
    } = req.body;

    // 2. Validasi Angka
    if (amount !== undefined && isNaN(parseFloat(amount))) {
       return res.status(400).json({ success: false, error: 'Amount harus berupa angka' });
    }

    // 3. Susun objek update yang bersih
    const updates = {};
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (date !== undefined) updates.date = date;
    if (receipt_url !== undefined) updates.receipt_url = receipt_url;
    if (account_id !== undefined) updates.account_id = account_id;
    
    updates.updated_at = new Date().toISOString();

    // 4. Ambil tanggal lama (untuk invalidasi cache)
    const { data: oldTransaction, error: findError } = await supabaseAuth
      .from('transactions')
      .select('date')
      .eq('id', id)
      .single();

    if (findError) {
       return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // 5. Lakukan Update
    // Trigger di Supabase akan otomatis mendeteksi perubahan amount/type/account_id dan menyesuaikan saldo.
    const { data: transaction, error } = await supabaseAuth
      .from('transactions')
      .update(updates) 
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase Update Error:', error); 
      return res.status(500).json({ success: false, error: error.message });
    }

    // 6. Invalidate Cache
    const transactionDate = updates.date || oldTransaction.date;
    await invalidateTransactionCaches(req.user.id, transactionDate);
    
    if (oldTransaction.date && transactionDate !== oldTransaction.date) {
      await invalidateTransactionCaches(req.user.id, oldTransaction.date);
    }

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction
    });

  } catch (error) {
    console.error('Transaction update error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

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
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const { error } = await supabaseAuth
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ success: false, error: error.message });

    await invalidateTransactionCaches(req.user.id, transaction.date);

    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Transaction deletion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const resetTransactions = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const userId = req.user.id;

    const { error } = await supabaseAuth
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); 

    if (error) return res.status(500).json({ success: false, error: error.message });
    
    await supabaseAuth.from('savings_goals').update({ current_amount: 0 });

    if (redisClient.isOpen) {
        const keys = await redisClient.keys(`*:${userId}*`); 
        if (keys.length > 0) await redisClient.del(keys);
    }

    res.json({ success: true, message: 'Reset successful.' });
  } catch (error) {
    console.error('Transaction reset error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const addFundsToSavings = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { goal_id, amount, date, account_id } = req.body;
    const transactionDate = date || new Date().toISOString().split('T')[0];

    if (!account_id) return res.status(400).json({ success: false, error: 'Akun sumber wajib diisi' });

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