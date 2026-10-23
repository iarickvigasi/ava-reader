export function normalizeIsbn(value: string): string | undefined {
  const isbn = value.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce(
      (total, digit, index) =>
        total + (digit === 'X' ? 10 : Number(digit)) * (10 - index),
      0,
    );
    if (sum % 11) return undefined;
    const prefix = `978${isbn.slice(0, 9)}`;
    return `${prefix}${checkDigit(prefix)}`;
  }
  if (!/^97[89]\d{10}$/.test(isbn)) return undefined;
  return Number(isbn[12]) === checkDigit(isbn.slice(0, 12)) ? isbn : undefined;
}

function checkDigit(prefix: string) {
  const sum = [...prefix].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return (10 - (sum % 10)) % 10;
}
