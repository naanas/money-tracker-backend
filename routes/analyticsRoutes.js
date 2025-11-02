const express = require('express');
// [MODIFIKASI] Impor fungsi baru
const { 
  getMonthlySummary, 
  // getAccountBalances, // [DIHAPUS]
  getTrends 
} = require('../controllers/analyticsController');
const { authenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/summary', getMonthlySummary);
// router.get('/balances', getAccountBalances); // [DIHAPUS]
router.get('/trends', getTrends);           // [BARU]

module.exports = router;