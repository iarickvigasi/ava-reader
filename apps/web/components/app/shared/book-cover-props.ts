export type BookCoverProps = {
  alt: string;
  className?: string;
  libraryItemId?: null | string;
  ratio?: "book" | "audiobook";
  src: string | null;
  title: string;
};
