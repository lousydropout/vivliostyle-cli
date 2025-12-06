import { RenderError } from '../errors.js';

export interface EpubPackageFile {
  name: string;
  content: string;
}

export interface EpubPackageMetadata {
  title?: string;
  author?: string;
  language?: string;
}

export interface EpubPackageRequest {
  files: EpubPackageFile[];
  metadata?: EpubPackageMetadata;
}

/**
 * Validates an EPUB package request.
 *
 * Expected format:
 * {
 *   files: [
 *     { name: "EPUB/content.opf", content: "<?xml..." },
 *     { name: "EPUB/nav.xhtml", content: "<nav>..." },
 *     { name: "EPUB/chapters/chapter-1.xhtml", content: "<html>..." },
 *     { name: "EPUB/css/default.css", content: "body {...}" }
 *   ],
 *   metadata?: { title?: string, author?: string, language?: string }
 * }
 */
export function validatePackageRequest(body: unknown): EpubPackageRequest {
  if (!body || typeof body !== 'object') {
    throw new RenderError('Request body must be an object', 'INVALID_INPUT');
  }

  const { files, metadata } = body as Record<string, unknown>;

  // Validate files array
  if (!Array.isArray(files)) {
    throw new RenderError(
      'files field is required and must be an array',
      'INVALID_INPUT',
    );
  }

  if (files.length === 0) {
    throw new RenderError(
      'files array must contain at least one file',
      'INVALID_INPUT',
    );
  }

  // Validate each file entry
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || typeof file !== 'object') {
      throw new RenderError(`files[${i}] must be an object`, 'INVALID_INPUT');
    }

    const { name, content } = file as Record<string, unknown>;

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new RenderError(
        `files[${i}].name must be a non-empty string`,
        'INVALID_INPUT',
      );
    }

    if (typeof content !== 'string') {
      throw new RenderError(
        `files[${i}].content must be a string`,
        'INVALID_INPUT',
      );
    }

    // Validate file path doesn't escape workspace
    if (name.includes('..') || name.startsWith('/')) {
      throw new RenderError(
        `files[${i}].name contains invalid path characters`,
        'INVALID_INPUT',
      );
    }
  }

  // Check for required EPUB structure
  const fileNames = files.map((f: { name: string }) => f.name);
  const hasContentOpf = fileNames.some((name: string) =>
    name.endsWith('content.opf'),
  );

  if (!hasContentOpf) {
    throw new RenderError(
      'EPUB package must include a content.opf file',
      'INVALID_INPUT',
    );
  }

  // Validate metadata if provided
  if (metadata !== undefined) {
    if (typeof metadata !== 'object' || metadata === null) {
      throw new RenderError('metadata must be an object', 'INVALID_INPUT');
    }
    const m = metadata as Record<string, unknown>;
    if (m.title !== undefined && typeof m.title !== 'string') {
      throw new RenderError('metadata.title must be a string', 'INVALID_INPUT');
    }
    if (m.author !== undefined && typeof m.author !== 'string') {
      throw new RenderError(
        'metadata.author must be a string',
        'INVALID_INPUT',
      );
    }
    if (m.language !== undefined && typeof m.language !== 'string') {
      throw new RenderError(
        'metadata.language must be a string',
        'INVALID_INPUT',
      );
    }
  }

  return {
    files: files as EpubPackageFile[],
    metadata: metadata as EpubPackageMetadata | undefined,
  };
}
