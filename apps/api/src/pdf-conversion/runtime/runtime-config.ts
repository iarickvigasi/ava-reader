import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { PdfRuntimeError } from './runtime-error';

const configuration = z
  .object({
    enabled: z.literal(true),
    docker: z.string().refine(isAbsolute),
    dockerHost: z.string().regex(/^unix:\/\/\/[^\n\r\0,]+$/),
    image: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    mode: z.enum(['production', 'development', 'test']),
    memoryBytes: z
      .number()
      .int()
      .min(128 * 1024 ** 2)
      .max(2 * 1024 ** 3),
    cpus: z.number().min(0.25).max(2),
    fault: z
      .enum(['deadline', 'memory', 'scratch', 'output', 'cpu'])
      .optional(),
    faultAcknowledgement: z.literal('AVA_PDF_RUNTIME_FAULTS_V1').optional(),
  })
  .strict();
export type PdfRuntimeConfig = Readonly<z.infer<typeof configuration>>;

export function validateRuntimeConfig(
  input: PdfRuntimeConfig,
): PdfRuntimeConfig {
  const result = configuration.safeParse(input);
  if (
    !result.success ||
    (result.data.fault &&
      (process.env.NODE_ENV === 'production' ||
        result.data.mode !== 'development' ||
        !result.data.faultAcknowledgement))
  )
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  return Object.freeze(result.data);
}

export function runtimeConfigFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  return validateRuntimeConfig({
    enabled: (env.AVA_PDF_RUNTIME_ENABLED === '1') as true,
    docker: env.AVA_PDF_DOCKER_BINARY ?? '',
    dockerHost: env.AVA_PDF_DOCKER_HOST ?? '',
    image: env.AVA_PDF_WORKER_IMAGE ?? '',
    mode:
      env.NODE_ENV === 'production'
        ? 'production'
        : env.NODE_ENV === 'test'
          ? 'test'
          : 'development',
    memoryBytes: Number(env.AVA_PDF_MEMORY_BYTES ?? 536870912),
    cpus: Number(env.AVA_PDF_CPUS ?? 1),
    ...(env.AVA_PDF_RUNTIME_FAULT
      ? {
          fault: env.AVA_PDF_RUNTIME_FAULT as PdfRuntimeConfig['fault'],
          faultAcknowledgement:
            env.AVA_PDF_FAULT_ACK as PdfRuntimeConfig['faultAcknowledgement'],
        }
      : {}),
  });
}
