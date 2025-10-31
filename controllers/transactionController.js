const supabase = require('../config/database');

const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, category, month, year } = req.query;
    
    // [MODIFIKASI] Gunakan konstanta dari file (walaupun file tidak di-pass, ini best practice)
    const effectiveLimit = Math.min(parseInt(limit) || 50, 100);
    const effectivePage = parseInt(page) || 1;
    const startIndex = (effectivePage - 1) * effectiveLimit;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('date', { ascending: false })
      .range(startIndex, startIndex + effectiveLimit - 1);

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query = query.gte('date', startDate.toISOString()).lte('date', endDate.toISOString());
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
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
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const createTransaction = async (req, res) => {
  try {
    const { amount, category, description, type, date, receipt_url } = req.body;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: req.user.id,
          amount: parseFloat(amount),
          category,
          description: description || '',
          type,
          date: date || new Date().toISOString(),
          receipt_url: receipt_url || null
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Transaction creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // [MODIFIKASI] Kueri atomik
    const { data: transaction, error } = await supabase
      .from('transactions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id) // Pastikan hanya pemilik yang bisa update
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
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
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    // [MODIFIKASI] Kueri atomik
    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id) // Pastikan hanya pemilik yang bisa hapus
      .select()
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
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
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// === [FUNGSI BARU DITAMBAHKAN] ===
const resetTransactions = async (req, res) => {
  try {
    // Hapus SEMUA transaksi yang user_id-nya cocok dengan user yang login
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      message: 'All transactions have been reset successfully.'
    });

  } catch (error) {
    console.error('Transaction reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
// === [AKHIR FUNGSI BARU] ===

module.exports = {
  getAllTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  resetTransactions // [BARU] Ekspor fungsi baru
};