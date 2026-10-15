// Founder-approved cumulative exception; aliases and all other exact models retain $10.
export function modelBudgetCeiling(scopeKey: string): bigint {
  return scopeKey === 'google/gemini-3.8-flash'
    ? 15_000_000_000n
    : 10_000_000_000n;
}
