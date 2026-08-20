// Payload shape per tool, mirroring the server's Zod DTOs. `text` is always
// required; the rest depend on the tool. Validation lives on the server.
//
// Every tool accepts the selection-context fields (spec 3): the sentences
// around the selection plus book metadata, all optional — requests without
// them behave exactly as before.
type SelectionContextFields = {
  context?: string;
  bookTitle?: string;
  author?: string;
  locator?: string;
};

export type AiToolPayload =
  | ({ kind: "translate"; text: string; targetLang: string } & SelectionContextFields)
  | ({ kind: "etymology"; text: string } & SelectionContextFields)
  | ({ kind: "explain"; text: string } & SelectionContextFields);
