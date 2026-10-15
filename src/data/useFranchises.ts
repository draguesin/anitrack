import { useEffect, useMemo, useRef, useState } from "react";
import { getAnimeRelations } from "../api/malClient";
import { readJson, writeJson } from "./storage";

// Agrupa en "franquicias" los animes de tu lista que son temporadas, películas,
// OVAs... del mismo anime. MAL dice qué anime está relacionado con cuál
// (secuela, precuela, historia paralela...). Esas relaciones se piden una vez
// por anime y se guardan en el móvil (franchises.json).
const FILE = "franchises.json";

// Relaciones que cuentan como "del mismo anime". Para agrupar más, añade
// "spin_off" o "alternative_setting"; para agrupar menos, quita alguna.
const GROUP_RELATIONS = new Set([
  "prequel",
  "sequel",
  "side_story",
  "parent_story",
  "summary",
  "full_story",
  "alternative_version",
]);

type Relation = { id: number; t: string };

export type Franchise = {
  key: string;
  title: string;
  /** ids de tu lista, en orden cronológico */
  memberIds: number[];
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useFranchises(items: any[], enabled: boolean) {
  const [relations, setRelations] = useState<Record<number, Relation[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, running: false });
  const [error, setError] = useState<string | null>(null);
  const relRef = useRef<Record<number, Relation[]>>({});
  const running = useRef(false);
  const enabledRef = useRef(enabled);
  const mounted = useRef(true);
  enabledRef.current = enabled;

  useEffect(() => {
    mounted.current = true;
    readJson<Record<number, Relation[]>>(FILE, {}).then((saved) => {
      relRef.current = { ...saved, ...relRef.current };
      setRelations(relRef.current);
      setLoaded(true);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const todo = useMemo(
    () =>
      items
        .map((i) => i.node.id as number)
        .filter((id) => relations[id] === undefined),
    [items, relations]
  );

  useEffect(() => {
    if (!enabled || !loaded || running.current || todo.length === 0) return;
    running.current = true;
    const ids = todo;
    (async () => {
      setError(null);
      setProgress({ done: 0, total: ids.length, running: true });
      let done = 0;
      let next = 0;
      let consecutive = 0;
      let lastError = "";
      let stop = false;
      let pausedUntil = 0;
      const retry: number[] = [];

      // 2 peticiones a la vez, con pausa entre cada una (MAL limita si se le pide demasiado)
      const worker = async () => {
        while (!stop && (retry.length > 0 || next < ids.length)) {
          if (!enabledRef.current || !mounted.current) {
            stop = true;
            break;
          }
          const wait = pausedUntil - Date.now();
          if (wait > 0) await sleep(wait);
          const id = retry.length > 0 ? retry.shift()! : ids[next++];
          try {
            const rels = await getAnimeRelations(id);
            relRef.current = { ...relRef.current, [id]: rels };
            consecutive = 0;
          } catch (e: any) {
            lastError = e?.message ?? "Error desconocido";
            if (/\(429\)/.test(lastError)) {
              // demasiadas peticiones: se pausa todo 8 s y se reintenta este anime
              pausedUntil = Date.now() + 8000;
              retry.push(id);
            }
            consecutive += 1;
            if (consecutive >= 8) {
              stop = true;
              if (mounted.current) setError(`Se paró tras varios fallos seguidos: ${lastError}`);
              break;
            }
          }
          if (relRef.current[id] !== undefined) done += 1;
          if (done % 5 === 0) {
            if (mounted.current) {
              setRelations(relRef.current);
              setProgress({ done: Math.min(done, ids.length), total: ids.length, running: true });
            }
            if (done % 25 === 0) writeJson(FILE, relRef.current);
          }
          await sleep(400);
        }
      };

      await Promise.all([worker(), worker()]);
      writeJson(FILE, relRef.current);
      running.current = false;
      if (mounted.current) {
        setRelations(relRef.current);
        setProgress({ done: Math.min(done, ids.length), total: ids.length, running: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loaded, todo.length]);

  const groupOf = useMemo(() => {
    const result = new Map<number, Franchise>();
    if (!enabled) return result;

    // union-find sobre los ids (también los que no están en tu lista: así una
    // temporada que no tienes sigue uniendo a la anterior y la siguiente)
    const parent = new Map<number, number>();
    const find = (x: number): number => {
      let root = x;
      while ((parent.get(root) ?? root) !== root) root = parent.get(root)!;
      let cur = x;
      while ((parent.get(cur) ?? cur) !== root) {
        const next = parent.get(cur)!;
        parent.set(cur, root);
        cur = next;
      }
      return root;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    for (const item of items) {
      const id = item.node.id as number;
      for (const r of relations[id] ?? []) {
        if (GROUP_RELATIONS.has(r.t)) union(id, r.id);
      }
    }

    const buckets = new Map<number, any[]>();
    for (const item of items) {
      const root = find(item.node.id);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root)!.push(item);
    }

    const chrono = (a: any, b: any) =>
      String(a.node.start_date ?? "9999").localeCompare(String(b.node.start_date ?? "9999")) ||
      a.node.id - b.node.id;

    buckets.forEach((members, root) => {
      if (members.length < 2) return;
      const ordered = [...members].sort(chrono);
      // nombre de la carpeta: el primer TV que salió (si no hay, el primero que salió)
      const firstTv = ordered.find((m) => m.node.media_type === "tv") ?? ordered[0];
      const franchise: Franchise = {
        key: String(root),
        title: String(firstTv.node.title),
        memberIds: ordered.map((m) => m.node.id as number),
      };
      for (const m of ordered) result.set(m.node.id, franchise);
    });
    return result;
  }, [enabled, items, relations]);

  return { groupOf, progress, error };
}
