// Cohesive builders share one context; the normalizer owns source dispatch.
export { buildInlineBlock } from './build-inline-block';
export { buildImageBlock } from './build-image-block';
export { buildSeparatorBlock } from './build-separator-block';
export { buildListBlock } from './build-list-block';
export { buildTableBlock } from './build-table-block';
export { isBlockContainerTag, isInlineContainerTag } from './block-tags';
