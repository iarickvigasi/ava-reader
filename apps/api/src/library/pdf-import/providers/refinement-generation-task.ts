import { refinementProviderTask } from '../../../pdf-conversion/reconstruction/refinement-provider-task';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonHash } from './hash';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';

// Recover the exact factory-produced task; generation constraints cannot trust
// a loose flag map or model output to decide native versus OCR authority.
export function recoveredRefinementGenerationTask(task: ProviderTask) {
  try {
    const content = task.messages[1]?.content;
    if (
      typeof content === 'string' ||
      content?.length !== 2 ||
      content[0].type !== 'text' ||
      content[1].type !== 'image_url'
    )
      throw new Error();
    const context = JSON.parse(content[0].text) as Record<string, unknown>;
    const match =
      /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        content[1].image_url.url,
      );
    if (!match) throw new Error();
    const pixels = Buffer.from(match[2], 'base64');
    if (
      pixels.toString('base64') !== match[2] ||
      context.image_sha256 !== checksumBuffer(pixels)
    )
      throw new Error();
    const image = context.image as { width: number; height: number };
    const fields = { ...context };
    for (const key of [
      'image',
      'image_sha256',
      'evidence_instruction',
      'required_decision_evidence',
      'required_join_evidence',
      'required_metadata_evidence',
      'required_presentation_evidence',
      'required_feature_evidence',
    ])
      delete fields[key];
    const recovered = validatePacket(
      fields.schema_version === 'ava-book-refinement-task-5'
        ? 'PresentationRefinementTask'
        : fields.schema_version === 'ava-book-refinement-task-4'
          ? 'SourceFeatureTask'
          : 'BookRefinementTask',
      {
        ...fields,
        image: {
          width: image.width,
          height: image.height,
          media_type: match[1],
          sha256: checksumBuffer(pixels),
          byte_length: pixels.length,
          base64: match[2],
        },
      },
    );
    if (
      jsonHash(refinementProviderTask(recovered, task.sourceSha256)) !==
      jsonHash(task)
    )
      throw new Error();
    const nodes = new Map(recovered.nodes.map((node) => [node.id, node]));
    const metadataIds = recovered.metadata_ids ?? [];
    if (
      nodes.size !== recovered.nodes.length ||
      new Set(recovered.decision_ids).size !== recovered.decision_ids.length ||
      recovered.decision_ids.some((id) => !nodes.has(id)) ||
      new Set(metadataIds).size !== metadataIds.length ||
      metadataIds.some((id) => !nodes.has(id))
    )
      throw new Error();
    return recovered;
  } catch {
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  }
}

export function refinementGenerationTask(task: ProviderTask) {
  const recovered = recoveredRefinementGenerationTask(task);
  const nodes = new Map(recovered.nodes.map((node) => [node.id, node]));
  return recovered.decision_ids.map((id) => nodes.get(id)!);
}
