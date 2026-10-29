import type { ClassicSeed } from './types';

export function interleaveClassics(
  groups: readonly (readonly ClassicSeed[])[],
): ClassicSeed[] {
  return Array.from(
    { length: Math.max(...groups.map((seeds) => seeds.length)) },
    (_, index) => groups.flatMap((seeds) => seeds.slice(index, index + 1)),
  ).flat();
}
