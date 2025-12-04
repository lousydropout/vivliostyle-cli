import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import upath from 'upath';
import type { PreviewServer } from 'vite';
import { buildPDF } from '../../output/pdf.js';
import { compile } from '../../processor/compile.js';
import {
  resolveTaskConfig,
  PdfOutput,
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

export async function renderPdf(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const workspace = await createTempWorkspace();
  let server: PreviewServer | undefined;

  try {
    const request = validateRenderRequest(req.body);
    Logger.debug('PDF render request received', {
      title: request.metadata?.title,
    });

    // Step 1: Write HTML/CSS to workspace (no mutation)
    const { htmlPath } = writeWorkspaceFiles(
      workspace,
      request.html,
      request.css,
    );

    // Step 2: Create BuildTask and resolve config
    const outputPath = upath.join(workspace.dir, 'output.pdf');
    const task = createBuildTask(
      workspace.dir,
      htmlPath,
      outputPath,
      'pdf',
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

    // Step 5: Build PDF (uses compiled XHTML automatically)
    Logger.debug('Building PDF...');
    const target: PdfOutput = {
      format: 'pdf',
      path: outputPath,
      renderMode: 'local',
      preflight: undefined,
      preflightOption: [],
    };

    const result = await buildPDF({ target, config });

    if (!result || !fs.existsSync(outputPath)) {
      throw new RenderError('PDF generation failed', 'PDF_RENDER_FAILED');
    }

    Logger.debug('PDF build complete', { outputPath });

    // Step 6: Stream binary response
    const filename = request.metadata?.title
      ? `${request.metadata.title}.pdf`
      : 'output.pdf';
    await sendBinaryFile(res, outputPath, 'application/pdf', filename);
  } catch (err) {
    if (err instanceof RenderError) {
      next(err);
      return;
    }
    Logger.logError('PDF render error:', err);
    next(
      new RenderError(
        `PDF rendering failed: ${(err as Error).message}`,
        'PDF_RENDER_FAILED',
        { originalError: (err as Error).message },
      ),
    );
  } finally {
    // Clean up: close Vite server and remove temp workspace
    await server?.close();
    workspace.cleanup();
  }
}
