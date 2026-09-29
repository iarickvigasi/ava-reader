import type { ReaderLocator } from "@/lib/api-types";
import type { JumpHistory } from "./jump-history";
export type JumpSessionEffects = {
  origin: () => ReaderLocator | null;
  navigate: (target: ReaderLocator, sequence: number) => void | Promise<void>;
  arrive: (target: ReaderLocator) => void;
  focus: (target: ReaderLocator) => void;
  leave: () => void;
  publish: (state: JumpHistory, error: string | null) => void;
};
