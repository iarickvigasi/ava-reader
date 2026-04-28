import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createOpenRouter,
  type OpenRouterProvider,
} from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

// Thin wrapper around the OpenRouter ai-sdk provider. We init lazily so the
// API service still boots without OPENROUTER_API_KEY — only the AI Comments
// endpoints fail (with a 500) until it's configured.
@Injectable()
export class OpenRouterClient implements OnModuleInit {
  private provider: OpenRouterProvider | null = null;
  private modelId: string | undefined;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    const modelId = this.config.get<string>('OPENROUTER_MODEL');
    const baseURL = this.config.get<string>('OPENROUTER_BASE_URL');

    this.modelId = modelId;
    if (apiKey) {
      this.provider = createOpenRouter({ apiKey, baseURL });
    }
  }

  getModelId(): string {
    if (!this.modelId) {
      throw new InternalServerErrorException(
        'OPENROUTER_MODEL is not configured. The AI Comments side panel cannot generate responses.',
      );
    }
    return this.modelId;
  }

  getModel(): LanguageModel {
    if (!this.provider) {
      throw new InternalServerErrorException(
        'OPENROUTER_API_KEY is not configured. The AI Comments side panel cannot generate responses.',
      );
    }
    return this.provider(this.getModelId());
  }
}
