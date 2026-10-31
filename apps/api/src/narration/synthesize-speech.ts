import { narrationFailure } from './narration-failure';
import { speechOptions } from './speech-options';
import { japanesePronunciation } from './japanese-pronunciation';
import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

// V4 has no numeric speed setting; pacing is directed in the script instead.
export async function synthesizeSpeech(
  config: ConfigService,
  text: string,
  languageCode?: string,
  context?: string,
) {
  const apiKey = config.get<string>('OPENROUTER_API_KEY');
  if (!apiKey)
    throw new ServiceUnavailableException('Narration is unavailable.');
  const base =
    config.get<string>('OPENROUTER_BASE_URL')?.trim() ||
    'https://openrouter.ai/api/v1';
  let status: number | undefined;
  let stage = 'pronunciation';
  try {
    const spoken =
      languageCode === 'ja' ? await japanesePronunciation(text, context) : text;
    stage = 'speech';
    const response = await fetch(`${base.replace(/\/$/, '')}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(speechOptions(spoken, languageCode)),
      signal: AbortSignal.timeout(45_000),
    });
    status = response.status;
    if (!response.ok)
      throw new Error(`Speech provider status ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('audio/'))
      throw new Error('Invalid speech response');
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error('Empty speech response');
    return audio;
  } catch (error: unknown) {
    if (error instanceof UnprocessableEntityException) throw error;
    throw narrationFailure(stage, error, status);
  }
}
