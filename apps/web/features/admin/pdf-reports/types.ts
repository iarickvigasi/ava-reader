export type ReportValue =
  | null
  | boolean
  | number
  | string
  | ReportValue[]
  | ReportObject;
export type ReportObject = { [key: string]: ReportValue };
export type ReportData = {
  value: ReportObject;
  omittedFields: number;
  nextCursor: string | null;
};
export type ReportState =
  | "empty"
  | "ready"
  | "signIn"
  | "forbidden"
  | "accessChanged"
  | "unavailable"
  | "missing"
  | "invalid"
  | "changed"
  | "tooLarge";
