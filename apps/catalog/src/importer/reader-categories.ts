import { CATEGORY_ALIASES } from './category-aliases';

export const CATEGORY_VERSION = 2;
export const CATEGORY_KEYS = Object.keys(CATEGORY_ALIASES);
const normalize = (label: string) =>
  label
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const mappings = Object.entries(CATEGORY_ALIASES).map(([key, aliases]) => ({
  key,
  labels: new Set<string>(aliases.map(normalize)),
}));

export function readerCategories(subjects: string[]) {
  const labels = new Set(subjects.map(normalize));
  return mappings
    .filter((mapping) => [...mapping.labels].some((label) => labels.has(label)))
    .map(({ key }) => key);
}
