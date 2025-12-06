import express, { Express, Request, Response, NextFunction } from 'express';
import { RenderError, ApiError } from './api/errors.js';
import { Logger } from './logger.js';
import { renderPdf } from './api/handlers/render-pdf.js';
import { renderEpub } from './api/handlers/render-epub.js';
import { renderEpubPackage } from './api/handlers/render-epub-package.js';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const JSON_LIMIT = process.env.JSON_LIMIT || '50mb';
const startTime = Date.now();

// Middleware
app.use(express.json({ limit: JSON_LIMIT }));

// Health endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: (Date.now() - startTime) / 1000,
  });
});

// Render endpoints
// Each render handler creates its own per-request Vite server
// to serve files from the request's temp workspace
app.post('/render/pdf', renderPdf);
app.post('/render/epub', renderEpub);
app.post('/render/epub-package', renderEpubPackage);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  Logger.logError('Request error:', err);

  if (err instanceof RenderError) {
    res.status(400).json(err.toJSON());
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        message: 'Invalid JSON in request body',
        type: 'INVALID_INPUT',
      },
    } satisfies ApiError);
    return;
  }

  res.status(500).json({
    error: {
      message: 'Internal server error',
      type: 'INTERNAL_ERROR',
    },
  } satisfies ApiError);
});

// Graceful shutdown
function shutdown(signal: string) {
  Logger.log(`Received ${signal}, shutting down gracefully...`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Startup
async function main() {
  try {
    app.listen(PORT, '0.0.0.0', () => {
      Logger.log(`API server listening on port ${PORT}`);
    });
  } catch (err) {
    Logger.logError('Failed to start server:', err);
    process.exit(1);
  }
}

main();

export { app };
