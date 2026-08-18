import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function withJsExtension(specifier) {
  if (!specifier.startsWith('.')) {
    return specifier;
  }

  if (specifier.endsWith('.js') || specifier.endsWith('.json')) {
    return specifier;
  }

  return `${specifier}.js`;
}

function rewriteSource(source) {
  return source.replace(
    /(from\s+|import\s*\(\s*)(['"])(\.[^'"]+)\2/g,
    (match, prefix, quote, specifier) =>
      `${prefix}${quote}${withJsExtension(specifier)}${quote}`,
  );
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }

    if (!path.endsWith('.js')) {
      continue;
    }

    const source = await readFile(path, 'utf8');
    await writeFile(path, rewriteSource(source));
  }
}

await walk(join(process.cwd(), 'dist'));
