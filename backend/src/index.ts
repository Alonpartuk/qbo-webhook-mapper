// =============================================================================
// SAFE START - Validate environment BEFORE any other imports
// =============================================================================
console.log('[Startup] Process starting...');
console.log('[Startup] NODE_ENV:', process.env.NODE_ENV);
console.log('[Startup] PORT:', process.env.PORT);
console.log('[Startup] USE_MOCK_DATA:', process.env.USE_MOCK_DATA);

// Validate config first (before heavy imports that might fail)
import { validateOrExit } from './utils/configValidator';
validateOrExit();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import {
  standardRateLimiter,
  proxyRateLimiter,
  authRateLimiter,
  webhookRateLimiter,
} from './middleware/rateLimit';
import { logEnvWarnings } from './utils/envCheck';

console.log('[Startup] All imports loaded successfully');

// =============================================================================
// GLOBAL ERROR HANDLERS
// =============================================================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// =============================================================================
// EXPRESS APPLICATION
// =============================================================================

const app = express();

// CORS configuration - whitelist allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
];
// In production, add the deployed frontend URL
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// Log allowed origins on startup for debugging
console.log('[CORS] Allowed origins:', allowedOrigins);
console.log('[CORS] FRONTEND_URL env:', process.env.FRONTEND_URL);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Check exact match first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any Cloud Run URL from the same project (*.run.app)
    // This handles both frontend-only and combined deployments
    if (origin.endsWith('.run.app') && origin.includes('qbo-webhook-mapper')) {
      console.log('[CORS] Allowing Cloud Run origin:', origin);
      return callback(null, true);
    }

    // In development, allow any origin
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    console.error('[CORS] Rejected origin:', origin, 'Allowed:', allowedOrigins);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files in production ONLY if frontend is bundled with backend
// Skip if FRONTEND_URL is set to an external URL (separate deployment)
const frontendUrl = process.env.FRONTEND_URL || '';
const isFrontendExternal = frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://');

// Calculate frontend path - use absolute path in Docker container
// In Docker: cwd=/app/backend, frontend is at /app/frontend/dist
const frontendPath = process.env.NODE_ENV === 'production'
  ? '/app/frontend/dist'
  : path.join(__dirname, '../../frontend/dist');

console.log('[Static] Frontend path:', frontendPath);
console.log('[Static] __dirname:', __dirname);
console.log('[Static] cwd:', process.cwd());

// Verify frontend path exists before setting up static serving
if (process.env.NODE_ENV === 'production') {
  if (fs.existsSync(frontendPath)) {
    console.log('[Static] ✓ Frontend dist folder exists');
    const files = fs.readdirSync(frontendPath);
    console.log('[Static] Contents:', files.join(', '));
  } else {
    console.error('[Static] ❌ CRITICAL: Frontend dist NOT FOUND at:', frontendPath);
    console.error('[Static] This will cause 500 errors for all frontend requests!');
  }
}

if (process.env.NODE_ENV === 'production' && !isFrontendExternal) {
  // Serve static files with aggressive caching for production assets
  app.use(express.static(frontendPath, {
    maxAge: '1y', // 1 year cache for static assets (they have content hashes)
    etag: true,
    index: 'index.html', // Explicitly set index file
    setHeaders: (res, filePath) => {
      // HTML files should not be cached
      if (filePath && filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath && filePath.match(/\.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg)$/)) {
        // Immutable for hashed assets
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  console.log('[Static] express.static middleware registered for:', frontendPath);
}

// Health check endpoint (required for Cloud Run)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint - in development show API info, in production let SPA catch-all handle it
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.json({ message: 'QBO Webhook Mapper API', status: 'running' });
  });
}

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// =============================================================================
// RATE LIMITING
// =============================================================================

// Auth endpoints - moderate rate limiting (20 requests per 15 minutes)
app.use('/api/admin/auth/login', authRateLimiter);

// Proxy API - per API key rate limiting (60 requests per minute)
app.use('/api/v1/org/:slug/proxy', proxyRateLimiter);

// Webhook endpoints - generous rate limiting (300 requests per minute)
app.use('/api/v1/webhook', webhookRateLimiter);

// Standard rate limiting for all other API routes (100 requests per 15 minutes)
app.use('/api', standardRateLimiter);

// API Routes
app.use('/api', routes);

// =============================================================================
// ERROR HANDLING - Must come before SPA catch-all
// =============================================================================

// API 404 handler - returns JSON for all /api/* routes that don't match
app.use('/api', notFoundHandler);

// Global error handler
app.use(errorHandler);

// =============================================================================
// SPA ROUTING - Catch-all for frontend routes (must be AFTER API routes)
// =============================================================================

if (process.env.NODE_ENV === 'production') {
  // Verify frontend path exists at startup
  const indexHtmlPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    console.log('[SPA] ✓ index.html verified at:', indexHtmlPath);
  } else {
    console.error('[SPA] ❌ CRITICAL: index.html NOT FOUND at:', indexHtmlPath);
    console.error('[SPA] Frontend will not work! Check Docker build.');
  }

  // Catch-all for SPA routing - ONLY for non-API, non-file routes
  app.get('*', (req, res) => {
    // Double-check we're not handling API routes (they should have been caught above)
    if (req.path.startsWith('/api')) {
      // This shouldn't happen, but return JSON just in case
      return res.status(404).json({
        success: false,
        error: `API route not found: ${req.method} ${req.path}`,
      });
    }

    // Skip static file requests (they would have been served by express.static)
    if (req.path.includes('.') && !req.path.endsWith('.html')) {
      console.log('[SPA] Static file not found, returning 404:', req.path);
      return res.status(404).json({
        success: false,
        error: 'Static file not found',
      });
    }

    // If frontend is deployed externally, redirect to it
    if (isFrontendExternal) {
      return res.redirect(`${frontendUrl}${req.path}`);
    }

    // Otherwise serve local index.html for SPA routing (with error handling!)
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('[SPA] Failed to send index.html:', err.message);
        console.error('[SPA] Attempted path:', indexPath);
        res.status(500).json({
          success: false,
          error: 'Frontend not available',
          details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
      }
    });
  });
}

// Start server - bind to 0.0.0.0 for Cloud Run compatibility
const HOST = '0.0.0.0';
const PORT = config.port;

console.log(`[Startup] Attempting to start server...`);
console.log(`[Startup] Config port: ${PORT}, Host: ${HOST}`);

try {
  const server = app.listen(PORT, HOST, () => {
    console.log(`[Startup] Server is now listening on ${HOST}:${PORT}`);
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║       QBO Webhook Mapper API Server                       ║
╠═══════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                       ║
║  Host:        ${HOST}                                     ║
║  Environment: ${config.nodeEnv.padEnd(12)}                        ║
║  BigQuery:    ${config.bigquery.projectId}/${config.bigquery.dataset.substring(0, 10)}...       ║
║  QBO Env:     ${config.qbo.environment.padEnd(12)}                        ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Log environment configuration warnings
    logEnvWarnings();
  });

  server.on('error', (err: Error) => {
    console.error('[Startup] Server error:', err);
    process.exit(1);
  });
} catch (err) {
  console.error('[Startup] Failed to start server:', err);
  process.exit(1);
}

export default app;
