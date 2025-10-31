const express = require('express');
// [MODIFIKASI] Impor fungsi updateCategory
const { 
  getAllCategories, 
  createCategory, 
  updateCategory, // <-- BARU
  deleteCategory 
} = require('../controllers/categoryController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateCategory } = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.get('/', getAllCategories);
router.post('/', validateCategory, createCategory);

// === [RUTE BARU DITAMBAHKAN] ===
// :id adalah parameter URL (misal: /api/categories/uuid-abc-123)
router.put('/:id', validateCategory, updateCategory); // <-- BARU
router.delete('/:id', deleteCategory);
// === [AKHIR RUTE BARU] ===

module.exports = router;