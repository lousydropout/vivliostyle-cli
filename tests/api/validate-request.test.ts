import { describe, it, expect } from 'vitest';
import { validateRenderRequest } from '../../src/api/utils/validate-request.js';
import { RenderError } from '../../src/api/errors.js';

describe('validateRenderRequest', () => {
  it('accepts valid request with html only', () => {
    const result = validateRenderRequest({ html: '<h1>Test</h1>' });
    expect(result.html).toBe('<h1>Test</h1>');
    expect(result.css).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it('accepts valid request with all fields', () => {
    const result = validateRenderRequest({
      html: '<h1>Test</h1>',
      css: 'body { color: red; }',
      metadata: { title: 'Test', author: 'Author', language: 'en' },
    });
    expect(result.html).toBe('<h1>Test</h1>');
    expect(result.css).toBe('body { color: red; }');
    expect(result.metadata?.title).toBe('Test');
  });

  it('throws for missing html', () => {
    expect(() => validateRenderRequest({ css: 'body {}' })).toThrow(
      RenderError,
    );
  });

  it('throws for empty html', () => {
    expect(() => validateRenderRequest({ html: '   ' })).toThrow(RenderError);
  });

  it('throws for non-object body', () => {
    expect(() => validateRenderRequest('not an object')).toThrow(RenderError);
  });

  it('throws for invalid metadata types', () => {
    expect(() =>
      validateRenderRequest({
        html: '<h1>Test</h1>',
        metadata: { title: 123 },
      }),
    ).toThrow(RenderError);
  });
});
