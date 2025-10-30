const express = require('express');
const { getMonthlySummary } = require('../controllers/analyticsController');
const { authenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser);
router.get('/summary', getMonthlySummary);

module.exports = router;