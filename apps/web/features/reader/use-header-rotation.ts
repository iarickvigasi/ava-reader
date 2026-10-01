import { useEffect, useState } from "react";
import { startHeaderRotation } from "./header-rotation";

export function useHeaderRotation() {
  const [state, setState] = useState({ chapter: false, fading: false });
  useEffect(() => startHeaderRotation(setState), []);
  return state;
}
