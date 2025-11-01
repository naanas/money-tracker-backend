const supabase = require('../config/database');
// [PERBAIKAN] Impor konstanta
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants');

const getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    // Get transactions (Tidak berubah)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // === [BLOK PERBAIKAN: Pisahkan transaksi reguler dari tabungan] ===
    const regularTransactions = transactions.filter(
      (t) => t.category !== SAVINGS_CATEGORY_NAME
    );
    const savingsTransactions = transactions.filter(
      (t) => t.category === SAVINGS_CATEGORY_NAME
    );

    // Calculate analytics (Hanya menggunakan transaksi reguler)
    const totalIncome = regularTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalExpenses = regularTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const balance = totalIncome - totalExpenses;

    // Pengeluaran per kategori (Juga tidak termasuk tabungan)
    const expensesByCategory = regularTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, transaction) => {
        const category = transaction.category;
        acc[category] = (acc[category] || 0) + parseFloat(transaction.amount);
        return acc;
      }, {});

    // [BARU] Hitung total yang ditransfer ke tabungan bulan ini
    const totalTransferredToSavings = savingsTransactions
      .filter(t => t.type === 'expense') // Seharusnya 'expense'
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    // === [AKHIR BLOK PERBAIKAN] ===

    // === [BLOK BUDGET DIMODIFIKASI] ===
    const { data: budgetDetails, error: budgetError } = await supabase
      .from('budgets')
      .select('id, category_name, amount')
      .eq('user_id', req.user.id)
      .eq('month', parseInt(currentMonth))
      .eq('year', parseInt(currentYear))
      // [PERBAIKAN] Jangan ikutkan budget 'Tabungan' dalam total budget
      .neq('category_name', SAVINGS_CATEGORY_NAME); 

    if (budgetError) {
      return res.status(500).json({
        success: false,
        error: budgetError.message
      });
    }

    const totalBudget = budgetDetails
      ? budgetDetails.reduce((sum, b) => sum + parseFloat(b.amount), 0)
      : 0;
    
    // === [AKHIR MODIFIKASI BLOK BUDGET] ===

    res.json({
      success: true,
      data: {
        period: {
          month: parseInt(currentMonth),
          year: parseInt(currentYear)
        },
        summary: {
          total_income: totalIncome,
          total_expenses: totalExpenses,
          balance: balance,
          // [BARU] Kirim data tabungan ke frontend
          total_transferred_to_savings: totalTransferredToSavings,
          // Hitung transaksi reguler saja
          transaction_count: regularTransactions.length, 
          income_count: regularTransactions.filter(t => t.type === 'income').length,
          expense_count: regularTransactions.filter(t => t.type === 'expense').length
        },
        budget: {
          total_amount: totalBudget, 
          spent: totalExpenses, // Total pengeluaran (tanpa tabungan)
          remaining: totalBudget - totalExpenses,
          details: budgetDetails || [] 
        },
        expenses_by_category: expensesByCategory
      }
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getMonthlySummary
};