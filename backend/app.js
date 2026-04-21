/**
 * NAME IT SCENTS - Backend API Server
 * Express server with Firebase Admin SDK and JWT authentication
 */

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();
const { requestId, basicSecurityHeaders } = require('./middleware/security');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3030;

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require('./service-account.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
    storageBucket: 'name-it-e674c.firebasestorage.app',
  });
  
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  console.warn('⚠️  Server will continue but Firebase features may not work');
}

// Middleware
// Parse CORS origins - handle comma-separated string or use wildcard
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : '*';

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

app.use(requestId);
app.use(basicSecurityHeaders);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'NAME IT SCENTS API Server is running',
    timestamp: new Date().toISOString(),
    firebase: admin.apps.length > 0 ? 'Initialized' : 'Not initialized',
  });
});

// API Routes
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const storageRoutes = require('./routes/storage');
const analyticsRoutes = require('./routes/analytics');
const wishlistRoutes = require('./routes/wishlist');
const activityRoutes = require('./routes/activity');
const rewardsRoutes = require('./routes/rewards');
const chatRoutes = require('./routes/chat');

// Initialize Gemini AI for chatbot
const chatService = require('./services/chatService');
chatService.initializeGemini();

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/chat', chatRoutes);

// Placeholder route
app.get('/api', (req, res) => {
  res.json({
    message: 'NAME IT SCENTS API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      // Add your endpoints here as you create them
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const message = err?.message ? String(err.message) : 'Internal Server Error';
  console.error(`[app-error] requestId=${req.requestId || 'n/a'} message=${message}`);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred.',
    requestId: req.requestId,
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `\n❌ Port ${PORT} is already in use. Pick a free port:\n` +
        `   In backend/.env set PORT=3030 (or another free port), then set the same URL in the frontend (window.API_BASE_URL or frontend/js/api.js).\n`
    );
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
