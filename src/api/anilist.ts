// Calendario de emisión.
//
// La API oficial de MAL no dice cuándo sale el próximo episodio, así que esa
// parte se pide a AniList (https://anilist.co), que tiene el calendario de
// emisión con día y hora exactos. No hace falta cuenta ni login. Los animes se
// emparejan con los de MAL por su id (idMal).
const ENDPOINT = "https://graphql.anilist.co";

async function gql<T>(query: string, variables: Record<string, any>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e: any) {
    console.log(`[AniList] fallo de red: ${e?.message ?? e}`);
    throw new Error("No se pudo conectar con AniList");
  }
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors) {
    const msg = json?.errors?.[0]?.message ?? `error ${res.status}`;
    console.log(`[AniList] ${msg}`);
    throw new Error(`AniList: ${msg}`);
  }
  return json.data as T;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Datos de emisión de un anime de tu lista */
export type MyShow = {
  malId: number;
  /** próximo episodio que sale (si está en emisión) */
  next?: { episode: number; airingAt: number }; // airingAt en segundos
  /** fecha de estreno si aún no ha empezado (ms; day puede faltar) */
  start?: { year?: number; month?: number; day?: number };
  status?: string;
};

const MINE_QUERY = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(idMal_in: $ids, type: ANIME) {
      idMal
      status
      nextAiringEpisode { episode airingAt }
      startDate { year month day }
    }
  }
}`;

/** Próximo episodio de cada anime de tu lista (en trozos de 50 ids) */
export async function getMyShows(malIds: number[]): Promise<MyShow[]> {
  const out: MyShow[] = [];
  for (let i = 0; i < malIds.length; i += 50) {
    const ids = malIds.slice(i, i + 50);
    const data = await gql<any>(MINE_QUERY, { ids });
    for (const m of data?.Page?.media ?? []) {
      if (!m.idMal) continue;
      out.push({
        malId: m.idMal,
        status: m.status,
        next: m.nextAiringEpisode
          ? { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt }
          : undefined,
        start: m.startDate ?? undefined,
      });
    }
    if (i + 50 < malIds.length) await sleep(300);
  }
  return out;
}

/** Un episodio que sale en el calendario general */
export type ScheduleEntry = {
  id: number;
  malId?: number;
  title: string;
  cover?: string;
  episode: number;
  airingAt: number; // segundos
  adult: boolean;
};

const WEEK_QUERY = `
query ($from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      id
      episode
      airingAt
      media {
        idMal
        isAdult
        title { romaji english }
        coverImage { large }
      }
    }
  }
}`;

/** Todos los episodios que salen entre dos instantes (segundos) */
export async function getSchedule(fromSec: number, toSec: number): Promise<ScheduleEntry[]> {
  const out: ScheduleEntry[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await gql<any>(WEEK_QUERY, { from: fromSec, to: toSec, page });
    for (const s of data?.Page?.airingSchedules ?? []) {
      if (!s.media) continue;
      out.push({
        id: s.id,
        malId: s.media.idMal ?? undefined,
        title: s.media.title?.romaji ?? s.media.title?.english ?? "Sin título",
        cover: s.media.coverImage?.large ?? undefined,
        episode: s.episode,
        airingAt: s.airingAt,
        adult: !!s.media.isAdult,
      });
    }
    if (!data?.Page?.pageInfo?.hasNextPage) break;
    await sleep(300);
  }
  return out;
}
