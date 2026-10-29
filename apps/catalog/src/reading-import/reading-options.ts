import { parseArgs } from 'node:util';
import { CLASSIC_LANGUAGES } from './classic-seeds/types';
import { MAX_CANDIDATES } from './types';
export function readingOptions() {
  const { values } = parseArgs({
    options: {
      bind: { type: 'boolean' },
      bootstrap: { type: 'boolean' },
      inventory: { type: 'boolean' },
      inspect: { type: 'boolean' },
      apply: { type: 'boolean' },
      file: { type: 'string' },
      output: { type: 'string' },
      limit: { type: 'string', default: '100' },
      language: { type: 'string' },
    },
  });
  if (
    [
      values.bind,
      values.bootstrap,
      values.inventory,
      values.inspect,
      values.apply,
    ].filter(Boolean).length !== 1 ||
    ((values.bootstrap || values.inventory || values.inspect) &&
      !values.output) ||
    (!values.inventory && !values.file)
  )
    throw new Error(
      'Choose --bind --file, --bootstrap --file --output, --inventory --output, --inspect --file --output, --apply --file',
    );
  if (
    values.language &&
    (!values.inventory ||
      !CLASSIC_LANGUAGES.some((language) => language === values.language))
  )
    throw new Error(
      '--language requires --inventory and one of uk, en, de, fr, es, pl',
    );
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CANDIDATES)
    throw new Error('Limit must be 1..100');
  return { ...values, limit };
}
