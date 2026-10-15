// Un anime cuenta como +18 si MAL lo etiqueta con alguno de estos géneros.
const ADULT_GENRE_NAMES = ["Hentai", "Erotica"];

export function isAdultItem(item: any): boolean {
  const genres: { name: string }[] = item?.node?.genres ?? [];
  return genres.some((g) => ADULT_GENRE_NAMES.includes(g.name));
}
