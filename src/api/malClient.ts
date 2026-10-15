import { getValidAccessToken } from "../auth/malAuth";
import { MAL_API_BASE, MAL_CLIENT_ID } from "../config";

export type ListStatus =
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_watch";

export type ListStatusUpdate = {
  status?: ListStatus;
  /** 0 = sin nota, 1-10 */
  score?: number;
  numWatchedEpisodes?: number;
};

async function malFetchUrl(url: string, options: RequestInit = {}) {
  const token = await getValidAccessToken();
  if (!token) throw new Error("No hay sesión activa con MyAnimeList");

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "X-MAL-CLIENT-ID": MAL_CLIENT_ID,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error MAL API (${response.status}): ${text}`);
  }
  return response.json();
}

async function malFetch(path: string, options: RequestInit = {}) {
  return malFetchUrl(`${MAL_API_BASE}${path}`, options);
}

/** Tu lista de anime completa (sigue la paginación de MAL hasta traerla toda) */
export async function getMyAnimeList() {
  const params = new URLSearchParams({
    fields: "list_status,num_episodes,main_picture,genres,mean,studios,media_type,start_date,status",
    limit: "100",
    nsfw: "1",
  });

  let url: string | null = `${MAL_API_BASE}/users/@me/animelist?${params.toString()}`;
  const allData: any[] = [];

  while (url) {
    const page: any = await malFetchUrl(url);
    allData.push(...(page.data ?? []));
    url = page.paging?.next ?? null;
  }

  return { data: allData };
}

/** Ficha de un anime: sinopsis, géneros, nota media, estudios... */
export async function getAnimeDetails(animeId: number) {
  const params = new URLSearchParams({
    fields:
      "synopsis,genres,mean,num_episodes,status,media_type,start_date,studios",
  });
  return malFetch(`/anime/${animeId}?${params.toString()}`);
}

/**
 * Animes relacionados con uno (secuelas, precuelas, películas, OVAs...).
 * Sirve para agrupar temporadas de una misma franquicia.
 */
export async function getAnimeRelations(
  animeId: number
): Promise<{ id: number; t: string }[]> {
  const res = await malFetch(`/anime/${animeId}?fields=related_anime`);
  return (res.related_anime ?? [])
    .filter((r: any) => r?.node?.id)
    .map((r: any) => ({ id: r.node.id as number, t: String(r.relation_type ?? "") }));
}

/** Búsqueda de anime por texto (título) */
export async function searchAnime(query: string, nsfw: boolean = false) {
  const params = new URLSearchParams({
    q: query,
    limit: "20",
    fields: "main_picture,mean,genres,num_episodes,media_type,nsfw",
  });
  if (nsfw) params.set("nsfw", "1");
  return malFetch(`/anime?${params.toString()}`);
}

export type DiscoverSource =
  | "all"
  | "bypopularity"
  | "airing"
  | "upcoming"
  | "ova"
  | "movie"
  | "suggestions";

const DISCOVER_FIELDS = "main_picture,mean,genres,num_episodes,media_type,start_season,nsfw";

/**
 * Una página de animes para descubrir. La API de MAL no filtra por género:
 * se piden los rankings y el filtro se hace en la app con el campo genres.
 * (all = mejor valorados, bypopularity, airing, upcoming; suggestions = para ti)
 */
export async function getDiscoverPage(
  source: DiscoverSource,
  offset: number,
  nsfw: boolean = false,
  limit: number = 100
): Promise<{ items: any[]; hasMore: boolean }> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    fields: DISCOVER_FIELDS,
  });
  if (nsfw) params.set("nsfw", "1");
  let path: string;
  if (source === "suggestions") {
    path = `/anime/suggestions?${params.toString()}`;
  } else {
    params.set("ranking_type", source);
    path = `/anime/ranking?${params.toString()}`;
  }
  const res = await malFetch(path);
  return {
    items: (res.data ?? []).map((d: any) => d.node),
    hasMore: !!res.paging?.next,
  };
}

/**
 * Cambia el estado, la nota y/o los episodios vistos de un anime de tu lista.
 * Devuelve el list_status actualizado.
 */
export async function updateListStatus(
  animeId: number,
  changes: ListStatusUpdate
) {
  const fields: Record<string, string> = {};
  if (changes.status !== undefined) fields.status = changes.status;
  if (changes.score !== undefined) fields.score = String(changes.score);
  if (changes.numWatchedEpisodes !== undefined) {
    fields.num_watched_episodes = String(changes.numWatchedEpisodes);
  }

  return malFetch(`/anime/${animeId}/my_list_status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

/** Tu perfil de MAL: nombre y foto */
export async function getMyProfile() {
  return malFetch(`/users/@me?fields=picture`);
}
