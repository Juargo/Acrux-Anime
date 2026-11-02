import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
} from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUpstashFixedWindow } from './rate-limit';

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

describe('createUpstashFixedWindow', () => {
  it('allows up to the limit per key, then denies with the seconds left', async () => {
    const limit = createUpstashFixedWindow({ url, token: TOKEN, requests: 2, windowSeconds: 600 });
    const results = [];
    for (let attempt = 0; attempt < 3; attempt++) results.push(await limit('key-a'));
    expect(results.map((result) => result.allowed)).toEqual([true, true, false]);
    expect(results[2]?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(results[2]?.retryAfterSeconds).toBeLessThanOrEqual(600);
    expect((await limit('key-b')).allowed).toBe(true);
  });

  it('gives up after one second when the store does not answer', async () => {
    const server = createServer(() => {});
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const limit = createUpstashFixedWindow({
        url: `http://127.0.0.1:${port}`,
        token: TOKEN,
        requests: 5,
        windowSeconds: 600,
      });
      const started = Date.now();
      await expect(limit('key-slow')).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(1500);
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
      const limiter = createUpstashFixedWindow({
        url: `http://127.0.0.1:${port}`,
        token: TOKEN,
        requests: 5,
        windowSeconds: 600,
      });
      await expect(limiter('key-abort')).rejects.toThrow();
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
      const limiter = createUpstashFixedWindow({
        url: `http://127.0.0.1:${port}`,
        token: TOKEN,
        requests: 5,
        windowSeconds: 600,
      });
      await expect(limiter('key-bad')).rejects.toThrow('no usable answer');
    } finally {
      server.close();
    }
  });
});
