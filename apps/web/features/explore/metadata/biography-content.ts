export function biographyContent(biography: string) {
  const sources: string[] = [];
  const references = new Map<string, string>();
  const text = biography.replace(
    /^\s*\[([^\]]+)\]:\s*(https?:\/\/\S+)\s*$/gm,
    (line, id: string, href: string) => {
      try {
        const url = new URL(href);
        if (!["http:", "https:"].includes(url.protocol)) return line;
        references.set(id.toLowerCase(), url.href);
        if (!sources.includes(url.href)) sources.push(url.href);
        return "";
      } catch {
        return line;
      }
    },
  );
  return {
    text: text
      .replace(/\(\s*\[Source\]\[([^\]]+)\]\.?\s*\)/gi, (match, id: string) =>
        references.has(id.toLowerCase()) ? "" : match,
      )
      .replace(
        /\[([^\]]+)\]\[([^\]]+)\]/g,
        (match, label: string, id: string) =>
          references.has(id.toLowerCase()) ? label : match,
      )
      .trim(),
    sources,
  };
}
