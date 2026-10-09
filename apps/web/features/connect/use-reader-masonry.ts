"use client";

import { useLayoutEffect, useRef } from "react";
import type { PublishedReader } from "@/lib/api-types/published-reader";
import { masonryColumns, masonryLayout } from "./masonry-layout";

export function useReaderMasonry(readers: PublishedReader[]) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const cards = Array.from(container.children) as HTMLElement[];
    const arrange = () => arrangeCards(container, cards);
    arrange();
    const observer = new ResizeObserver(arrange);
    observer.observe(container);
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [readers]);
  return ref;
}

function arrangeCards(container: HTMLElement, cards: HTMLElement[]) {
  const width = container.clientWidth;
  if (!width) return;
  const { cardWidth } = masonryColumns(width);
  cards.forEach((card) => {
    card.style.width = `${cardWidth}px`;
  });
  const { positions, height } = masonryLayout(
    width,
    cards.map((card) => card.getBoundingClientRect().height),
  );
  cards.forEach((card, index) => {
    card.style.position = "absolute";
    card.style.left = `${positions[index].left}px`;
    card.style.top = `${positions[index].top}px`;
  });
  container.style.height = `${height}px`;
}
