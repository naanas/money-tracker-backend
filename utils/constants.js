const TRANSACTION_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense'
  };
  
  const SUBSCRIPTION_TIERS = {
    FREE: 'free',
    PREMIUM: 'premium'
  };
  
  const DEFAULT_CATEGORIES = [
    // Expense categories
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Other Expenses',
    // Income categories  
    'Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'
  ];
  
  const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100
  };
  
  module.exports = {
    TRANSACTION_TYPES,
    SUBSCRIPTION_TIERS,
    DEFAULT_CATEGORIES,
    PAGINATION
  };