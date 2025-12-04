import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/api-server.js';

describe('POST /render/epub', () => {
  it('renders simple HTML to EPUB', async () => {
    const res = await request(app)
      .post('/render/epub')
      .send({
        html: '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>',
        metadata: { title: 'Test Document' },
      })
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/epub+zip');
    // EPUB/ZIP magic bytes: PK
    expect(res.body.slice(0, 2).toString()).toBe('PK');
  }, 60000);

  it('returns error for missing html', async () => {
    const res = await request(app)
      .post('/render/epub')
      .send({ metadata: { title: 'Test' } });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('INVALID_INPUT');
  });
});
