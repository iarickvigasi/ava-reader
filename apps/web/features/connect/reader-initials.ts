export function readerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const names = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return names
    .map((part) => Array.from(part)[0])
    .join("")
    .toLocaleUpperCase();
}
