import type {
  InlineSpan,
  Style,
  TextValue,
} from "@/lib/api-types/canonical-reader.generated";

// Priority is exactly the former stable (start ascending, end descending) sort.
// Visit endpoints and active spans, rather than scanning every inactive span.
export function* inlineIntervals(
  content: TextValue,
  styles: Map<string, Style>,
) {
  const spans = [...(content.spans ?? [])].sort(
    (a, b) => a.start - b.start || b.end - a.end,
  );
  const empty: Style = { id: "inline" };
  const emptyStyle = { declarations: {}, single: empty };
  const prepared = new Map<
    string,
    { declarations: Partial<Style>; single: Style }
  >();
  const selected = spans.map((span) => {
    if (!span.style_id) return emptyStyle;
    let style = prepared.get(span.style_id);
    if (!style) {
      const declarations = Object.fromEntries(
        Object.entries(styles.get(span.style_id) ?? {}).filter(
          ([, value]) => value != null,
        ),
      );
      style = { declarations, single: { ...empty, ...declarations } };
      prepared.set(span.style_id, style);
    }
    return style;
  });
  const events = new Map<number, { starts: number[]; ends: number[] }>();
  const event = (offset: number) => {
    const value = events.get(offset) ?? { starts: [], ends: [] };
    events.set(offset, value);
    return value;
  };
  event(0);
  event(content.codepoint_utf16.length - 1);
  spans.forEach((span, rank) => {
    event(span.start);
    event(span.end);
    if (span.start >= span.end) return;
    event(span.start).starts.push(rank);
    event(span.end).ends.push(rank);
  });
  const edges = [...events.keys()].sort((a, b) => a - b);
  const active: number[] = [];
  for (let index = 0; index < edges.length - 1; index += 1) {
    const start = edges[index];
    const change = events.get(start)!;
    for (const rank of change.ends) {
      const position = active.indexOf(rank);
      if (position >= 0) active.splice(position, 1);
    }
    for (const rank of change.starts) {
      let low = 0;
      let high = active.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (active[middle] < rank) low = middle + 1;
        else high = middle;
      }
      active.splice(low, 0, rank);
    }
    let presentation: Style =
      active.length === 1 ? selected[active[0]].single : empty;
    let linked: InlineSpan | undefined;
    for (const rank of active) {
      if (active.length > 1)
        presentation = { ...presentation, ...selected[rank].declarations };
      if (spans[rank].link) linked = spans[rank];
    }
    yield { start, end: edges[index + 1], presentation, linked };
  }
}
