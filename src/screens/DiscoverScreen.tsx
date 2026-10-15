import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import Icon from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimeData } from "../data/AnimeDataContext";
import {
  DiscoverSource,
  ListStatus,
  getDiscoverPage,
  searchAnime,
  getAnimeDetails,
  updateListStatus,
} from "../api/malClient";

type Props = { onOpenMenu: () => void };

const SOURCES: { key: DiscoverSource; label: string }[] = [
  { key: "all", label: "Mejor valorados" },
  { key: "bypopularity", label: "Populares" },
  { key: "airing", label: "En emisión" },
  { key: "upcoming", label: "Próximamente" },
  { key: "ova", label: "OVA" },
  { key: "movie", label: "Películas" },
  { key: "suggestions", label: "Para ti" },
];

// Nombres tal y como los devuelve MAL en el campo "genres"
const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery",
  "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Suspense",
  "Ecchi", "Avant Garde", "Award Winning", "Boys Love", "Girls Love", "Gourmet",
  "Shounen", "Seinen", "Shoujo", "Josei", "Kids",
  "Isekai", "Mecha", "Music", "Psychological", "School", "Military", "Historical",
  "Martial Arts", "Super Power", "Samurai", "Space", "Vampire", "Parody",
  "Time Travel", "Iyashikei", "Gore", "Detective", "Harem", "Idols (Female)",
  "Romantic Subtext", "Reincarnation", "Survival", "Strategy Game", "Mythology",
];

// Descubrir no muestra contenido para adultos
const ADULT_TAGS = ["Hentai", "Erotica"];

function isHentai(n: any): boolean {
  if (n.nsfw === "black") return true;
  return (n.genres ?? []).some((g: any) => ADULT_TAGS.includes(g.name));
}

const STATUSES: { key: ListStatus; label: string }[] = [
  { key: "plan_to_watch", label: "Pendiente" },
  { key: "watching", label: "Viendo" },
  { key: "completed", label: "Completado" },
  { key: "on_hold", label: "En espera" },
  { key: "dropped", label: "Abandonado" },
];

const MIN_VISIBLE = 12; // si el filtro deja menos, se piden más páginas
const MAX_TOP_UPS = 6;

