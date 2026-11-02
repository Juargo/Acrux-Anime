import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
} from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUpstashRateLimiter } from './upstash-rate-limiter.js';

// Upstash speaks HTTP, so a local Redis behind its REST emulator stands in for it.
const TOKEN = 'local-test-token';
let network: StartedNetwork;
let redis: StartedTestContainer;
let rest: StartedTestContainer;
let url: string;

beforeAll(async () => {
  network = await new Network().start();
  redis = await new GenericContainer('redis:8-alpine')
    .withNetwork(network)
    .withNetworkAliases('redis')
    .start();
  rest = await new GenericContainer('hiett/serverless-redis-http:latest')
    .withNetwork(network)
    .withEnvironment({
      SRH_MODE: 'env',
      SRH_TOKEN: TOKEN,
      SRH_CONNECTION_STRING: 'redis://redis:6379',
    })
    .withExposedPorts(80)
    .start();
  url = `http://${rest.getHost()}:${rest.getMappedPort(80)}`;
}, 180_000);

afterAll(async () => {
  await rest?.stop();
  await redis?.stop();
  await network?.stop();
});

describe('createUpstashRateLimiter', () => {
  it('allows up to the limit, then denies with the seconds left in the window', async () => {
    const limiter = createUpstashRateLimiter({
      url,
      token: TOKEN,
      policies: {
        public: { requests: 2, windowSeconds: 60 },
        write: { requests: 1, windowSeconds: 60 },
      },
    });
    const results = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      results.push(await limiter.limit('public', 'key-a'));
    }
    expect(results.map((result) => result.allowed)).toEqual([true, true, false]);
    expect(results[2]?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(results[2]?.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('keeps separate counters per key and per policy', async () => {
    const limiter = createUpstashRateLimiter({
      url,
      token: TOKEN,
      policies: {
        public: { requests: 1, windowSeconds: 60 },
        write: { requests: 1, windowSeconds: 60 },
      },
    });
    expect((await limiter.limit('public', 'key-b')).allowed).toBe(true);
    expect((await limiter.limit('public', 'key-c')).allowed).toBe(true);
    expect((await limiter.limit('write', 'key-b')).allowed).toBe(true);
    expect((await limiter.limit('public', 'key-b')).allowed).toBe(false);
  });

  it('expires each counter with its window', async () => {
    const limiter = createUpstashRateLimiter({
      url,
      token: TOKEN,
      policies: {
        public: { requests: 5, windowSeconds: 30 },
        write: { requests: 5, windowSeconds: 30 },
      },
    });
    await limiter.limit('public', 'key-ttl');
    const keys = await redis.exec(['redis-cli', '--scan', '--pattern', 'acrux:public:key-ttl:*']);
    const key = keys.output.trim();
    const ttl = Number((await redis.exec(['redis-cli', 'TTL', key])).output.trim());
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
  });

  it('gives up after one second when the store does not answer', async () => {
    const server = createServer(() => {});
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const limiter = createUpstashRateLimiter({ url: `http://127.0.0.1:${port}`, token: TOKEN });
      const started = Date.now();
      await expect(limiter.limit('public', 'key-slow')).rejects.toThrow('did not answer in time');
      expect(Date.now() - started).toBeLessThan(1500);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
