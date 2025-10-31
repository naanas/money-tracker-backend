const express = require('express');
// [BARU] Impor fungsi createCategory
const { getAllCategories, createCategory } = require('../controllers/categoryController');
const { authenticateUser } = require('../middleware/authMiddleware');
// [BARU] Impor validator kategori
const { validateCategory } = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/', getAllCategories);

// === [RUTE BARU DITAMBAHKAN] ===
router.post('/', validateCategory, createCategory);
// === [AKHIR RUTE BARU] ===

module.exports = router;