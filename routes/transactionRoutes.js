const express = require('express');
const { 
  getAllTransactions, 
  createTransaction, 
  createTransfer, 
  updateTransaction, // <-- Ini sudah diimpor
  deleteTransaction,
  resetTransactions 
} = require('../controllers/transactionController');

const { authenticateUser } = require('../middleware/authMiddleware');
const { 
  validateTransaction, 
  validateTransfer 
} = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

// GET & POST Transactions
router.get('/', getAllTransactions);
router.post('/', validateTransaction, createTransaction);

// Transfer
router.post('/transfer', validateTransfer, createTransfer);

// Reset
router.delete('/reset', resetTransactions);

// === [BAGIAN YANG ERROR TADI SUDAH DIPERBAIKI] ===
// Hapus 'transactionController.' cukup panggil 'updateTransaction' saja
router.put('/:id', validateTransaction, updateTransaction);

// Delete
router.delete('/:id', deleteTransaction);

module.exports = router;