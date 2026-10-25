import { useState } from "react";

const BOOKS_PER_PAGE = 24;

export function useProgressiveBooks<T>(books: T[]) {
  const [limit, setLimit] = useState(BOOKS_PER_PAGE);
  return {
    visible: books.slice(0, limit),
    hasMore: books.length > limit,
    showMore: () => setLimit((current) => current + BOOKS_PER_PAGE),
  };
}
