import { MAX_EXTRA_REDACT_KEYS } from './config';

export default function mergeRedactKeys(
  groups: Array<readonly string[] | undefined>,
): string[] {
  const seen: Record<string, true> = {};
  const output: string[] = [];

  for (const group of groups) {
    if (group === undefined) {
      continue;
    }

    for (const key of group) {
      const normalized = key.trim().toLowerCase();
      if (normalized === '') {
        continue;
      }

      if (seen[normalized] === true) {
        continue;
      }

      if (output.length >= MAX_EXTRA_REDACT_KEYS) {
        return output;
      }

      seen[normalized] = true;
      output.push(normalized);
    }
  }

  return output;
}
