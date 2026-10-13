import {
  capturedSourceLayoutPolicy,
  capturedSourceStructurePolicy,
  capturedSourceNormalizationPolicy,
  capturedRecognitionRepairPolicy,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
} from './profile';

export function capturedSourcePolicies(
  profileId: string,
  configSha256: unknown,
) {
  const recognitionRepairPolicy = capturedRecognitionRepairPolicy(
    profileId,
    configSha256,
  );
  if (recognitionRepairPolicy)
    return {
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy,
    };
  return {
    sourceLayoutPolicy: capturedSourceLayoutPolicy(profileId, configSha256),
    sourceStructurePolicy: capturedSourceStructurePolicy(
      profileId,
      configSha256,
    ),
    sourceNormalizationPolicy: capturedSourceNormalizationPolicy(
      profileId,
      configSha256,
    ),
  };
}
