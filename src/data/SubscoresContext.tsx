import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { readJson, writeJson } from "./storage";

// Subnotas propias de cada anime. MAL solo guarda una nota, así que estas
// viven solo en la app (archivo subscores.json del móvil).
export type SubscoreKey = "animation" | "story" | "characters";

export const SUBSCORES: { key: SubscoreKey; label: string }[] = [
  { key: "animation", label: "Animación" },
  { key: "story", label: "Historia" },
  { key: "characters", label: "Personajes" },
];

export type Subscores = Partial<Record<SubscoreKey, number>>;

type Ctx = {
  subscores: Record<number, Subscores>;
  /** value 0 = quitar la subnota */
  setSubscore: (animeId: number, key: SubscoreKey, value: number) => void;
};

const FILE = "subscores.json";
const SubscoresContext = createContext<Ctx | null>(null);

export function SubscoresProvider({ children }: { children: React.ReactNode }) {
  const [subscores, setSubscores] = useState<Record<number, Subscores>>({});
  const loaded = useRef(false);

  useEffect(() => {
    readJson<Record<number, Subscores>>(FILE, {}).then((saved) => {
      setSubscores((current) => ({ ...saved, ...current }));
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (loaded.current) writeJson(FILE, subscores);
  }, [subscores]);

  const setSubscore = useCallback((animeId: number, key: SubscoreKey, value: number) => {
    setSubscores((prev) => {
      const entry: Subscores = { ...(prev[animeId] ?? {}) };
      if (value <= 0) delete entry[key];
      else entry[key] = Math.min(10, value);
      const next = { ...prev };
      if (Object.keys(entry).length === 0) delete next[animeId];
      else next[animeId] = entry;
      return next;
    });
  }, []);

  return (
    <SubscoresContext.Provider value={{ subscores, setSubscore }}>
      {children}
    </SubscoresContext.Provider>
  );
}

export function useSubscores() {
  const ctx = useContext(SubscoresContext);
  if (!ctx) throw new Error("useSubscores debe usarse dentro de SubscoresProvider");
  return ctx;
}
