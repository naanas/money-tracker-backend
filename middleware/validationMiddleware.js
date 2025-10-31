// [BARU] Impor konstanta
const { TRANSACTION_TYPES } = require('../utils/constants');

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
  
// === [FUNGSI BARU DITAMBAHKAN] ===
const validateCategory = (req, res, next) => {
  const { name, type, icon, color } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Category name is required'
    });
  }

  // Gunakan konstanta
  if (!type || ![TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.EXPENSE].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Type must be either "income" or "expense"'
    });
  }

  // Validasi opsional untuk 'icon' dan 'color'
  if (icon && typeof icon !== 'string') {
    return res.status(400).json({ success: false, error: 'Icon must be a string' });
  }

  if (color && typeof color !== 'string') {
    return res.status(400).json({ success: false, error: 'Color must be a string' });
  }

  next();
};
// === [AKHIR FUNGSI BARU] ===

module.exports = {
    validateTransaction,
    validateBudget,
    validateCategory // [BARU] Ekspor fungsi baru
  };