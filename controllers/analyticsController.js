// naanas/money-tracker-backend/money-tracker-backend-6b4b299fa281a79b543fdf06b86981328b3f1877/controllers/analyticsController.js

const supabase = require('../config/database');
const createAuthClient = require('../utils/createAuthClient'); 
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants');

// [FUNGSI DIMODIFIKASI]
const getAccountBalances = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    
    // === [PERUBAHAN DI SINI] ===
    // Hapus logika kalkulasi manual, panggil view
    const { data: accounts, error } = await supabaseAuth
      .from('accounts_with_balances')
      .select('id, name, type, initial_balance, current_balance');
    
    if (error) throw error;

    res.json({ success: true, data: accounts });
    // === [AKHIR PERUBAHAN] ===
    
  } catch (error) {
    console.error('Get account balances error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};


// [MODIFIKASI] getMonthlySummary
// (Fungsi ini tidak perlu diubah, karena sudah benar mengambil data dari 'accounts'
// dan 'transactions' secara terpisah untuk logika saldo awal)
const getMonthlySummary = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { month, year } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    const { data: transactions, error } = await supabaseAuth
      .from('transactions')
      .select('*')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) throw error;

    // 1. Ambil saldo awal dari akun yang dibuat PADA BULAN INI
    const { data: newAccounts, error: newAccountsError } = await supabaseAuth
      .from('accounts')
      .select('initial_balance')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
      
    if (newAccountsError) throw newAccountsError;

    // 2. Hitung total saldo awal dari akun baru tersebut
    const totalInitialBalanceFromNewAccounts = newAccounts
      .reduce((sum, acc) => sum + parseFloat(acc.initial_balance), 0);

    // === [Blok Kalkulasi] ===
    const regularTransactions = transactions.filter(
      (t) => t.category !== SAVINGS_CATEGORY_NAME && t.category !== 'Transfer' 
    );
    const savingsTransactions = transactions.filter(
      (t) => t.category === SAVINGS_CATEGORY_NAME
    );

    const totalIncomeFromTransactions = regularTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
    const totalIncome = totalIncomeFromTransactions + totalInitialBalanceFromNewAccounts;

    const totalExpenses = regularTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const balance = totalIncome - totalExpenses;

    const expensesByCategory = regularTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, transaction) => {
        const category = transaction.category;
        acc[category] = (acc[category] || 0) + parseFloat(transaction.amount);
        return acc;
      }, {});

    const totalTransferredToSavings = savingsTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    // === [AKHIR BLOK KALKULASI] ===


    // === [Blok Budget] ===
    const { data: budgetDetails, error: budgetError } = await supabaseAuth 
      .from('budgets')
      .select('id, category_name, amount') 
      .eq('month', parseInt(currentMonth))
      .eq('year', parseInt(currentYear))
      .neq('category_name', SAVINGS_CATEGORY_NAME); 

    if (budgetError) throw budgetError;

    const totalBudget = budgetDetails
      ? budgetDetails.reduce((sum, b) => sum + parseFloat(b.amount), 0)
      : 0;
    // === [AKHIR BLOK BUDGET] ===

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
          total_transferred_to_savings: totalTransferredToSavings,
          transaction_count: regularTransactions.length, 
          income_count: regularTransactions.filter(t => t.type === 'income').length,
          expense_count: regularTransactions.filter(t => t.type === 'expense').length
        },
        budget: {
          total_amount: totalBudget, 
          spent: totalExpenses,
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

// === [FUNGSI BARU] ===
const getTrends = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    
    // Ambil data 6 bulan terakhir
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    
    const { data, error } = await supabaseAuth
        .from('transactions')
        .select('date, amount, type, category')
        .gte('date', sixMonthsAgo.toISOString().split('T')[0])
        // Kecualikan kategori internal
        .neq('category', SAVINGS_CATEGORY_NAME) 
        .neq('category', 'Transfer'); 
        
    if (error) throw error;
    
    // Proses data di server
    const trends = {}; // { 'YYYY-MM': { income: 0, expense: 0, categories: {} } }
    
    for (const t of data) {
        const date = new Date(t.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!trends[key]) {
            trends[key] = { income: 0, expense: 0, categories: {} };
        }
        
        if (t.type === 'income') {
            trends[key].income += parseFloat(t.amount);
        } else if (t.type === 'expense') {
            trends[key].expense += parseFloat(t.amount);
            
            const category = t.category;
            trends[key].categories[category] = (trends[key].categories[category] || 0) + parseFloat(t.amount);
        }
    }
    
    // Pastikan 6 bulan ada semua datanya (termasuk yang 0)
    const finalData = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        
        if (trends[key]) {
            finalData.push({ label, ...trends[key] });
        } else {
            finalData.push({ label, income: 0, expense: 0, categories: {} });
        }
    }

    res.json({ success: true, data: finalData });
    
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getMonthlySummary,
  getAccountBalances, 
  getTrends           
};