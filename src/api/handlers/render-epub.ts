import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import upath from 'upath';
import type { PreviewServer } from 'vite';
import { buildWebPublication } from '../../output/webbook.js';
import { compile } from '../../processor/compile.js';
import {
  resolveTaskConfig,
  EpubOutput,
  isWebPubConfig,
} from '../../config/resolve.js';
import { resolveViteConfig } from '../../config/vite.js';
import { createViteServer } from '../../server.js';
import { RenderError } from '../errors.js';
import {
  createTempWorkspace,
  writeWorkspaceFiles,
} from '../utils/temp-workspace.js';
import { validateRenderRequest } from '../utils/validate-request.js';
import { createBuildTask } from '../utils/create-build-task.js';
import { sendBinaryFile } from '../utils/send-binary.js';
import { Logger } from '../../logger.js';

export async function renderEpub(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const workspace = await createTempWorkspace();
  let server: PreviewServer | undefined;

  try {
    const request = validateRenderRequest(req.body);
    Logger.debug('EPUB render request received', {
      title: request.metadata?.title,
    });

    // Step 1: Write HTML/CSS to workspace (no mutation)
    const { htmlPath } = writeWorkspaceFiles(
      workspace,
      request.html,
      request.css,
    );

    // Step 2: Create BuildTask and resolve config
    const outputPath = upath.join(workspace.dir, 'output.epub');
    const task = createBuildTask(
      workspace.dir,
      htmlPath,
      outputPath,
      'epub',
      request,
    );
    let config = resolveTaskConfig(task, {
      cwd: workspace.dir,
      logLevel: 'silent',
    });

    // Verify config has WebPublicationManifest viewerInput
    if (!isWebPubConfig(config)) {
      throw new RenderError(
        'Configuration resolution failed: expected WebPublicationManifest',
        'INTERNAL_ERROR',
      );
    }

    // Step 3: Create Vite server for this request's workspace
    Logger.debug('Starting Vite server for request...');
    const viteConfig = await resolveViteConfig({ ...config, mode: 'build' });
    const inlineConfig = { logLevel: 'silent' as const, cwd: workspace.dir };

    server = await createViteServer({
      config,
      viteConfig,
      inlineConfig,
      mode: 'build',
    });

    // Update config with actual server port
    if (server.httpServer) {
      const addressInfo = server.httpServer.address();
      if (addressInfo && typeof addressInfo !== 'string') {
        const actualPort = addressInfo.port;
        // Update the config with the actual port
        (config as any).server = { ...config.server, port: actualPort };
        (config as any).rootUrl = `http://localhost:${actualPort}`;
        Logger.debug(`Vite server started on port ${actualPort}`);
      }
    }

    // Step 4: CRITICAL - Run compile() to generate XHTML
    Logger.debug('Compiling HTML...');
    await compile(config);

    // Step 5: Build EPUB via buildWebPublication
    // When target.format === 'epub', this calls exportEpub() internally
    Logger.debug('Building EPUB...');
    const target: EpubOutput = {
      format: 'epub',
      path: outputPath,
      version: '3.0',
    };

    await buildWebPublication({ target, config });

    if (!fs.existsSync(outputPath)) {
      throw new RenderError('EPUB generation failed', 'EPUB_RENDER_FAILED');
    }

    Logger.debug('EPUB build complete', { outputPath });

    // Step 6: Stream binary response
    const filename = request.metadata?.title
      ? `${request.metadata.title}.epub`
      : 'output.epub';
    await sendBinaryFile(res, outputPath, 'application/epub+zip', filename);
  } catch (err) {
    if (err instanceof RenderError) {
      next(err);
      return;
    }
    Logger.logError('EPUB render error:', err);
    next(
      new RenderError(
        `EPUB rendering failed: ${(err as Error).message}`,
        'EPUB_RENDER_FAILED',
        { originalError: (err as Error).message },
      ),
    );
  } finally {
    // Clean up: close Vite server and remove temp workspace
    await server?.close();
    workspace.cleanup();
  }
}
