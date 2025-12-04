import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/api-server.js';

describe('POST /render/pdf', () => {
  it('renders simple HTML to PDF', async () => {
    const res = await request(app)
      .post('/render/pdf')
      .send({
        html: '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>',
        metadata: { title: 'Test Document' },
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    // PDF magic bytes: %PDF-
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  }, 60000); // 60s timeout for Playwright

  it('returns error for missing html', async () => {
    const res = await request(app).post('/render/pdf').send({ css: 'body {}' });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('INVALID_INPUT');
  });
});
