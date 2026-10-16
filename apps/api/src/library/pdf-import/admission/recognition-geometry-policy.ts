export const RECOGNITION_GEOMETRY_REPAIR_POLICY =
  'ava-recognition-geometry-repair-1' as const;
export const RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY =
  'ava-recognition-geometry-repair-2' as const;
export type RecognitionRepairPolicy =
  | typeof RECOGNITION_GEOMETRY_REPAIR_POLICY
  | typeof RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY;