function infoLine(node: any): string {
  return [
    node.mean ? `★ ${node.mean}` : null,
    node.media_type ? String(node.media_type).toUpperCase() : null,
    node.num_episodes ? `${node.num_episodes} eps` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function DiscoverScreen({ onOpenMenu }: Props) {
  const { items, addEntry } = useAnimeData();
  const insets = useSafeAreaInsets();

  const myIds = useMemo(() => new Set<number>(items.map((i) => i.node.id)), [items]);

  const [source, setSource] = useState<DiscoverSource>("all");
  const [genre, setGenre] = useState<string | null>(null);

  // animes ya descargados de la fuente elegida (sin filtrar)
  const [raw, setRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextOffset = useRef(0);
  const ended = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const topUps = useRef(0);

  // búsqueda por título
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // anime abierto para ver y añadir
  const [selected, setSelected] = useState<any | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);

  const loadMore = useCallback(async () => {
    if (busy.current || ended.current) return;
    busy.current = true;
    setLoading(true);
    const gen = generation.current;
    try {
      const page = await getDiscoverPage(source, nextOffset.current, false);
      if (gen !== generation.current) return;
      nextOffset.current += page.items.length;
      ended.current = !page.hasMore || page.items.length === 0;
      setRaw((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        return [...prev, ...page.items.filter((n) => !ids.has(n.id))];
      });
      setError(null);
    } catch (e: any) {
      if (gen === generation.current) setError(e.message ?? "Error desconocido");
    } finally {
      if (gen === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [source]);

  // al cambiar de fuente se empieza de cero
  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    ended.current = false;
    nextOffset.current = 0;
    topUps.current = 0;
    setRaw([]);
    setError(null);
    loadMore();
  }, [loadMore]);

  // lo que se ve: sin los que ya tienes en alguna lista y con el género elegido
  const visible = useMemo(
    () =>
      raw.filter(
        (n) =>
          !myIds.has(n.id) &&
          !isHentai(n) &&
          (genre === null || (n.genres ?? []).some((g: any) => g.name === genre))
      ),
    [raw, myIds, genre]
  );

  // si el filtro deja pocos resultados, se piden más páginas (con tope)
  useEffect(() => {
    if (
      raw.length > 0 &&
      !loading &&
      !error &&
      !ended.current &&
      visible.length < MIN_VISIBLE &&
      topUps.current < MAX_TOP_UPS
    ) {
      topUps.current += 1;
      loadMore();
    }
  }, [raw.length, loading, error, visible.length, loadMore]);

  const pickGenre = (g: string | null) => {
    topUps.current = 0;
    setGenre(g);
  };

  // detalles (sinopsis) del anime abierto
  useEffect(() => {
    if (!selected) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    getAnimeDetails(selected.id)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const add = async (node: any, status: ListStatus) => {
    if (addingId !== null) return;
    setAddingId(node.id);
    try {
      const listStatus = await updateListStatus(node.id, { status });
      addEntry(node, listStatus);
      setSelected(null);
    } catch (e: any) {
      Alert.alert("No se pudo añadir en MyAnimeList", e.message ?? "Error desconocido");
    } finally {
      setAddingId(null);
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setSearchError("Escribe al menos 3 letras (MAL lo exige).");
      setResults(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await searchAnime(q);
      setResults(
        (res.data ?? [])
          .map((d: any) => d.node)
          .filter((n: any) => !isHentai(n))
      );
    } catch (e: any) {
      setSearchError(e.message ?? "Error desconocido");
      setResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
    setResults(null);
    setSearchError(null);
  };

  const showingSearch = searching && (results !== null || searchLoading || !!searchError);

  const renderRow = ({ item }: { item: any }) => {
    const inList = myIds.has(item.id);
    const genres = (item.genres ?? []).slice(0, 3).map((g: any) => g.name).join(", ");
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setSelected(item)}>
        <Image source={{ uri: item.main_picture?.medium }} style={styles.poster} />
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.rowMeta}>{infoLine(item)}</Text>
          {genres ? (
            <Text style={styles.rowMeta} numberOfLines={1}>
              {genres}
            </Text>
          ) : null}
        </View>
        {inList ? (
          <Text style={styles.inList}>En tu lista</Text>
        ) : (
          <TouchableOpacity
            style={[styles.addButton, addingId === item.id && styles.disabled]}
            disabled={addingId !== null}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => add(item, "plan_to_watch")}
          >
            {addingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.addText}>+</Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const selectedInList = selected ? myIds.has(selected.id) : false;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onOpenMenu} hitSlop={10}>
          <Icon name="menu" size={26} color="#fff" />
        </TouchableOpacity>

        {searching ? (
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Buscar anime nuevo..."
            placeholderTextColor="#6f8499"
            returnKeyType="search"
            autoFocus
          />
        ) : (
          <Text style={styles.headerTitle}>Descubrir</Text>
        )}

        <TouchableOpacity onPress={searching ? closeSearch : () => setSearching(true)} hitSlop={10}>
          <Icon name={searching ? "close" : "search"} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {!searching ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsRow}
            contentContainerStyle={styles.chipsContent}
          >
            {SOURCES.map((s) => {
              const active = source === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSource(s.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsRow}
            contentContainerStyle={styles.chipsContent}
          >
            {[null, ...GENRES].map((g) => {
              const active = genre === g;
              return (
                <TouchableOpacity
                  key={g ?? "todos"}
                  style={[styles.genreChip, active && styles.genreChipActive]}
                  onPress={() => pickGenre(g)}
                >
                  <Text style={[styles.genreChipText, active && styles.chipTextActive]}>
                    {g ?? "Todos los géneros"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {showingSearch ? (
        <FlatList
          data={results ?? []}
          keyExtractor={(n: any) => String(n.id)}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
          ListHeaderComponent={
            searchLoading ? (
              <ActivityIndicator color="#4d9cf5" style={styles.spinner} />
            ) : searchError ? (
              <Text style={styles.hint}>{searchError}</Text>
            ) : null
          }
          ListEmptyComponent={
            !searchLoading && !searchError ? <Text style={styles.hint}>Sin resultados.</Text> : null
          }
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(n: any) => String(n.id)}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: 16 }}
          onEndReached={() => {
            topUps.current = 0;
            loadMore();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            loading ? null : error ? null : (
              <Text style={styles.hint}>
                {ended.current
                  ? "No quedan animes nuevos con ese género en esta lista."
                  : "Buscando..."}
              </Text>
            )
          }
          ListFooterComponent={
            loading ? (
              <ActivityIndicator color="#4d9cf5" style={styles.spinner} />
            ) : error ? (
              <View>
                <Text style={styles.hint}>{error}</Text>
                <TouchableOpacity
                  style={styles.retry}
                  onPress={() => {
                    topUps.current = 0;
                    loadMore();
                  }}
                >
                  <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSelected(null)}>
          {selected ? (
            <TouchableOpacity activeOpacity={1} style={styles.sheet}>
              <ScrollView>
                <View style={styles.sheetTop}>
                  <Image source={{ uri: selected.main_picture?.medium }} style={styles.sheetImage} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.sheetTitle}>{selected.title}</Text>
                    <Text style={styles.rowMeta}>{infoLine(selected)}</Text>
                    <Text style={styles.rowMeta}>
                      {(selected.genres ?? []).map((g: any) => g.name).join(", ")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.synopsis}>
                  {details?.synopsis ?? (details ? "Sin sinopsis." : "Cargando sinopsis...")}
                </Text>

                {selectedInList ? (
                  <Text style={styles.inListBig}>Ya está en tu lista.</Text>
                ) : (
                  <View>
                    <Text style={styles.sheetLabel}>Añadir a mi lista como:</Text>
                    <View style={styles.statusRow}>
                      {STATUSES.map((s) => (
                        <TouchableOpacity
                          key={s.key}
                          style={[styles.statusChip, addingId !== null && styles.disabled]}
                          disabled={addingId !== null}
                          onPress={() => add(selected, s.key)}
                        >
                          <Text style={styles.statusChipText}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.closeButton} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>Cerrar</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1b2a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 14,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "bold", color: "#fff" },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: "#13233a",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 15,
  },
  chipsRow: { flexGrow: 0, flexShrink: 0 },
  chipsContent: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#13233a",
  },
  chipActive: { backgroundColor: "#2e51a2" },
  chipText: { color: "#9fb3c8", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  genreChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#0f2236",
    borderWidth: 1,
    borderColor: "#1c2e42",
  },
  genreChipActive: { backgroundColor: "#2e51a2", borderColor: "#2e51a2" },
  genreChipText: { color: "#9fb3c8", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomColor: "#1c2e42",
    borderBottomWidth: 1,
  },
  poster: { width: 56, height: 80, borderRadius: 6, backgroundColor: "#1c2e42" },
  rowInfo: { flex: 1, marginLeft: 12 },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  rowMeta: { color: "#9fb3c8", fontSize: 12, marginTop: 3 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2196f3",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  addText: { color: "#fff", fontSize: 24, lineHeight: 28, fontWeight: "700" },
  inList: { color: "#6f8499", fontSize: 11, marginLeft: 8, width: 56, textAlign: "center" },
  disabled: { opacity: 0.45 },
  gate: { padding: 20 },
  gateTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  gateText: { color: "#9fb3c8", fontSize: 14, lineHeight: 20, marginTop: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", marginTop: 22, gap: 12 },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#6f8499",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: { backgroundColor: "#2e51a2", borderColor: "#2e51a2" },
  checkMark: { color: "#fff", fontSize: 16, fontWeight: "700" },
  checkLabel: { color: "#dfeaf5", fontSize: 15, flex: 1 },
  gateButton: {
    marginTop: 24,
    backgroundColor: "#2196f3",
    borderRadius: 8,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  gateButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { color: "#9fb3c8", fontSize: 13, paddingHorizontal: 12, marginTop: 14 },
  spinner: { marginVertical: 16 },
  retry: {
    alignSelf: "flex-start",
    backgroundColor: "#2e51a2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    marginVertical: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: { backgroundColor: "#13233a", borderRadius: 12, padding: 16, maxHeight: "85%" },
  sheetTop: { flexDirection: "row" },
  sheetImage: { width: 90, height: 128, borderRadius: 8, backgroundColor: "#1c2e42" },
  sheetTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  synopsis: { color: "#dfeaf5", fontSize: 13, lineHeight: 19, marginTop: 14 },
  sheetLabel: { color: "#fff", fontSize: 15, fontWeight: "600", marginTop: 16 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  statusChip: {
    backgroundColor: "#2e51a2",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusChipText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  inListBig: { color: "#9fb3c8", marginTop: 16 },
  closeButton: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  closeText: { color: "#4d7cff", fontWeight: "600", fontSize: 15 },
});
