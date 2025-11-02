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
  validateTransfer,
  validateTransactionUpdate // [PERBAIKAN] Impor validator baru
} = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/', getAllTransactions);
router.post('/', validateTransaction, createTransaction);

// [BARU] Rute untuk transfer
router.post('/transfer', validateTransfer, createTransfer);

router.delete('/reset', resetTransactions);

// [PERBAIKAN] Gunakan validator update yang lebih fleksibel
router.put('/:id', validateTransactionUpdate, updateTransaction); 
router.delete('/:id', deleteTransaction);

module.exports = router;