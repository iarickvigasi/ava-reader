export type EditorialKind = "works" | "authors" | "editions";
export type EditorialRecord = {
  id: string;
  revision: number;
  sourceMappings: Record<string, unknown>[];
} & Record<string, unknown>;
export type MetadataRow = Record<string, string | number | null>;
export type EditData = Record<string, unknown>;
export type EditFieldsProps = {
  data: EditData;
  change: (key: string, value: unknown) => void;
};
