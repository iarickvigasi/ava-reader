export type EditorialKind = 'works' | 'authors' | 'editions';
export type EditorialRequest =
  | { operation: 'search'; kind: 'authors'; query: string }
  | {
      operation: 'get' | 'save' | 'delete';
      kind: EditorialKind;
      id: string;
      revision?: number;
      data?: Record<string, unknown>;
    };
