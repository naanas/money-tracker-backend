// naanas/money-tracker-backend/controllers/analyticsController.js
const createAuthClient = require('../utils/createAuthClient');
const { SAVINGS_CATEGORY_NAME } = require('../utils/constants');
const redisClient = require('../config/redisClient'); 

const CACHE_TTL = 3600; // 1 jam

// [MODIFIKASI] getAccountBalances
const getAccountBalances = async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `accounts:${userId}`;

  try {
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        // [PERBAIKAN] Tambahkan JSON.parse
        return res.json({ success: true, data: JSON.parse(cachedData), fromCache: true });
      }
    }

    const supabaseAuth = createAuthClient(req.token);
    const { data: accountsWithBalance, error } = await supabaseAuth
      .rpc('get_accounts_with_balance');
    
    if (error) throw error;

    if (redisClient.isOpen) {
      // [PERBAIKAN] Tambahkan JSON.stringify
      await redisClient.set(cacheKey, JSON.stringify(accountsWithBalance), { EX: CACHE_TTL });
    }

    res.json({ success: true, data: accountsWithBalance, fromCache: false });
    
  } catch (error) {
    console.error('Get account balances error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};


// [MODIFIKASI] getMonthlySummary
const getMonthlySummary = async (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;
  const currentMonth = month || new Date().getMonth() + 1;
  const currentYear = year || new Date().getFullYear();
  
  const cacheKey = `summary:${userId}:${currentYear}-${currentMonth}`;

  try {
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        // [PERBAIKAN] Tambahkan JSON.parse
        return res.json({ success: true, data: JSON.parse(cachedData), fromCache: true });
      }
    }

    const supabaseAuth = createAuthClient(req.token);
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    const { data: transactions, error } = await supabaseAuth
      .from('transactions')
      .select('*')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) throw error;

    // ... (Blok Kalkulasi) ...
    const regularTransactions = transactions.filter(
      (t) => t.category !== SAVINGS_CATEGORY_NAME && t.category !== 'Transfer'
    );
    const savingsTransactions = transactions.filter(
      (t) => t.category === SAVINGS_CATEGORY_NAME
    );
    const totalIncome = regularTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
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
    // ... (Akhir Blok Kalkulasi)

    // ... (Blok Budget) ...
    const { data: budgetDetails, error: budgetError } = await supabaseAuth
      .from('budgets')
      .select('id, category_name, amount') 
      .eq('month', parseInt(currentMonth))
      .eq('year', parseInt(currentYear))
      .neq('category_name', SAVINGS_CATEGORY_NAME); 
    if (budgetError) throw budgetError;
    const rawTotalBudget = budgetDetails
      ? budgetDetails.reduce((sum, b) => sum + parseFloat(b.amount), 0)
      : 0;
    const totalBudget = Math.round(rawTotalBudget);
    // ... (Akhir Blok Budget)

    const responseData = {
      period: { /*...*/ },
      summary: { /*...*/ },
      budget: { /*...*/ },
      expenses_by_category: expensesByCategory
    };
     // ... (Isi responseData sama seperti sebelumnya)
     responseData.period = {
        month: parseInt(currentMonth),
        year: parseInt(currentYear)
      };
      responseData.summary = {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        balance: balance,
        total_transferred_to_savings: totalTransferredToSavings,
        transaction_count: regularTransactions.length,
        income_count: regularTransactions.filter(t => t.type === 'income').length,
        expense_count: regularTransactions.filter(t => t.type === 'expense').length
      };
      responseData.budget = {
        total_amount: totalBudget,
        spent: totalExpenses,
        remaining: totalBudget - totalExpenses,
        details: budgetDetails || []
      };

    if (redisClient.isOpen) {
      // [PERBAIKAN] Tambahkan JSON.stringify
      await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: CACHE_TTL });
    }

    res.json({
      success: true,
      data: responseData,
      fromCache: false
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// [MODIFIKASI] getTrends
const getTrends = async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `trends:${userId}`;

  try {
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        // [PERBAIKAN] Tambahkan JSON.parse
        return res.json({ success: true, data: JSON.parse(cachedData), fromCache: true });
      }
    }
    
    const supabaseAuth = createAuthClient(req.token);
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    
    const { data, error } = await supabaseAuth
        .from('transactions')
        .select('date, amount, type, category')
        .gte('date', sixMonthsAgo.toISOString().split('T')[0])
        .neq('category', SAVINGS_CATEGORY_NAME) 
        .neq('category', 'Transfer'); 
        
    if (error) throw error;
    
    // ... (Proses data) ...
    const trends = {};
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
    // ... (Akhir proses data)

    if (redisClient.isOpen) {
      // [PERBAIKAN] Tambahkan JSON.stringify
      await redisClient.set(cacheKey, JSON.stringify(finalData), { EX: 21600 });
    }

    res.json({ success: true, data: finalData, fromCache: false });
    
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