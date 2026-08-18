import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await writeFile(
  join(process.cwd(), 'dist-cjs', 'package.json'),
  `${JSON.stringify({ type: 'commonjs' })}\n`,
);
