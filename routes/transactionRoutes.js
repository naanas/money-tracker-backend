const express = require('express');
const { 
  getAllTransactions, 
  createTransaction, 
  updateTransaction, 
  deleteTransaction,
  resetTransactions // [BARU] Impor fungsi reset
} = require('../controllers/transactionController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateTransaction } = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/', getAllTransactions);
router.post('/', validateTransaction, createTransaction);

// === [RUTE BARU DITAMBAHKAN] ===
// Rute ini HARUS di atas '/:id' agar 'reset' tidak dianggap sebagai ID
router.delete('/reset', resetTransactions);
// === [AKHIR RUTE BARU] ===

router.put('/:id', validateTransaction, updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;