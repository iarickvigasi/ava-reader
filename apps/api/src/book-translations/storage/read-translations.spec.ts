import type { ReaderChapter } from '../../reader/reader-types';
import { generationFixture } from '../testing/generation.fixture';
import { readTranslations } from './read-translations';
import { buildSentenceCatalog } from '../source/sentence-catalog';
import { chapterFixture } from '../testing/translation.fixture';
import { translationVersionIdentity } from '../version-identity';

describe('saved sentence translations', () => {
  it('drops obsolete English boundaries while reusing unchanged Greek sentence IDs', async () => {
    const fixture = generationFixture();
    const text = 'Αυτό είναι τεστ; Ναι είναι. Τέλος.';
    const chapter: ReaderChapter = {
      ...chapterFixture,
      blocks: [
        {
          id: 'p-1',
          kind: 'paragraph',
          text,
          inlines: [{ kind: 'text', text }],
        },
      ],
    };
    const revision = fixture.context.contentRevision;
    const previous = buildSentenceCatalog(chapter, revision, 'en');
    const current = buildSentenceCatalog(chapter, revision, 'el');
    expect(previous.map((unit) => unit.text)).toEqual([
      'Αυτό είναι τεστ; Ναι είναι. ',
      'Τέλος.',
    ]);
    expect(current.map((unit) => unit.text)).toEqual([
      'Αυτό είναι τεστ; ',
      'Ναι είναι. ',
      'Τέλος.',
    ]);
    expect(current[2].id).toBe(previous[1].id);
    fixture.stored.set(previous[0].id, 'Est-ce un test ? Oui.');
    fixture.stored.set(previous[1].id, 'Fin.');
    const context = {
      ...fixture.context,
      sourceLanguage: 'el',
      units: current,
    };
    expect(translationVersionIdentity(context)).toEqual(
      translationVersionIdentity(fixture.context),
    );

    const saved = await readTranslations({
      prisma: fixture.args.prisma,
      context,
    });

    expect(saved).toEqual({ [current[2].id]: 'Fin.' });
    expect(saved).not.toHaveProperty(previous[0].id);
    expect(fixture.stored.get(previous[0].id)).toBe('Est-ce un test ? Oui.');
    expect(fixture.getModel).not.toHaveBeenCalled();
    expect(fixture.createMany).not.toHaveBeenCalled();
  });

  it('returns only the requested saved sentences from a chapter', async () => {
    const fixture = generationFixture();
    const [first, second] = fixture.context.units;
    fixture.stored.set(first.id, 'Première phrase.');
    fixture.stored.set(second.id, 'Deuxième phrase.');

    const saved = await readTranslations({
      prisma: fixture.args.prisma,
      context: fixture.context,
      sentenceIds: [second.id],
    });

    expect(saved).toEqual({ [second.id]: 'Deuxième phrase.' });
  });
});
