import { envelope } from './exchange-test-fixture';
export const native = {
  schema_version: 'ava-native-structure-task-1',
  task_id: 'native-one',
};
export const ocr = {
  schema_version: 'ava-recognition-task-1',
  task_id: 'ocr-one',
};
export const page = {
  schema_version: 'ava-prepare-result-3',
  tasks: [native, ocr],
};
export const nativeFrame = (sequence = 2) => ({
  ...envelope(sequence),
  schema_version: 'ava-native-structure-exchange-1' as const,
  kind: 'native_structure' as const,
  payload: { task_id: native.task_id },
});
