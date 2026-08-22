import { MAX_EVENTS_PER_REQUEST } from './config';
import type { RequestStore } from './context';
import type { IngestEvent } from './types';

const MAX_ERROR_MESSAGE_CHARS = 512;
const MAX_STACK_CHARS = 2048;
const PAREN_FRAME = /\((.*):(\d+):\d+\)/;
const AT_FRAME = /at (.*):(\d+):\d+/;

function truncateChars(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return value.slice(0, maxChars);
}

function shouldSetErrorMessage(store: RequestStore): boolean {
  if (store.errorMessage === undefined) {
    return true;
  }

  if (store.errorMessage === '') {
    return true;
  }

  return false;
}

function resolveErrorFields(err: unknown): {
  message: string;
  name: string;
  stack: string | undefined;
} {
  if (!(err instanceof Error)) {
    return {
      message: 'Error',
      name: 'Error',
      stack: undefined,
    };
  }

  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
  };
}

function parseFrame(line: string): { file: string; line: string } | undefined {
  const paren = PAREN_FRAME.exec(line);
  if (paren !== null) {
    const file = paren[1];
    const lineNo = paren[2];
    if (file === undefined || lineNo === undefined) {
      return undefined;
    }

    return { file, line: lineNo };
  }

  const atMatch = AT_FRAME.exec(line);
  if (atMatch === null) {
    return undefined;
  }

  const file = atMatch[1];
  const lineNo = atMatch[2];
  if (file === undefined || lineNo === undefined) {
    return undefined;
  }

  return { file, line: lineNo };
}

function resolveAppFrame(
  stack: string | undefined,
): { file: string; line: string } | undefined {
  if (stack === undefined || stack === '') {
    return undefined;
  }

  const lines = stack.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('node_modules')) {
      continue;
    }

    if (trimmed.startsWith('node:')) {
      continue;
    }

    const frame = parseFrame(trimmed);
    if (frame === undefined) {
      continue;
    }

    if (frame.file.startsWith('node:')) {
      continue;
    }

    if (frame.file.includes('node_modules')) {
      continue;
    }

    if (frame.file === '') {
      continue;
    }

    if (frame.line === '') {
      continue;
    }

    return frame;
  }

  return undefined;
}

function buildAttrs(fields: {
  name: string;
  stack: string | undefined;
}): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};

  if (fields.name !== '') {
    attrs.type = fields.name;
  }

  if (fields.stack !== undefined && fields.stack !== '') {
    attrs.stack = truncateChars(fields.stack, MAX_STACK_CHARS);
  }

  const frame = resolveAppFrame(fields.stack);
  if (frame !== undefined) {
    attrs.file = frame.file;
    attrs.line = frame.line;
  }

  if (Object.keys(attrs).length === 0) {
    return undefined;
  }

  return attrs;
}

export default function recordUnhandledError(input: {
  store: RequestStore;
  err: unknown;
}): void {
  const fields = resolveErrorFields(input.err);

  if (shouldSetErrorMessage(input.store)) {
    input.store.errorMessage = truncateChars(
      fields.message,
      MAX_ERROR_MESSAGE_CHARS,
    );
  }

  if (input.store.events.length >= MAX_EVENTS_PER_REQUEST) {
    return;
  }

  const event: IngestEvent = {
    seq: input.store.events.length,
    timestamp: new Date().toISOString(),
    name: 'unhandled.error',
    level: 'error',
  };

  const attrs = buildAttrs(fields);
  if (attrs !== undefined) {
    event.attrs = attrs;
  }

  input.store.events.push(event);
}

export { recordUnhandledError };
