const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

export function speechOptions(text: string, language?: string) {
  const pronunciation = language
    ? ` Use natural ${languageNames.of(language)} pronunciation.`
    : '';
  return {
    model: 'google/gemini-3.8-flash-tts',
    input: text,
    voice: 'Kore',
    instructions: `Speak at a slightly slower, natural pace with clear articulation. Enunciate each sound without exaggerated pauses. Finish the final word fully, including its ending consonants and vowels, and let the final sound resolve naturally. Do not rush or cut off the ending. Speak only the supplied text.${pronunciation}`,
    response_format: 'pcm',
  };
}
