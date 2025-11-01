const express = require('express');
const {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount
} = require('../controllers/accountController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateAccount } = require('../middleware/validationMiddleware');

const router = express.Router();

router.use(authenticateUser);

router.route('/')
  .get(getAccounts)
  .post(validateAccount, createAccount);

router.route('/:id')
  .put(validateAccount, updateAccount)
  .delete(deleteAccount);

module.exports = router;