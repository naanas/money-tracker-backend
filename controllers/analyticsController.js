const supabase = require('../config/database');

const getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    // Get transactions
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

    // Calculate analytics
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const balance = totalIncome - totalExpenses;

    // Expenses by category
    const expensesByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, transaction) => {
        const category = transaction.category;
        acc[category] = (acc[category] || 0) + parseFloat(transaction.amount);
        return acc;
      }, {});

    // Get budget
    const { data: budget } = await supabase
      .from('budgets')
      .select('amount')
      .eq('user_id', req.user.id)
      .eq('month', parseInt(currentMonth))
      .eq('year', parseInt(currentYear))
      .single();

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
          transaction_count: transactions.length,
          income_count: transactions.filter(t => t.type === 'income').length,
          expense_count: transactions.filter(t => t.type === 'expense').length
        },
        budget: {
          amount: budget?.amount || 0,
          spent: totalExpenses,
          remaining: (budget?.amount || 0) - totalExpenses
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