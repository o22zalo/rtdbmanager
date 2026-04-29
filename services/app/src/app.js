import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { apiRateLimiter, requireApiKey } from './middleware/apiAuth.js';
import { logger, requestLogger } from './middleware/logger.js';
import { createSessionMiddleware, requireSession } from './middleware/session.js';
import { assertMasterConnection } from './services/firebase.js';
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import dataRoutes from './routes/data.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');
const indexHtmlPath = path.join(publicDir, 'index.html');

const app = express();

/**
 * Escapes text before injecting build metadata into HTML.
 * @param {string} value Raw text.
 * @returns {string} HTML-safe text.
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Returns a build metadata env var or the requested fallback label.
 * @param {string} name Env var name.
 * @returns {string} Build metadata value.
 */
function buildValue(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : 'unknow';
}

/**
 * Renders index.html with runtime build metadata.
 * @returns {Promise<string>} Rendered HTML.
 */
async function renderIndexHtml() {
  const html = await readFile(indexHtmlPath, 'utf8');
  return html
    .replaceAll(
      '<span data-build-value="commit-id">unknow</span>',
      `<span data-build-value="commit-id">${escapeHtml(buildValue('_DOTENVRTDB_RUNNER_COMMIT_ID'))}</span>`
    )
    .replaceAll(
      '<span data-build-value="commit-at">unknow</span>',
      `<span data-build-value="commit-at">${escapeHtml(buildValue('_DOTENVRTDB_RUNNER_COMMIT_AT'))}</span>`
    );
}

/**
 * Sends the rendered SPA HTML shell.
 * @param {import('express').Request} req Express request.
 * @param {import('express').Response} res Express response.
 * @param {import('express').NextFunction} next Express next callback.
 * @returns {Promise<void>} Resolves after response is sent.
 */
async function sendIndexHtml(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(await renderIndexHtml());
  } catch (error) {
    next(error);
  }
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.tailwindcss.com',
        'https://www.gstatic.com',
        'https://apis.google.com',
        'https://accounts.google.com'
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: [
        "'self'",
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        'https://firebaseinstallations.googleapis.com',
        'https://www.googleapis.com',
        'https://*.googleapis.com',
        'https://apis.google.com',
        'https://accounts.google.com',
        'https://*.firebaseapp.com'
      ],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameSrc: [
        "'self'",
        'https://*.firebaseapp.com',
        'https://accounts.google.com',
        'https://apis.google.com'
      ],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

const allowedOrigins = new Set([
  config.appOrigin,
  `http://localhost:${config.port}`,
  `http://127.0.0.1:${config.port}`
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin is not allowed.'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(requestLogger);
app.use(createSessionMiddleware());

app.use('/auth', authRoutes);
app.use('/projects', requireSession, projectsRoutes);
app.use('/data', requireSession, dataRoutes);
app.use('/admin', requireSession, adminRoutes);
app.use('/api/v1', apiRateLimiter, requireApiKey, apiRoutes);
app.use('/api/v1', (req, res) => {
  res.status(404).json({
    ok: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found.'
    },
    meta: {
      requestId: res.locals.requestId || req.requestId || null,
      timestamp: Date.now()
    }
  });
});

app.get('/index.html', sendIndexHtml);

app.use(express.static(publicDir, {
  index: false,
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js') || filePath.endsWith('.html') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get('*', sendIndexHtml);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = err.status || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = status === 500 ? 'Internal server error.' : err.message;

  logger.error({
    requestId: res.locals.requestId || req.requestId || null,
    error: code,
    message: err.message,
    stack: err.stack
  });

  if (req.originalUrl.startsWith('/api/v1')) {
    res.status(status).json({
      ok: false,
      data: null,
      error: { code, message },
      meta: {
        requestId: res.locals.requestId || req.requestId || null,
        timestamp: Date.now()
      }
    });
    return;
  }

  res.status(status).json({ ok: false, error: code, message });
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

/**
 * Starts the HTTP server after checking the master RTDB connection.
 * @returns {Promise<void>} Resolves after server starts.
 */
async function start() {
  try {
    await assertMasterConnection();
  } catch (error) {
    logger.fatal({
      error: error.code || 'MASTER_RTDB_UNREACHABLE',
      message: error.message
    }, 'Cannot start RTDB Manager. Check MASTER_FIREBASE_* env vars and database access.');
    process.exit(1);
  }

  app.listen(config.port, () => {
    logger.info({ port: config.port }, `RTDB Manager listening on port ${config.port}`);
  });
}

start();

export default app;
