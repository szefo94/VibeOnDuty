import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMpFixture } from '../tests/helpers/mpServer.js';
import { createHostileClient, waitFor } from './testHelpers/hostileClient.js';

let server, url;
beforeAll(async () => {
  server = await startMpFixture();
  url = server.url;
}, 30000);
afterAll(async () => { await server?.stop(); }, 15000);

describe('real room input boundary', () => {
  it('reports raw nonfinite rejection without mutation over the real SDK transport', async () => {
    const client = await createHostileClient(url, { create: true });
    try {
      expect(client.origin).toBe(new URL(url).origin);
      const initial = client.snapshot().players[client.sessionId];
      client.send(client.command({ moveX: NaN }));
      await waitFor(() => client.rejections.includes('invalid_number'));
      expect(client.rejections).toContain('invalid_number');
      const body = client.snapshot().players[client.sessionId];
      expect([body.x, body.y, body.z, body.ammo]).toEqual([initial.x, initial.y, initial.z, initial.ammo]);
    } finally { await client.close(); }
  });
});
