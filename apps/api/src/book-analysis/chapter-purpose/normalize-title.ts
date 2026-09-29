export const UNTITLED = '(untitled)';

const MAX_TITLE_LENGTH = 80;

// Spine filenames and generic section markers that carry no meaning.
const FILENAME_PATTERN = /\.(x?html?|xml)$/i;
const MACHINE_LABEL_PATTERN =
  /^(section|split|part|item|text|page)[\s_.-]*\d+$/i;
const NUMERIC_ONLY_PATTERN = /^[\d\s.:_-]+$/;

// Generated opening excerpts and legacy numbered labels are not authored titles.
export function normalizeChapterTitle(input: {
  label: null | string;
  spineIndex: number;
  title: null | string;
}): string {
  const synthesized = `chapter ${input.spineIndex + 1}`;

  for (const candidate of [input.title, input.label]) {
    const trimmed = candidate?.trim();

    if (!trimmed) {
      continue;
    }

    if (
      trimmed.toLowerCase() === synthesized ||
      (trimmed.startsWith(`${input.spineIndex + 1}. `) && trimmed.endsWith('…'))
    ) {
      continue;
    }

    if (isMachineGenerated(trimmed)) {
      continue;
    }

    return trimmed.length > MAX_TITLE_LENGTH
      ? `${trimmed.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
      : trimmed;
  }

  return UNTITLED;
}

function isMachineGenerated(title: string) {
  return (
    FILENAME_PATTERN.test(title) ||
    MACHINE_LABEL_PATTERN.test(title) ||
    NUMERIC_ONLY_PATTERN.test(title)
  );
}
