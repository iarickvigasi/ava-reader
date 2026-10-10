import { useContext, type ReactNode } from "react";
import { ReaderPanelTitleContext } from "./panel-title-context";

export function PanelTitle({ children }: { children: ReactNode }) {
  const id = useContext(ReaderPanelTitleContext);
  return (
    <h2 id={id} className="font-ui text-[1rem] uppercase tracking-[0.18em] text-title/85">
      {children}
    </h2>
  );
}
