import { createHash } from 'node:crypto';
import type { FrontmatterTitleTask } from './generated/FrontmatterTitleTask';
import { PdfRuntimeError } from '../runtime/runtime-error';

const within = (
  box: FrontmatterTitleTask['nodes'][0]['box'],
  width: number,
  height: number,
) =>
  box.coordinate_space === 'page_points_top_left' &&
  box.x0 >= 0 &&
  box.y0 >= 0 &&
  box.x1 > box.x0 &&
  box.y1 > box.y0 &&
  box.x1 <= width &&
  box.y1 <= height;

export function frontmatterTitleEvidence(
  task: FrontmatterTitleTask,
  id: string,
) {
  const node = task.nodes.find((value) => value.id === id);
  if (!node) throw new PdfRuntimeError('SOURCE_MISMATCH');
  const title = task.crops.filter(
    (crop) => crop.part === 'title' && crop.node_id === id,
  );
  const context = task.crops.filter(
    (crop) => crop.part === 'context' && crop.page === node.page,
  );
  if (title.length !== 1 || context.length !== 1)
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  return [title[0].id, context[0].id];
}

export function frontmatterTitleImage(
  task: FrontmatterTitleTask,
  sourceSha256: string,
) {
  if (
    task.image.byte_length > 4 * 1024 ** 2 ||
    task.image.width > 4096 ||
    task.image.height > 4096
  )
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const bytes = Buffer.from(task.image.base64, 'base64');
  const sha = (value: Buffer | string) =>
    createHash('sha256').update(value).digest('hex');
  if (
    task.source_sha256 !== sourceSha256 ||
    bytes.length !== task.image.byte_length ||
    bytes.toString('base64') !== task.image.base64 ||
    sha(bytes) !== task.image.sha256 ||
    new Set(task.nodes.map((node) => node.id)).size !== task.nodes.length ||
    new Set(task.pages.map((page) => page.page)).size !== task.pages.length ||
    new Set(task.crops.map((crop) => crop.id)).size !== task.crops.length ||
    !task.pages.some((page) => page.page === 1) ||
    task.crops.length !== task.nodes.length + task.pages.length
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  for (const page of task.pages) {
    if (
      page.page > task.source_page_count ||
      task.crops.filter(
        (crop) => crop.part === 'context' && crop.page === page.page,
      ).length !== 1
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
  }
  for (const node of task.nodes) {
    const page = task.pages.find((value) => value.page === node.page);
    if (
      !page ||
      !within(node.box, node.page_width_pt, node.page_height_pt) ||
      sha(node.text) !== node.text_sha256 ||
      node.render_sha256 !== page.render_sha256 ||
      node.page_width_pt !== page.page_width_pt ||
      node.page_height_pt !== page.page_height_pt
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    frontmatterTitleEvidence(task, node.id);
  }
  for (const crop of task.crops) {
    const page = task.pages.find((value) => value.page === crop.page);
    const node = task.nodes.find((value) => value.id === crop.node_id);
    const [x0, y0, x1, y1] = crop.image_box;
    const box = crop.source_box;
    if (
      !page ||
      crop.render_sha256 !== page.render_sha256 ||
      (crop.part === 'title'
        ? !node || node.page !== crop.page
        : crop.node_id !== null) ||
      x0 < 0 ||
      y0 < 0 ||
      x1 <= x0 ||
      y1 <= y0 ||
      x1 > task.image.width ||
      y1 > task.image.height ||
      !within(box, page.page_width_pt, page.page_height_pt)
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
  }
  return bytes;
}
