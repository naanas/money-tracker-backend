const express = require('express');
// [BARU] Impor fungsi deleteCategory
const { 
  getAllCategories, 
  createCategory, 
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
router.delete('/:id', deleteCategory);
// === [AKHIR RUTE BARU] ===

module.exports = router;