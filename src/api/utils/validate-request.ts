import { RenderError } from '../errors.js';

export interface RenderRequest {
  html: string;
  css?: string;
  metadata?: {
    title?: string;
    author?: string;
    language?: string;
  };
}

export function validateRenderRequest(body: unknown): RenderRequest {
  if (!body || typeof body !== 'object') {
    throw new RenderError('Request body must be an object', 'INVALID_INPUT');
  }

  const { html, css, metadata } = body as Record<string, unknown>;

  if (typeof html !== 'string' || html.trim().length === 0) {
    throw new RenderError(
      'html field is required and must be a non-empty string',
      'INVALID_INPUT',
    );
  }

  if (css !== undefined && typeof css !== 'string') {
    throw new RenderError('css field must be a string', 'INVALID_INPUT');
  }

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
    html,
    css: css as string | undefined,
    metadata: metadata as RenderRequest['metadata'],
  };
}
