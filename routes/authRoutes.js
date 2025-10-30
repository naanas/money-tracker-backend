const express = require('express');
const { register, login, getProfile } = require('../controllers/authController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/profile', authenticateUser, getProfile);

module.exports = router;