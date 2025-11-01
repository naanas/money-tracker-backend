const express = require('express');
const {
  getSavingsGoals,
  createSavingsGoal,
  addFundsToSavings,
  deleteSavingsGoal
} = require('../controllers/savingsController');
const { authenticateUser } = require('../middleware/authMiddleware');
// [MODIFIKASI] Ubah validator
const { 
  validateSavingsGoal, 
  validateSavingsAddFunds 
} = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);
router.get('/', getSavingsGoals);
router.post('/', validateSavingsGoal, createSavingsGoal);
// [MODIFIKASI] Pastikan validateSavingsAddFunds mengizinkan field baru (atau hapus jika validasi account_id ada di controller)
// Kita akan mengandalkan validasi di controller
router.post('/add', validateSavingsAddFunds, addFundsToSavings);
router.delete('/:id', deleteSavingsGoal);

module.exports = router;