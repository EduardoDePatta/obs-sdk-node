# traceorb-node

Node.js SDK for [Traceorb](https://traceorb.com). Send request traces from your API to your Traceorb workspace.

## Install

```bash
npm install traceorb-node
```

## Configure

Create a write key after you have a workspace. Sign up at [traceorb.com](https://traceorb.com). Set these in your app:

```
OBS_INGEST_URL=https://api.traceorb.com/v1/ingest
OBS_WRITE_KEY=
```

The SDK does not read the environment by itself. Pass the values into `createClient`.

## Usage

```js
import express from 'express';
import { createClient, expressMiddleware } from 'traceorb-node';

const ingestUrl = process.env.OBS_INGEST_URL;
const writeKey = process.env.OBS_WRITE_KEY;
if (ingestUrl === undefined || ingestUrl === '') {
  throw new Error('OBS_INGEST_URL is required');
}
if (writeKey === undefined || writeKey === '') {
  throw new Error('OBS_WRITE_KEY is required');
}

const app = express();
const obs = createClient({
  ingestUrl,
  writeKey,
  service: 'orders-api',
  env: process.env.NODE_ENV ?? 'production',
});

app.use(express.json());
app.use(
  expressMiddleware(obs, {
    resolveTags(req) {
      return { tenant: String(req.headers['x-tenant'] ?? '') };
    },
  }),
);
```

CommonJS: `require('traceorb-node')`.

If Traceorb is unreachable, your HTTP request still completes. Headers and body fields named `authorization`, `cookie`, `set-cookie`, `password`, `token`, `secret`, `api_key`, and `apikey` are replaced with `[redacted]`.

Fastify:

```js
import Fastify from 'fastify';
import { createClient, fastifyMiddleware } from 'traceorb-node';

const ingestUrl = process.env.OBS_INGEST_URL;
const writeKey = process.env.OBS_WRITE_KEY;
if (ingestUrl === undefined || ingestUrl === '') {
  throw new Error('OBS_INGEST_URL is required');
}
if (writeKey === undefined || writeKey === '') {
  throw new Error('OBS_WRITE_KEY is required');
}

const app = Fastify();
const obs = createClient({
  ingestUrl,
  writeKey,
  service: 'orders-api',
  env: process.env.NODE_ENV ?? 'production',
});

fastifyMiddleware(app, obs, {
  skip(request) {
    return request.url === '/health';
  },
});
```

Inside a request:

```js
obs.step('db.query', { table: 'orders' });
obs.setTags({ city: '4' });
obs.redact(['ssn']);
```

## Extra redaction

The built-in names always apply. Add more field names in any of these places. Names are case-insensitive. They apply to headers, query, and bodies.

On the client, for every request:

```js
const obs = createClient({
  ingestUrl,
  writeKey,
  service: 'orders-api',
  env: process.env.NODE_ENV ?? 'production',
  redactKeys: ['email', 'cpf'],
});
```

On the middleware:

```js
app.use(
  expressMiddleware(obs, {
    redactKeys: ['email', 'cpf'],
    resolveRedactKeys(req) {
      return [String(req.headers['x-redact'] ?? '')];
    },
  }),
);
```

Fastify takes the same `redactKeys` and `resolveRedactKeys` options.

Inside a handler, for that request only:

```js
obs.redact(['ssn']);
```
