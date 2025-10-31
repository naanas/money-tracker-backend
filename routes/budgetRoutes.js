const express = require('express');
// [BARU] Impor deleteBudget
const { 
  getBudgets, 
  createOrUpdateBudget, 
  deleteBudget 
} = require('../controllers/budgetController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateBudget } = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/', getBudgets);
router.post('/', validateBudget, createOrUpdateBudget);

// === [RUTE BARU DITAMBAHKAN] ===
// :id adalah parameter URL (misal: /api/budgets/uuid-abc-123)
router.delete('/:id', deleteBudget);
// === [AKHIR RUTE BARU] ===

module.exports = router;