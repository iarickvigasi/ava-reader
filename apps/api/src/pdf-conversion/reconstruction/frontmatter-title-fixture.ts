import task from './fixtures/frontmatter-title-task.json';
import response from './fixtures/frontmatter-title-response.json';
import { validatePacket } from './validate-packet';

// Authored source comparison, accepted by the Python Title2 task/response validators.
export const titleTask = validatePacket(
  'FrontmatterTitleTask',
  structuredClone(task),
);
export const titleResponse = validatePacket(
  'FrontmatterTitleResponse',
  structuredClone(response),
);
