import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/api-server.js';

describe('/health endpoint', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});
