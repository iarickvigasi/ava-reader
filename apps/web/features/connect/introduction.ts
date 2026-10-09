export const INTRODUCTION_MINIMUM = 50;
export const INTRODUCTION_LIMIT = 180;

export function introductionLength(value: string): number {
  return Array.from(value).length;
}

export function clampIntroduction(value: string): string {
  return Array.from(value).slice(0, INTRODUCTION_LIMIT).join("");
}

export function isPublishableIntroduction(value: string): boolean {
  const length = introductionLength(value.trim());
  return length >= INTRODUCTION_MINIMUM && length <= INTRODUCTION_LIMIT;
}
