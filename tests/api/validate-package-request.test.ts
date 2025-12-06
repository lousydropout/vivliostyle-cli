import { describe, it, expect } from 'vitest';
import { validatePackageRequest } from '../../src/api/utils/validate-package-request.js';
import { RenderError } from '../../src/api/errors.js';

describe('validatePackageRequest', () => {
  const validFiles = [
    { name: 'EPUB/content.opf', content: '<?xml version="1.0"?><package/>' },
    { name: 'EPUB/nav.xhtml', content: '<nav/>' },
    { name: 'EPUB/chapters/chapter-1.xhtml', content: '<html/>' },
  ];

  it('accepts valid request with files only', () => {
    const result = validatePackageRequest({ files: validFiles });
    expect(result.files).toHaveLength(3);
    expect(result.metadata).toBeUndefined();
  });

  it('accepts valid request with files and metadata', () => {
    const result = validatePackageRequest({
      files: validFiles,
      metadata: { title: 'Test Book', author: 'Author', language: 'en' },
    });
    expect(result.files).toHaveLength(3);
    expect(result.metadata?.title).toBe('Test Book');
    expect(result.metadata?.author).toBe('Author');
    expect(result.metadata?.language).toBe('en');
  });

  it('throws for missing files', () => {
    expect(() =>
      validatePackageRequest({ metadata: { title: 'Test' } }),
    ).toThrow(RenderError);
  });

  it('throws for empty files array', () => {
    expect(() => validatePackageRequest({ files: [] })).toThrow(RenderError);
  });

  it('throws for non-array files', () => {
    expect(() => validatePackageRequest({ files: 'not an array' })).toThrow(
      RenderError,
    );
  });

  it('throws for non-object body', () => {
    expect(() => validatePackageRequest('not an object')).toThrow(RenderError);
  });

  it('throws for file with missing name', () => {
    expect(() =>
      validatePackageRequest({
        files: [{ content: '<html/>' }],
      }),
    ).toThrow(RenderError);
  });

  it('throws for file with empty name', () => {
    expect(() =>
      validatePackageRequest({
        files: [{ name: '  ', content: '<html/>' }],
      }),
    ).toThrow(RenderError);
  });

  it('throws for file with missing content', () => {
    expect(() =>
      validatePackageRequest({
        files: [{ name: 'test.xhtml' }],
      }),
    ).toThrow(RenderError);
  });

  it('throws for file with path traversal', () => {
    expect(() =>
      validatePackageRequest({
        files: [{ name: '../evil.xhtml', content: '<html/>' }],
      }),
    ).toThrow(RenderError);
  });

  it('throws for file with absolute path', () => {
    expect(() =>
      validatePackageRequest({
        files: [{ name: '/etc/passwd', content: 'bad' }],
      }),
    ).toThrow(RenderError);
  });

  it('throws for missing content.opf', () => {
    expect(() =>
      validatePackageRequest({
        files: [
          { name: 'EPUB/nav.xhtml', content: '<nav/>' },
          { name: 'EPUB/chapters/chapter-1.xhtml', content: '<html/>' },
        ],
      }),
    ).toThrow(RenderError);
  });

  it('throws for invalid metadata types', () => {
    expect(() =>
      validatePackageRequest({
        files: validFiles,
        metadata: { title: 123 },
      }),
    ).toThrow(RenderError);
  });

  it('throws for metadata as non-object', () => {
    expect(() =>
      validatePackageRequest({
        files: validFiles,
        metadata: 'not an object',
      }),
    ).toThrow(RenderError);
  });
});
