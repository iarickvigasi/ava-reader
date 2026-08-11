import type { LanguageModel } from 'ai';

// A minimal stand-in for a LanguageModelV2. The SDK ships mocks under
// `ai/test`, but that entry point pulls in `msw`, which this workspace does not
// install — and all these tests need is a doGenerate that returns fixed JSON.
export function stubModel(response: unknown): {
  model: LanguageModel;
  prompts: string[];
} {
  const prompts: string[] = [];
  const model = {
    doGenerate: (options: { prompt: unknown }) => {
      prompts.push(JSON.stringify(options.prompt));

      return Promise.resolve({
        content: [{ text: JSON.stringify(response), type: 'text' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      });
    },
    doStream: () => Promise.reject(new Error('Streaming is not used here.')),
    modelId: 'stub-model',
    provider: 'stub',
    specificationVersion: 'v2',
    supportedUrls: {},
  };

  return { model: model as unknown as LanguageModel, prompts };
}

// Fails the call, for exercising the failure paths.
export function failingModel(message: string): LanguageModel {
  return {
    doGenerate: () => Promise.reject(new Error(message)),
    doStream: () => Promise.reject(new Error(message)),
    modelId: 'stub-model',
    provider: 'stub',
    specificationVersion: 'v2',
    supportedUrls: {},
  } as unknown as LanguageModel;
}
