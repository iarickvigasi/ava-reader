export function epubSection(type: string, content: string) {
  // EPUB structural semantics use epub:type, not invented ARIA roles.
  //noinspection HtmlUnknownAttribute
  // language=XML
  return `<section xmlns:epub="http://www.idpf.org/2007/ops" epub:type="${type}">${content}</section>`;
}
