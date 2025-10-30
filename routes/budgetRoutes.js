const express = require('express');
const { getBudgets, createOrUpdateBudget } = require('../controllers/budgetController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateBudget } = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/', getBudgets);
router.post('/', validateBudget, createOrUpdateBudget);

module.exports = router;