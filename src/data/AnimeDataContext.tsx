import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getMyAnimeList, getMyProfile } from "../api/malClient";

type Profile = { name?: string; picture?: string } | null;

type AnimeData = {
  items: any[];
  profile: Profile;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Actualiza en local el list_status de un anime tras guardarlo en MAL */
  updateEntry: (animeId: number, listStatus: any) => void;
  /** Añade a la lista local un anime nuevo tras guardarlo en MAL */
  addEntry: (node: any, listStatus: any) => void;
};

const AnimeDataContext = createContext<AnimeData | null>(null);

export function AnimeDataProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const data = await getMyAnimeList();
      setItems(data.data ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const data = await getMyProfile();
      setProfile({ name: data.name, picture: data.picture });
    } catch {
      // si falla el perfil no bloqueamos la app
    }
  }, []);

  useEffect(() => {
    Promise.all([loadList(), loadProfile()]).finally(() => setLoading(false));
  }, [loadList, loadProfile]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadList();
    setRefreshing(false);
  }, [loadList]);

  const updateEntry = useCallback((animeId: number, listStatus: any) => {
    setItems((prev) =>
      prev.map((it) =>
        it.node.id === animeId
          ? { ...it, list_status: { ...it.list_status, ...listStatus } }
          : it
      )
    );
  }, []);

  const addEntry = useCallback((node: any, listStatus: any) => {
    setItems((prev) =>
      prev.some((it) => it.node.id === node.id)
        ? prev
        : [{ node, list_status: listStatus }, ...prev]
    );
  }, []);

  return (
    <AnimeDataContext.Provider
      value={{
        items,
        profile,
        loading,
        refreshing,
        error,
        refresh,
        updateEntry,
        addEntry,
      }}
    >
      {children}
    </AnimeDataContext.Provider>
  );
}

export function useAnimeData() {
  const ctx = useContext(AnimeDataContext);
  if (!ctx) throw new Error("useAnimeData debe usarse dentro de AnimeDataProvider");
  return ctx;
}
