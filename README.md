# traceorb-node

Node.js SDK for [Traceorb](https://app.traceorb.com). Send request traces from your API to your Traceorb workspace.

## Install

```bash
npm install traceorb-node
```

## Configure

Create a write key in the Traceorb panel. Set these in your app:

```
OBS_INGEST_URL=https://api.traceorb.com/v1/ingest
OBS_WRITE_KEY=
```

The SDK does not read the environment by itself. Pass the values into `createClient`.

## Usage

```js
import { createClient, expressMiddleware } from 'traceorb-node';

const ingestUrl = process.env.OBS_INGEST_URL;
const writeKey = process.env.OBS_WRITE_KEY;
if (!ingestUrl || !writeKey) {
  console.warn('traceorb-node skipped (OBS_INGEST_URL / OBS_WRITE_KEY unset)');
} else {
  const obs = createClient({
    ingestUrl,
    writeKey,
    service: 'my-api',
    env: process.env.NODE_ENV ?? 'development',
  });

  app.use(
    expressMiddleware(obs, {
      resolveTags(req) {
        return { tenant: req.tenant ?? '' };
      },
    }),
  );
}
```

CommonJS: `require('traceorb-node')`.

If Traceorb is unreachable, your HTTP request still completes. Sensitive headers such as `authorization` and `cookie` are not sent.

Inside a request:

```js
obs.step('db.query', { table: 'orders' });
obs.setTags({ city: '4' });
```
