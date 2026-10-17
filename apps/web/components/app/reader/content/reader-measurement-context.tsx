import { createContext, useContext } from "react";

// Hidden layout copies keep source coordinates, but own no navigation targets.
export const ReaderMeasurementContext = createContext(false);
export function useReaderMeasurement() {
  return useContext(ReaderMeasurementContext);
}
