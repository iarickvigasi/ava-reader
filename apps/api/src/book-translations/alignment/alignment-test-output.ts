import { alignmentTokens } from './alignment-tokens';
import { resolveAlignment } from './resolve-alignment';
import type { AlignmentOutput } from './alignment-output';

type IdOutput = {
  id: string;
  groups: { source: number[]; translation: number[] }[];
};
export function echoedOutput(
  output: IdOutput,
  source: string,
  translation: string,
): AlignmentOutput {
  const s = alignmentTokens(source, null);
  const t = alignmentTokens(translation, null);
  return {
    ...output,
    groups: output.groups.map((group) => ({
      ...group,
      sourceText: group.source.map((id) => s[id]?.text ?? 'invalid'),
      translationText: group.translation.map((id) => t[id]?.text ?? 'invalid'),
    })),
  };
}
export function resolveTestAlignment(
  output: IdOutput,
  ...args: Parameters<typeof resolveAlignment> extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return resolveAlignment(echoedOutput(output, args[0], args[1]), ...args);
}
