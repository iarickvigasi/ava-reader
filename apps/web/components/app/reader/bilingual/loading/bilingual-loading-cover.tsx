import type { ReadyReaderProps } from "../../shared/types";
import { ReaderLoadingCover } from "../../view/reader-loading-cover";

export function BilingualLoadingCover({
  props,
  reader,
}: {
  props: ReadyReaderProps;
  reader: { page: unknown; measurement: unknown };
}) {
  return (
    <ReaderLoadingCover
      book={props.payload.book}
      loading={
        props.isBootstrapping ||
        props.isLoadingChapter ||
        !reader.page ||
        !reader.measurement
      }
    />
  );
}
