import type { ReaderLocator } from "@/lib/api-types";
import type { NavigationScope } from "./navigation-scope";
import type { JumpHistory } from "./jump-history";
export type JumpSessionEffects = {
  scope?: NavigationScope;
  origin: () => ReaderLocator | null;
  navigate: (target: ReaderLocator, sequence: number) => void | Promise<void>;
  resolve: (target: ReaderLocator) => ReaderLocator | null;
  arrive: (target: ReaderLocator) => void;
  focus: (target: ReaderLocator, current?: () => boolean) => void;
  leave: () => void;
  publish: (state: JumpHistory, error: string | null) => void;
};
