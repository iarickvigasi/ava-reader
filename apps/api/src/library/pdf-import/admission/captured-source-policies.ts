import {
  capturedSourceLayoutPolicy,
  capturedSourceStructurePolicy,
  capturedSourceNormalizationPolicy,
} from './profile';

export function capturedSourcePolicies(
  profileId: string,
  configSha256: unknown,
) {
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
