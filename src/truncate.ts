export default function truncateField({
  value,
  maxBytes,
}: {
  value: string;
  maxBytes: number;
}): string {
  const encoded = Buffer.from(value, 'utf8');
  if (encoded.byteLength <= maxBytes) {
    return value;
  }

  let end = maxBytes;
  while (end > 0) {
    const byte = encoded[end];
    if (byte === undefined) {
      break;
    }

    if ((byte & 0xc0) !== 0x80) {
      break;
    }

    end -= 1;
  }

  return encoded.subarray(0, end).toString('utf8');
}
