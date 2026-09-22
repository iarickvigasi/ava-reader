import { BadGatewayException } from '@nestjs/common';
import { stubModel } from '../../book-analysis/chapter-purpose/model.fixture';
import { generateTranslations } from './generate-translations';
import { generationFixture } from '../testing/generation.fixture';

describe('bilingual generation', () => {
  it('serves persisted sentences before requiring any model credentials', async () => {
    const fixture = generationFixture();
    fixture.context.units.forEach((unit) =>
      fixture.stored.set(unit.id, 'Cached'),
    );
    fixture.getModelId.mockImplementation(() => {
      throw new Error('No API key');
    });
    expect(await generateTranslations(fixture.args)).toEqual(
      Object.fromEntries(fixture.stored),
    );
    expect(fixture.getModelId).not.toHaveBeenCalled();
    expect(fixture.createMany).not.toHaveBeenCalled();
  });

  it('only generates missing sentences and persists their source anchors atomically', async () => {
    const fixture = generationFixture();
    const [cached, missing] = fixture.context.units;
    fixture.stored.set(cached.id, 'Cached');
    const { model, prompts } = stubModel({
      translations: [{ id: missing.id, text: 'Autre phrase.' }],
    });
    fixture.getModel.mockReturnValue(model);
    const result = await generateTranslations(fixture.args);
    expect(result).toEqual({
      [cached.id]: 'Cached',
      [missing.id]: 'Autre phrase.',
    });
    expect(fixture.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sentenceId: missing.id,
          sourceText: missing.text,
          translatedText: 'Autre phrase.',
          startOffset: missing.startOffset,
          endOffset: missing.endOffset,
        }),
      ],
    });
    expect(fixture.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          userId: 'user-1',
          libraryItemId: 'library-1',
          targetLang: 'French',
          contentRevision: 'file-1',
          translationVersion: 1,
        },
      }),
    );
    expect(prompts.join('')).toContain('contextBefore');
  });

  it('never stores a partial or mismatched model response', async () => {
    const fixture = generationFixture();
    const { model } = stubModel({
      translations: [{ id: fixture.context.units[0].id, text: 'Partial' }],
    });
    fixture.getModel.mockReturnValue(model);
    await expect(generateTranslations(fixture.args)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fixture.createMany).not.toHaveBeenCalled();
    expect(fixture.upsert).not.toHaveBeenCalled();
  });

  it('does not start new model work after the request is canceled', async () => {
    const fixture = generationFixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateTranslations({ ...fixture.args, signal: controller.signal }),
    ).rejects.toThrow();
    expect(fixture.getModel).not.toHaveBeenCalled();
  });
});
