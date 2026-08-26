import { formatAuthors } from "@/lib/format-authors";

type ContentsBookHeadingProps = {
  authors: string[] | null | undefined;
  title: string;
};

export function ContentsBookHeading({
  authors,
  title,
}: ContentsBookHeadingProps) {
  return (
    <>
      <h2 className="font-reader text-[2rem] leading-[0.95] tracking-[-0.04em] text-title">
        {title}
      </h2>
      <p className="mt-4 font-ui text-[0.82rem] uppercase tracking-[0.18em] text-title/70">
        {formatAuthors(authors)}
      </p>
    </>
  );
}
