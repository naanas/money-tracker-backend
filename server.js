const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const environment = require('./config/environment');
const { generalLimiter } = require('./middleware/rateLimitMiddleware');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const savingsRoutes = require('./routes/savingsRoutes'); // <-- [BARU] Impor rute tabungan

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(generalLimiter);
app.use(cors({
  origin: environment.clientUrl,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    environment: environment.nodeEnv
  });
});

app.set('trust proxy', 1);

// API info
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Money Tracker API',
    version: '1.0.0',
    documentation: 'https://github.com/your-username/money-tracker-backend'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/savings', savingsRoutes); // <-- [BARU] Daftarkan rute tabungan

// Error handling
app.use(notFound);
app.use(errorHandler);


module.exports = app;