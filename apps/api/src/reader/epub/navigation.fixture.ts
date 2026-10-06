import { XMLBuilder } from 'fast-xml-parser';

export function navigationFixture(chapterCount: number): string {
  return new XMLBuilder({ ignoreAttributes: false }).build({
    html: {
      '@_lang': 'en',
      '@_xmlns': 'http://www.w3.org/1999/xhtml',
      '@_xmlns:epub': 'http://www.idpf.org/2007/ops',
      body: {
        nav: {
          '@_epub:type': 'toc',
          ol: {
            li: Array.from({ length: chapterCount }, (_, i) => ({
              a: { '@_href': `${i}.xhtml`, '#text': `Section ${i}` },
            })),
          },
        },
      },
    },
  });
}
