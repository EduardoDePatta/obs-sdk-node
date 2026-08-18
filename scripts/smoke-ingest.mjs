import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`missing ${name}`);
  }

  return value;
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const distIndex = pathToFileURL(join(here, '../dist/index.js')).href;
const { createClient } = await import(distIndex);

const apiBase = process.env.OBS_API_BASE ?? 'http://127.0.0.1:13000';
const writeKey = requireEnv('OBS_WRITE_KEY');
const requestId = randomUUID();
let ingestStatus = 0;
let dropped;

const obs = createClient({
  ingestUrl: `${apiBase}/v1/ingest`,
  writeKey,
  service: 'obs-sdk-smoke',
  env: 'hml',
  flushIntervalMs: 0,
  onDrop(reason) {
    dropped = reason;
  },
  async fetch(url, init) {
    const response = await fetch(url, init);
    ingestStatus = response.status;
    return response;
  },
});

obs.enqueue({
  requestId,
  timestamp: new Date().toISOString(),
  method: 'GET',
  path: '/sdk-smoke',
  routePattern: '/sdk-smoke',
  statusCode: 200,
  durationMs: 12,
  service: 'obs-sdk-smoke',
  env: 'hml',
  tags: { flow: 'smoke' },
  events: [
    {
      seq: 0,
      timestamp: new Date().toISOString(),
      name: 'smoke.ping',
      level: 'info',
    },
  ],
});

await obs.flush();
obs.close();

const email = process.env.OBS_LOGIN_EMAIL;
const password = process.env.OBS_LOGIN_PASSWORD;
let loginStatus = 0;
let queryStatus = 0;
let found = false;
let listedPath;

if (email !== undefined && email !== '' && password !== undefined && password !== '') {
  const login = await fetch(`${apiBase}/v1/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  loginStatus = login.status;
  const setCookie = login.headers.getSetCookie();
  const cookie = setCookie.find(value => value.startsWith('obs_session='));
  if (cookie !== undefined) {
    const cookieHeader = cookie.split(';')[0] ?? cookie;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const listed = await fetch(`${apiBase}/v1/requests?requestId=${requestId}`, {
        headers: { cookie: cookieHeader },
      });
      queryStatus = listed.status;
      if (listed.status === 200) {
        const body = await listed.json();
        const first = body.requests?.[0];
        if (first !== undefined) {
          found = true;
          listedPath = first.path;
          break;
        }
      }

      await sleep(500);
    }
  }
}

console.log(
  JSON.stringify({
    ingestStatus,
    dropped: dropped ?? null,
    requestId,
    loginStatus,
    queryStatus,
    found,
    listedPath: listedPath ?? null,
  }),
);
