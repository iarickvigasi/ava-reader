import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { pythonSemanticValidator } from './python-semantic-validator';
import type { ValidatorFailureObserver } from './validator-failure.types';

export function startValidator(
  options: {
    observer?: ValidatorFailureObserver;
    configure?: (child: ReturnType<typeof makeChild>) => void;
    wire?: string;
  } = {},
) {
  const child = makeChild();
  options.configure?.(child);
  jest.mocked(spawn).mockReturnValue(child as unknown as ChildProcess);
  const observer = options.observer ?? jest.fn();
  const promise = pythonSemanticValidator('/private/test-validator', observer)(
    'ava-reader-3',
    null,
    options.wire ?? '{"body":"PRIVATE_BODY"}',
  );
  child.emit('spawn');
  return { child, observer, promise };
}

function makeChild() {
  return Object.assign(new EventEmitter(), {
    stdin: Object.assign(new EventEmitter(), { end: jest.fn() }),
    stdout: new EventEmitter(),
    kill: jest.fn(() => true),
  });
}
