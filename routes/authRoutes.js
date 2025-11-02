const express = require('express');
const { 
  register, 
  login, 
  getProfile,
  updateProfile,    // [BARU]
  updatePassword    // [BARU]
} = require('../controllers/authController');
const { authenticateUser } = require('../middleware/authMiddleware');
// [MODIFIKASI] Impor authLimiter
const { authLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// [MODIFIKASI] Tambahkan authLimiter ke rute
router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticateUser, getProfile);

// === [RUTE BARU] ===
// Untuk update email dan nama
router.put('/profile', authenticateUser, updateProfile);
// Untuk update password
router.put('/password', authenticateUser, updatePassword);

module.exports = router;