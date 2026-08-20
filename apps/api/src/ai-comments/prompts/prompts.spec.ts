import { buildEtymologyPrompt } from './etymology';
import { buildExplainPrompt } from './explain';
import { buildTranslatePrompt } from './translate';

const CONTEXT_INPUT = {
  context:
    'Darcy walked off. Elizabeth remained with no very cordial feelings.',
  bookTitle: 'Pride and Prejudice',
  author: 'Jane Austen',
};

describe('buildTranslatePrompt', () => {
  it('renders book metadata and surrounding context when provided', () => {
    const { prompt } = buildTranslatePrompt({
      text: 'cordial feelings',
      targetLang: 'French',
      ...CONTEXT_INPUT,
    });

    expect(prompt).toContain('Pride and Prejudice — Jane Austen');
    expect(prompt).toContain(CONTEXT_INPUT.context);
    expect(prompt).toContain('context only');
  });

  it('omits the metadata and context sections when absent', () => {
    const { prompt } = buildTranslatePrompt({
      text: 'cordial feelings',
      targetLang: 'French',
    });

    expect(prompt).not.toContain('From:');
    expect(prompt).not.toContain('context only');
  });
});

describe('buildEtymologyPrompt', () => {
  it('renders book metadata and surrounding context when provided', () => {
    const { prompt } = buildEtymologyPrompt({
      text: 'cordial',
      ...CONTEXT_INPUT,
    });

    expect(prompt).toContain('Pride and Prejudice — Jane Austen');
    expect(prompt).toContain(CONTEXT_INPUT.context);
    expect(prompt).toContain('context only');
  });

  it('omits the metadata and context sections when absent', () => {
    const { prompt } = buildEtymologyPrompt({ text: 'cordial' });

    expect(prompt).not.toContain('From:');
    expect(prompt).not.toContain('context only');
  });
});

describe('buildExplainPrompt', () => {
  it('renders book metadata and surrounding context when provided', () => {
    const { prompt } = buildExplainPrompt({
      text: 'cordial feelings',
      ...CONTEXT_INPUT,
    });

    expect(prompt).toContain('Pride and Prejudice — Jane Austen');
    expect(prompt).toContain(CONTEXT_INPUT.context);
  });

  it('omits the metadata and context sections when absent', () => {
    const { prompt } = buildExplainPrompt({ text: 'cordial feelings' });

    expect(prompt).not.toContain('From:');
  });
});
