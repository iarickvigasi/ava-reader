const FLASH_LANGUAGES = new Set(
  'en ja zh de hi fr ko pt it es id nl tr fil pl sv bg ro ar cs el fi hr ms sk da ta uk ru hu no vi'.split(
    ' ',
  ),
);

export function speechOptions(text: string, language?: string) {
  const flash = !!language && FLASH_LANGUAGES.has(language);
  return {
    model: flash ? 'elevenlabs/eleven-flash-v2.5' : 'elevenlabs/eleven-v4',
    input: flash
      ? text
      : `[slowly] [clearly] ${text.replace(/\[/g, '(').replace(/\]/g, ')')}`,
    voice: 'alice',
    response_format: 'mp3',
    provider: {
      options: {
        elevenlabs: {
          ...(language ? { language_code: language } : {}),
          ...(flash
            ? {
                voice_settings: {
                  speed: 0.85,
                  stability: 0.75,
                  similarity_boost: 0.75,
                },
              }
            : {}),
        },
      },
    },
  };
}
