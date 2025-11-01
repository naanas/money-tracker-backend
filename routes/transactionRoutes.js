const express = require('express');
const { 
  getAllTransactions, 
  createTransaction, 
  createTransfer, // [BARU]
  updateTransaction, 
  deleteTransaction,
  resetTransactions 
} = require('../controllers/transactionController');
const { authenticateUser } = require('../middleware/authMiddleware');
// [MODIFIKASI] Impor validator baru
const { 
  validateTransaction, 
  validateTransfer 
} = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/', getAllTransactions);
router.post('/', validateTransaction, createTransaction);

// [BARU] Rute untuk transfer
router.post('/transfer', validateTransfer, createTransfer);

router.delete('/reset', resetTransactions);

router.put('/:id', validateTransaction, updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;