const express = require('express');
const {
  getSavingsGoals,
  createSavingsGoal,
  addFundsToSavings,
  deleteSavingsGoal
} = require('../controllers/savingsController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateSavingsGoal, validateSavingsAddFunds } = require('../middleware/validationMiddleware');

const router = express.Router();

// Semua rute di sini dilindungi
router.use(authenticateUser);

// GET /api/savings/
router.get('/', getSavingsGoals);

// POST /api/savings/
router.post('/', validateSavingsGoal, createSavingsGoal);

// POST /api/savings/add
router.post('/add', validateSavingsAddFunds, addFundsToSavings);

// DELETE /api/savings/:id
router.delete('/:id', deleteSavingsGoal);

module.exports = router;