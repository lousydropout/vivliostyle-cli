import { describe, it, expect } from 'vitest';
import { RenderError } from '../../src/api/errors.js';

describe('RenderError', () => {
  it('serializes to JSON correctly', () => {
    const error = new RenderError('Test error', 'INVALID_INPUT', {
      field: 'html',
    });
    const json = error.toJSON();

    expect(json.error.message).toBe('Test error');
    expect(json.error.type).toBe('INVALID_INPUT');
    expect(json.error.details).toEqual({ field: 'html' });
  });

  it('works without details', () => {
    const error = new RenderError('Test error', 'PDF_RENDER_FAILED');
    const json = error.toJSON();

    expect(json.error.message).toBe('Test error');
    expect(json.error.type).toBe('PDF_RENDER_FAILED');
    expect(json.error.details).toBeUndefined();
  });

  it('extends Error', () => {
    const error = new RenderError('Test', 'INTERNAL_ERROR');
    expect(error instanceof Error).toBe(true);
    expect(error.name).toBe('RenderError');
  });
});
