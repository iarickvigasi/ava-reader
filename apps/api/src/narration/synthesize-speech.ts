import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

// V4 has no numeric speed setting; pacing is directed in the script instead.
export async function synthesizeSpeech(
  config: ConfigService,
  text: string,
  languageCode?: string,
) {
  const apiKey = config.get<string>('OPENROUTER_API_KEY');
  if (!apiKey)
    throw new ServiceUnavailableException('Narration is unavailable.');
  const base =
    config.get<string>('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'elevenlabs/eleven-v4',
        input: `[slowly] [clearly] ${text.replace(/\[/g, '(').replace(/\]/g, ')')}`,
        voice: 'alice',
        response_format: 'mp3',
        ...(languageCode
          ? {
              provider: {
                options: { elevenlabs: { language_code: languageCode } },
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok)
      throw new Error(`Speech provider status ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('audio/'))
      throw new Error('Invalid speech response');
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error('Empty speech response');
    return audio;
  } catch {
    // Never forward provider messages that may contain private input or key details.
    throw new ServiceUnavailableException(
      'Narration failed. Please try again.',
    );
  }
}
