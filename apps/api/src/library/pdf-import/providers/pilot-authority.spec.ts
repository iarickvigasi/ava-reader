import { pilotFixture } from './pilot-fixtures';
import { requirePilotOperation, requirePilotCall } from './pilot-authority';
import { requirePilotBudgets } from './pilot-budgets';
describe('pilot operation and ledger scope', () => {
  it('requires a live inventory, while old stub policy stays available', () => {
    const f = pilotFixture(),
      { pilotInventory, ...old } = f.config;
    const scope = pilotInventory.operations[0];
    expect(() => requirePilotOperation(old, 'live', scope)).toThrow(
      'PDF_PROVIDER_PILOT_REQUIRED',
    );
    expect(requirePilotOperation(old, 'stub', scope)).toBeUndefined();
  });
  it.each(['operationId', 'ownerId', 'sourceSha256'] as const)(
    'binds %s',
    (field) => {
      const f = pilotFixture(),
        op = f.config.pilotInventory.operations[0];
      expect(() =>
        requirePilotOperation(f.config, 'live', {
          ...op,
          [field]: 'different',
        }),
      ).toThrow();
    },
  );
  it('binds image build and persisted exact call', () => {
    const f = pilotFixture(),
      op = f.config.pilotInventory.operations[0];
    expect(requirePilotOperation(f.config, 'live', op, 'e'.repeat(64))).toEqual(
      op,
    );
    expect(() =>
      requirePilotOperation(f.config, 'live', op, 'f'.repeat(64)),
    ).toThrow();
    expect(() =>
      requirePilotCall(f.config, op.operationId, op.tasks[0]),
    ).not.toThrow();
    expect(() => requirePilotCall(f.config, 'other', op.tasks[0])).toThrow();
  });
  it('requires pilot cap hard ceilings without rewriting counters', () => {
    const f = pilotFixture(),
      valid = [
        {
          scope: 'GLOBAL',
          limitNano: 1_000_000_000n,
          hardCeilingNano: 1_000_000_000n,
        },
        {
          scope: 'MODEL',
          limitNano: 10_000_000_000n,
          hardCeilingNano: 10_000_000_000n,
        },
      ];
    expect(() => requirePilotBudgets(f.config, valid)).not.toThrow();
    expect(() =>
      requirePilotBudgets(f.config, [
        { ...valid[0], hardCeilingNano: 2_000_000_000n },
      ]),
    ).toThrow();
    expect(() =>
      requirePilotBudgets(f.config, [
        { ...valid[1], hardCeilingNano: 11_000_000_000n },
      ]),
    ).toThrow();
  });
});
