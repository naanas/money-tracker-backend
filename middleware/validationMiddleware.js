const validateTransaction = (req, res, next) => {
    const { amount, category, type } = req.body;
  
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }
  
    if (!category || typeof category !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }
  
    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "income" or "expense"'
      });
    }
  
    next();
  };
  
  const validateBudget = (req, res, next) => {
    const { amount, month, year } = req.body;
  
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }
  
    if (!month || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Valid month (1-12) is required'
      });
    }
  
    if (!year || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Valid year is required'
      });
    }
  
    next();
  };
  
  module.exports = {
    validateTransaction,
    validateBudget
  };