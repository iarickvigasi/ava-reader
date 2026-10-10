import { ContractError } from '../contracts/contract-error';
import type {
  ReaderPackageV3,
  TableCell,
} from '../contracts/generated/ava-reader-3';
import type { ValidatedContract } from '../contracts/types';

export function resolveAddress(
  reader: ValidatedContract<ReaderPackageV3>,
  address: { resourcePath: string; fragment: string },
) {
  const found = reader.book.addresses.filter(
    (entry) =>
      entry.resource_path === address.resourcePath &&
      entry.fragment === address.fragment,
  );
  if (found.length !== 1) throw new ContractError('INVALID_CONTRACT');
  const target = found[0].target;
  type Node = ReaderPackageV3['book']['blocks'][number] | TableCell;
  const nodes = reader.book.blocks.flatMap<Node>((b) =>
    b.kind === 'table' ? [b, ...b.cells] : [b],
  );
  const node = nodes.find((b) => b.id === target.block_id);
  if (!node) throw new ContractError('INVALID_CONTRACT');
  const content = 'content' in node ? node.content : null;
  return {
    finalContentId: reader.final_content_id,
    ...target,
    utf16Offset: content ? content.codepoint_utf16[target.offset] : 0,
    textSha256: content?.sha256 ?? null,
  };
}
