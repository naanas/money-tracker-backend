const express = require('express');
const { getAllCategories } = require('../controllers/categoryController');
const { authenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser);
router.get('/', getAllCategories);

module.exports = router;