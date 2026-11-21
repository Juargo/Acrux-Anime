import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
} from 'testcontainers';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

// The limiter reads the clock to pick its window, so these tests pin it: a real clock makes
// them fail whenever they run across the end of a window. The instant is in the future
// because the store expires the counters on its own clock.
const WINDOW_START_SECONDS = Date.UTC(2100, 0, 1) / 1000;

function pinClock(secondsIntoWindow: number): void {
  vi.spyOn(Date, 'now').mockReturnValue((WINDOW_START_SECONDS + secondsIntoWindow) * 1000);
}

async function expiryOf(key: string): Promise<number> {
  return Number((await redis.exec(['redis-cli', 'EXPIRETIME', key])).output.trim());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createUpstashRateLimiter', () => {
  it('allows up to the limit, then denies with the seconds left in the window', async () => {
    pinClock(10);
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
    expect(results[2]?.retryAfterSeconds).toBe(50);
  });

  it('keeps separate counters per key and per policy', async () => {
    pinClock(10);
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

  it('expires each counter at the end of its window, even in its last instant', async () => {
    const limiter = createUpstashRateLimiter({
      url,
      token: TOKEN,
      policies: {
        public: { requests: 5, windowSeconds: 30 },
        write: { requests: 5, windowSeconds: 30 },
      },
    });
    const firstEnd = WINDOW_START_SECONDS + 30;
    const secondEnd = WINDOW_START_SECONDS + 60;

    pinClock(29.999);
    expect((await limiter.limit('public', 'key-ttl')).retryAfterSeconds).toBe(1);
    expect(await expiryOf(`acrux:public:key-ttl:${firstEnd}`)).toBe(firstEnd);

    pinClock(30);
    expect((await limiter.limit('public', 'key-ttl')).retryAfterSeconds).toBe(30);
    expect(await expiryOf(`acrux:public:key-ttl:${secondEnd}`)).toBe(secondEnd);
  });

  it('starts a new count when the window ends', async () => {
    const limiter = createUpstashRateLimiter({
      url,
      token: TOKEN,
      policies: {
        public: { requests: 1, windowSeconds: 30 },
        write: { requests: 1, windowSeconds: 30 },
      },
    });
    pinClock(29.999);
    expect((await limiter.limit('public', 'key-roll')).allowed).toBe(true);
    expect((await limiter.limit('public', 'key-roll')).allowed).toBe(false);
    pinClock(30);
    expect((await limiter.limit('public', 'key-roll')).allowed).toBe(true);
  });

  it('gives up after one second when the store does not answer', async () => {
    const server = createServer(() => {});
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const limiter = createUpstashRateLimiter({ url: `http://127.0.0.1:${port}`, token: TOKEN });
      const started = Date.now();
      await expect(limiter.limit('public', 'key-slow')).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it('aborts the request to a store that does not answer', async () => {
    let closed = false;
    const server = createServer((request) => {
      request.on('close', () => {
        closed = true;
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const limiter = createUpstashRateLimiter({ url: `http://127.0.0.1:${port}`, token: TOKEN });
      await expect(limiter.limit('public', 'key-abort')).rejects.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(closed).toBe(true);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it('treats a malformed store answer as a failure, not as a denial', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify([{ result: 'abc' }, { result: 1 }]));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const limiter = createUpstashRateLimiter({ url: `http://127.0.0.1:${port}`, token: TOKEN });
      await expect(limiter.limit('public', 'key-bad')).rejects.toThrow('no usable answer');
    } finally {
      server.close();
    }
  });
});
