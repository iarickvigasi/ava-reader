"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useIsCatalogAdmin } from "./use-is-catalog-admin";

type CatalogAdminVisibility = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

const CatalogAdminVisibilityContext =
  createContext<CatalogAdminVisibility | null>(null);

export function CatalogAdminVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const value = useMemo(() => ({ hidden, setHidden }), [hidden]);
  return (
    <CatalogAdminVisibilityContext.Provider value={value}>
      {children}
    </CatalogAdminVisibilityContext.Provider>
  );
}

export function useCatalogAdminVisibility() {
  const value = useContext(CatalogAdminVisibilityContext);
  if (!value) {
    throw new Error(
      "useCatalogAdminVisibility must be used within a CatalogAdminVisibilityProvider.",
    );
  }
  return value;
}

export function useShowCatalogAdmin() {
  const admin = useIsCatalogAdmin();
  const { hidden } = useCatalogAdminVisibility();
  return admin && !hidden;
}
