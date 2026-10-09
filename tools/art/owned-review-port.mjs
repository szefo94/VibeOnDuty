import { createServer } from 'node:net';
import { randomInt } from 'node:crypto';

// Probe a concrete high loopback port. Vite must later bind it strictly; a race
// fails the owned job instead of selecting another owner's listener.
export async function ownedReviewPort() {
  for (let attempt = 0; attempt < 64; attempt++) {
    const port = randomInt(52000, 62000), probe = createServer();
    const free = await new Promise((resolve, reject) => {
      probe.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
      probe.listen(port, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve(true)));
    });
    if (free) return port;
  }
  throw Error('No free owned review port; existing listeners remain untouched');
}
