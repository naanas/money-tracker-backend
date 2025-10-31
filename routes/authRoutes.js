const express = require('express');
const { register, login, getProfile } = require('../controllers/authController');
const { authenticateUser } = require('../middleware/authMiddleware');
// [MODIFIKASI] Impor authLimiter
const { authLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// [MODIFIKASI] Tambahkan authLimiter ke rute
router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticateUser, getProfile);

module.exports = router;