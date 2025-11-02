const { TRANSACTION_TYPES } = require('../utils/constants');

const validateTransaction = (req, res, next) => {
    // ... (validateTransaction tidak berubah) ...
    const { amount, category, type, account_id } = req.body; // [TAMBAH] account_id
  
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

    // [BARU] Validasi account_id untuk non-transfer
    if (!account_id) {
        return res.status(400).json({
            success: false,
            error: 'Account ID is required'
        });
    }
  
    next();
  };
  
  const validateBudget = (req, res, next) => {
    // ... (validateBudget tidak berubah) ...
    const { amount, month, year, category_name } = req.body;
  
    if (amount === null || amount === undefined || isNaN(amount) || parseFloat(amount) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required (must be 0 or greater)'
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

    if (!category_name || typeof category_name !== 'string' || category_name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }
  
    next();
  };

  const validateCategory = (req, res, next) => {
    // ... (validateCategory tidak berubah) ...
    const { name, type, icon, color } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }
  
    if (!type || ![TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.EXPENSE].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "income" or "expense"'
      });
    }
  
    if (icon && typeof icon !== 'string') {
      return res.status(400).json({ success: false, error: 'Icon must be a string' });
    }
  
    if (color && typeof color !== 'string') {
      return res.status(400).json({ success: false, error: 'Color must be a string' });
    }
  
    next();
  };

  const validateSavingsGoal = (req, res, next) => {
    // ... (validateSavingsGoal tidak berubah) ...
    const { name, target_amount, target_date } = req.body; 

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nama tabungan harus diisi'
      });
    }
    
    const parsedAmount = parseFloat(target_amount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) { 
      return res.status(400).json({
        success: false,
        error: 'Target jumlah harus angka positif'
      });
    }

    if (target_date) {
      const dateOnly = new Date(target_date).toISOString().split('T')[0];
      const todayOnly = new Date().toISOString().split('T')[0];
      
      if (new Date(dateOnly) < new Date(todayOnly)) {
        return res.status(400).json({
          success: false,
          error: 'Tanggal target tidak boleh di masa lalu'
        });
      }
    }
    
    next();
  };

  const validateSavingsAddFunds = (req, res, next) => {
    // ... (validateSavingsAddFunds tidak berubah) ...
    const { goal_id, amount } = req.body;

    if (!goal_id) {
      return res.status(400).json({
        success: false,
        error: 'Goal ID harus diisi'
      });
    }
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Jumlah harus angka positif'
      });
    }
    
    next();
  };

  // === [FUNGSI BARU] ===
  const validateAccount = (req, res, next) => {
    const { name, type, initial_balance } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Nama akun harus diisi' });
    }
    if (!type || !['Bank', 'E-Wallet', 'Tunai', 'Lainnya'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Tipe akun tidak valid' });
    }
    if (initial_balance === null || initial_balance === undefined || isNaN(initial_balance)) {
      return res.status(400).json({ success: false, error: 'Initial balance harus angka (boleh 0)' });
    }
    next();
  };

  const validateTransfer = (req, res, next) => {
    const { from_account_id, to_account_id, amount, date } = req.body;

    if (!from_account_id || !to_account_id) {
        return res.status(400).json({ success: false, error: 'Akun asal dan tujuan harus diisi' });
    }
    if (from_account_id === to_account_id) {
        return res.status(400).json({ success: false, error: 'Akun asal dan tujuan tidak boleh sama' });
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Jumlah harus angka positif' });
    }
     if (!date) {
        return res.status(400).json({ success: false, error: 'Tanggal harus diisi' });
    }
    next();
  };
  
  module.exports = {
      validateTransaction,
      validateBudget,
      validateCategory,
      validateSavingsGoal,      
      validateSavingsAddFunds,
      validateAccount, // [BARU]
      validateTransfer // [BARU]
    };