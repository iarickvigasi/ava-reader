import type { EpubAsset } from './archive';
import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from './xml-utils';
import { unsupportedSourceStructure } from './blocks/unsupported-source-structure';

type AssetResolver = (path: string) => Promise<EpubAsset | null>;
// Resolve archive images before parsing can drop a missing image. Reuse the bytes
// during normalization; this resolver never fetches external image resources.
export async function preflightRequiredImages(
  nodes: OrderedNode[],
  resolveAsset: AssetResolver,
): Promise<AssetResolver> {
  const cached = new Map<string, Promise<EpubAsset | null>>();
  const resolve: AssetResolver = (path) => {
    let pending = cached.get(path);
    if (!pending) {
      pending = resolveAsset(path);
      cached.set(path, pending);
    }
    return pending;
  };
  async function visit(
    nodes: OrderedNode[],
    path: number[],
    parentAttrs: Record<string, string>,
  ): Promise<void> {
    for (const [index, node] of nodes.entries()) {
      const sourcePath = [...path, index];
      const attrs = getNodeAttributes(node);
      if (getNodeTagName(node) === 'img') {
        const src = attrs['@_src'];
        if (
          !src ||
          /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src) ||
          !(await resolve(src))
        )
          unsupportedSourceStructure('EPUB_REQUIRED_IMAGE_MISSING', node, {
            sourcePath,
            attrs: parentAttrs,
          });
      }
      await visit(getNodeChildren(node), sourcePath, attrs);
    }
  }
  await visit(nodes, [], {});
  return resolve;
}
