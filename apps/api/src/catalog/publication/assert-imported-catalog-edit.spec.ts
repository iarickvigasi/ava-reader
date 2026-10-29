import { assertImportedCatalogEdit } from './assert-imported-catalog-edit';
import { catalogPublicationChange } from './catalog-publication-change';
it('blocks legacy file/metadata replacement for an imported reading identity', () => {
  expect(() =>
    assertImportedCatalogEdit(
      { importKey: 'identity' },
      {},
      { sourceFile: [{}] },
    ),
  ).toThrow('new reading import');
  expect(() =>
    assertImportedCatalogEdit(
      { importKey: 'identity' },
      { language: 'fr' },
      {},
    ),
  ).toThrow('Explore');
  expect(() =>
    assertImportedCatalogEdit(
      { importKey: 'identity' },
      { status: 'ARCHIVED' },
      {},
    ),
  ).not.toThrow();
});
it('does not let the legacy endpoint republish a withdrawn import without new review', () => {
  expect(() =>
    catalogPublicationChange(
      {
        importKey: 'identity',
        importPublishedAt: new Date(),
        status: 'ARCHIVED',
      },
      'PUBLISHED',
    ),
  ).toThrow('cannot be republished');
});
