import { projectConversionCost, type ReportCall } from './cost-projection';

function call(
  id: string,
  state: string,
  reservedNano: bigint,
  actualNano: bigint | null = null,
): ReportCall {
  return {
    id,
    state,
    reservedNano,
    actualNano,
    requestSha256: 'a'.repeat(64),
    receiptSha256: state === 'SETTLED' ? 'd'.repeat(64) : null,
    providerGenerationId: state === 'SETTLED' ? 'generation-one' : null,
    modelId: 'model',
    routeProvider: 'selected',
    routeId: 'route',
    tariffSha256: 'b'.repeat(64),
    configurationSha256: 'c'.repeat(64),
    purpose: null,
    stage: null,
    promptTokens: null,
    completionTokens: null,
  };
}
it('counts settled calls once and holds pending/uncertain amounts separately without released bounds', () => {
  const result = projectConversionCost(
    [
      call('one', 'SETTLED', 10n, 4n),
      call('two', 'SETTLED', 10n, 7n),
      call('three', 'RESERVED', 8n),
      call('four', 'DISPATCHING', 6n),
      call('five', 'UNCERTAIN', 5n),
      call('six', 'RELEASED', 100n),
    ],
    true,
  );
  expect(result).toMatchObject({
    knownActualNano: '11',
    reservedNano: '14',
    uncertainNano: '5',
    heldExposureNano: '19',
    state: 'PROVISIONAL',
  });
});
it('reports an incomplete settled receipt as unknown rather than final zero', () => {
  expect(
    projectConversionCost([call('one', 'SETTLED', 10n)], true),
  ).toMatchObject({
    actualComplete: false,
    state: 'INCOMPLETE',
    knownActualNano: '0',
  });
});
it('preserves exact amounts beyond Number precision and creates stable watermark independent of query order', () => {
  const calls = [
    call('two', 'SETTLED', 99n, 9007199254740993n),
    call('one', 'SETTLED', 3n, 2n),
  ];
  expect(projectConversionCost(calls, true).knownActualNano).toBe(
    '9007199254740995',
  );
  expect(projectConversionCost(calls, true).ledgerWatermark).toBe(
    projectConversionCost([...calls].reverse(), true).ledgerWatermark,
  );
});
it('verified empty terminal ledger is zero API cost while infrastructure remains unmeasured', () => {
  expect(projectConversionCost([], true)).toMatchObject({
    knownActualNano: '0',
    state: 'FINAL',
    infrastructure: { compute: 'NOT_MEASURED', storage: 'NOT_MEASURED' },
  });
});
it('missing ledger snapshot is not represented by an empty verified ledger', () => {
  expect(() =>
    projectConversionCost(undefined as unknown as ReportCall[], true),
  ).toThrow();
});
it('refuses duplicated call identity rather than counting a mirrored expense', () => {
  expect(() =>
    projectConversionCost(
      [call('one', 'SETTLED', 5n, 5n), call('one', 'SETTLED', 5n, 5n)],
      true,
    ),
  ).toThrow('PDF_COST_DUPLICATE_CALL');
});
it('never copies undeclared ORM/private payload fields into the operator projection', () => {
  const polluted = {
    ...call('one', 'SETTLED', 5n, 5n),
    messages: 'private book text',
    authorization: 'Bearer private-key',
    allocations: [{ actualNano: '5' }],
  } as ReportCall;
  const serialized = JSON.stringify(projectConversionCost([polluted], true));
  expect(serialized).not.toContain('private book text');
  expect(serialized).not.toContain('private-key');
  expect(serialized).not.toContain('allocations');
});
it('a running conversion with no current calls is provisional, not a final zero-cost conversion', () => {
  expect(projectConversionCost([], false)).toMatchObject({
    state: 'PROVISIONAL',
    actualComplete: false,
  });
});
it('a historical amount without its settled receipt remains explicitly incomplete', () => {
  expect(
    projectConversionCost(
      [{ ...call('one', 'SETTLED', 5n, 5n), receiptSha256: null }],
      true,
    ),
  ).toMatchObject({
    knownActualNano: '5',
    actualComplete: false,
    state: 'INCOMPLETE',
  });
});
it('unsafe receipt identifiers never expose paths/headers or turn a known charge into an uncharged result', () => {
  const result = projectConversionCost(
    [
      {
        ...call('one', 'SETTLED', 5n, 5n),
        providerGenerationId: 'Bearer PRIVATE_HEADER_CANARY',
        modelId: 'PRIVATE BOOK TEXT',
      },
    ],
    true,
  );
  expect(result).toMatchObject({
    knownActualNano: '5',
    actualComplete: false,
    state: 'INCOMPLETE',
  });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

it.each(['google-vertex/global', 'google-vertex/global/priority'])(
  'retains the selected endpoint %s and exact seven settled charges on a failed conversion',
  (routeProvider) => {
    const amounts = [
      32013750n,
      21663750n,
      28548750n,
      15960000n,
      17857500n,
      11730000n,
      27652500n,
    ];
    const calls = amounts.map((amount, index) => ({
      ...call(`call-${index}`, 'SETTLED', 1032192750n, amount),
      modelId: 'google/gemini-3.8-flash',
      routeProvider,
      stage: index < 4 ? 'EXTRACTION' : 'RECONSTRUCTION',
      providerGenerationId: `gen-1791822803-${index}`,
    }));
    const result = projectConversionCost(calls, true);
    expect(result).toMatchObject({
      knownActualNano: '155426250',
      reservedNano: '0',
      uncertainNano: '0',
      actualComplete: true,
      state: 'FINAL',
      callCount: 7,
      infrastructure: {
        compute: 'NOT_MEASURED',
        storage: 'NOT_MEASURED',
        delivery: 'NOT_MEASURED',
      },
      breakdown: [
        expect.objectContaining({
          routeProvider,
          stage: 'EXTRACTION',
          calls: 4,
          knownActualNano: '98186250',
        }),
        expect.objectContaining({
          routeProvider,
          stage: 'RECONSTRUCTION',
          calls: 3,
          knownActualNano: '57240000',
        }),
      ],
    });
    expect(
      result.calls.every((row) => row.routeProvider === routeProvider),
    ).toBe(true);
  },
);
it.each([
  'https://private.example/path',
  '/private/endpoint',
  'Bearer-private',
  'sk-secret',
  'provider//endpoint',
  'provider/sk-secret',
  'provider/Bearer-private',
  'provider?token=private',
])(
  'does not expose unsafe provider endpoint %s or label its receipt complete',
  (routeProvider) => {
    const result = projectConversionCost(
      [{ ...call('safe-call', 'SETTLED', 9n, 5n), routeProvider }],
      true,
    );
    expect(result).toMatchObject({
      knownActualNano: '5',
      actualComplete: false,
      state: 'INCOMPLETE',
    });
    expect(result.calls[0].routeProvider).toBe('UNAVAILABLE');
    expect(JSON.stringify(result)).not.toContain(routeProvider);
  },
);
