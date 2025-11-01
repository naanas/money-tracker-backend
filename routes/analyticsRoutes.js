const express = require('express');
// [MODIFIKASI] Impor fungsi baru
const { 
  getMonthlySummary, 
  getAccountBalances, 
  getTrends 
} = require('../controllers/analyticsController');
const { authenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/summary', getMonthlySummary);
router.get('/balances', getAccountBalances); // [BARU]
router.get('/trends', getTrends);           // [BARU]

module.exports = router;