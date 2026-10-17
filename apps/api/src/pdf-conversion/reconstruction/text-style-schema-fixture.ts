/** Inspect fields in the actual lowered outgoing request, including nested cell spans. */
export type SchemaShape = {
  description?: string;
  properties?: Record<string, SchemaShape>;
  items?: SchemaShape;
  anyOf?: SchemaShape[];
};
export const properties = (shape: SchemaShape) => shape.properties!;
export const anchorProperties = (owner: SchemaShape) =>
  properties(
    properties(properties(owner).spans.items!).anchor.anyOf!.find(
      (s) => s.properties,
    )!,
  );
