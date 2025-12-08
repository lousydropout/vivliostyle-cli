/**
 * Handler for /render/epub-package endpoint.
 *
 * This endpoint accepts a pre-built EPUB package structure from epub-studio
 * and creates a valid EPUB ZIP archive. Unlike /render/epub, this endpoint
 * does NOT perform any authoring logic - it only validates, writes files,
 * and packages into a ZIP.
 *
 * Responsibilities:
 * - Validate XHTML files (basic structure check)
 * - Write files to temp workspace
 * - Add META-INF/container.xml
 * - Create ZIP with proper EPUB structure (uncompressed mimetype first)
 * - Return binary EPUB
 *
 * NOT responsible for:
 * - TOC generation (provided by epub-studio)
 * - OPF generation (provided by epub-studio)
 * - Chapter splitting (done by epub-studio)
 * - CSS injection (done by epub-studio)
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import upath from 'upath';
import archiver from 'archiver';
import { RenderError } from '../errors.js';
import { createTempWorkspace } from '../utils/temp-workspace.js';
import { validatePackageRequest } from '../utils/validate-package-request.js';
import { sendBinaryFile } from '../utils/send-binary.js';
import { Logger } from '../../logger.js';
import { EPUB_CONTAINER_XML } from '../../const.js';

export async function renderEpubPackage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const workspace = await createTempWorkspace();

  try {
    const request = validatePackageRequest(req.body);
    Logger.debug('EPUB package render request received', {
      fileCount: request.files.length,
      title: request.metadata?.title,
    });

    // Step 1: Create directory structure and write files
    for (const file of request.files) {
      const filePath = upath.join(workspace.dir, file.name);
      const dirPath = upath.dirname(filePath);

      // Create directory if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Handle base64-encoded binary files (e.g., cover images)
      if (file.isBase64) {
        const binaryData = Buffer.from(file.content, 'base64');
        fs.writeFileSync(filePath, binaryData);
        Logger.debug(
          `Wrote binary file: ${file.name} (${binaryData.length} bytes)`,
        );
      } else {
        fs.writeFileSync(filePath, file.content, 'utf8');
        Logger.debug(`Wrote file: ${file.name}`);
      }
    }

    // Step 2: Create META-INF directory and container.xml
    const metaInfDir = upath.join(workspace.dir, 'META-INF');
    fs.mkdirSync(metaInfDir, { recursive: true });
    fs.writeFileSync(
      upath.join(metaInfDir, 'container.xml'),
      EPUB_CONTAINER_XML,
      'utf8',
    );
    Logger.debug('Wrote META-INF/container.xml');

    // Step 3: Create EPUB ZIP archive
    const outputPath = upath.join(workspace.dir, 'output.epub');
    await compressEpubPackage(workspace.dir, outputPath);

    if (!fs.existsSync(outputPath)) {
      throw new RenderError(
        'EPUB package generation failed',
        'EPUB_RENDER_FAILED',
      );
    }

    Logger.debug('EPUB package build complete', { outputPath });

    // Step 4: Stream binary response
    const filename = request.metadata?.title
      ? `${request.metadata.title}.epub`
      : 'output.epub';
    await sendBinaryFile(res, outputPath, 'application/epub+zip', filename);
  } catch (err) {
    if (err instanceof RenderError) {
      next(err);
      return;
    }
    Logger.logError('EPUB package render error:', err);
    next(
      new RenderError(
        `EPUB package rendering failed: ${(err as Error).message}`,
        'EPUB_RENDER_FAILED',
        { originalError: (err as Error).message },
      ),
    );
  } finally {
    workspace.cleanup();
  }
}

/**
 * Creates an EPUB ZIP archive with proper structure.
 *
 * EPUB requirements:
 * - mimetype file must be first entry, uncompressed
 * - META-INF/ directory with container.xml
 * - EPUB/ directory with content
 */
async function compressEpubPackage(
  sourceDir: string,
  outputPath: string,
): Promise<void> {
  Logger.debug(`Compressing EPUB package: ${outputPath}`);

  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      Logger.debug(`Compressed EPUB package: ${outputPath}`);
      resolve();
    });
    output.on('error', reject);
    archive.on('warning', reject);
    archive.on('error', reject);
    archive.pipe(output);

    // mimetype must be first entry and uncompressed
    // https://www.w3.org/TR/epub-33/#sec-zip-container-mime
    archive.append('application/epub+zip', {
      name: 'mimetype',
      store: true,
    });

    // Add META-INF directory
    const metaInfPath = upath.join(sourceDir, 'META-INF');
    if (fs.existsSync(metaInfPath)) {
      archive.directory(metaInfPath, 'META-INF');
    }

    // Add EPUB directory
    const epubPath = upath.join(sourceDir, 'EPUB');
    if (fs.existsSync(epubPath)) {
      archive.directory(epubPath, 'EPUB');
    }

    archive.finalize();
  });
}
