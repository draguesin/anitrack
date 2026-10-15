import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from "react-native";
import Icon from "../components/Icon";
import { useSwipe } from "../components/useSwipe";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimeData } from "../data/AnimeDataContext";
import { useSettings } from "../data/SettingsContext";
import { useFranchises, Franchise } from "../data/useFranchises";

const MEDIA_LABEL: Record<string, string> = {
  tv: "TV",
  movie: "Película",
  ova: "OVA",
  ona: "ONA",
  special: "Especial",
  tv_special: "Especial TV",
  music: "Música",
};
const mediaLabel = (t?: string) => (t ? MEDIA_LABEL[t] ?? t.toUpperCase() : "Anime");

type Row =
  | { kind: "item"; item: any; indent?: boolean }
  | { kind: "folder"; franchise: Franchise; members: any[] };

type StatusFilter =
  | "all"
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_watch";

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "watching", label: "Viendo" },
  { key: "plan_to_watch", label: "Pendientes" },
  { key: "on_hold", label: "En espera" },
  { key: "dropped", label: "Abandonados" },
  { key: "completed", label: "Completados" },
  { key: "all", label: "Todos" },
];

type SortMode = "az" | "za" | "recent" | "score";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "az", label: "Nombre (A-Z)" },
  { key: "za", label: "Nombre (Z-A)" },
  { key: "recent", label: "Última actualización (más reciente primero)" },
  { key: "score", label: "Tu nota (más alta primero)" },
];

type Props = {
  onOpenMenu: () => void;
  onSelectAnime: (animeId: number) => void;
};

export default function HomeScreen({ onOpenMenu, onSelectAnime }: Props) {
  const { items, refreshing, refresh } = useAnimeData();
  const insets = useSafeAreaInsets();
  const { groupFranchises, toggleGroup } = useSettings();
  const { groupOf, progress, error: groupError } = useFranchises(items, groupFranchises);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("watching");

  // deslizar a izquierda/derecha cambia de pestaña (Viendo → Pendientes → ...)
  const goTab = (delta: number) => {
    const i = TABS.findIndex((t) => t.key === statusFilter);
    const target = TABS[i + delta];
    if (target) setStatusFilter(target.key);
  };
  const swipe = useSwipe(() => goTab(1), () => goTab(-1));
  const tabsRef = useRef<any>(null);
  const tabX = useRef<Record<string, number>>({});
  useEffect(() => {
    const x = tabX.current[statusFilter];
    if (x !== undefined) tabsRef.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, [statusFilter]);
  const [sortMode, setSortMode] = useState<SortMode>("az");
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  // filtros dentro de la búsqueda: notas (se pueden marcar varias, "none" = sin puntuar)
  // y etiquetas de género (se pueden marcar varias: salen las que tienen todas)
  const [scoreSel, setScoreSel] = useState<(number | "none")[]>([]);
  const [genreSel, setGenreSel] = useState<string[]>([]);
  const searchActive =
    searching && (query.trim().length > 0 || scoreSel.length > 0 || genreSel.length > 0);

  const toggleScore = (v: number | "none") =>
    setScoreSel((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleGenre = (g: string) =>
    setGenreSel((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
    setScoreSel([]);
    setGenreSel([]);
  };

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      all: items.length,
      watching: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
      plan_to_watch: 0,
    };
    for (const item of items) {
      const status = item.list_status?.status;
      if (status && result[status] !== undefined) {
        result[status] += 1;
      }
    }
    return result;
  }, [items]);

  // lo de la pestaña elegida (o todo, si estás en "Todos")
  const tabItems =
    statusFilter === "all"
      ? items
      : items.filter((item) => item.list_status?.status === statusFilter);

  // al buscar, solo se mira dentro de esa pestaña: por nombre, por nota y por género
  const filteredItems = searchActive
    ? tabItems.filter((item) => {
        const q = query.trim().toLowerCase();
        if (q && !String(item.node.title).toLowerCase().includes(q)) return false;
        if (scoreSel.length > 0) {
          const score: number = item.list_status?.score ?? 0;
          const ok = scoreSel.some((v) => (v === "none" ? score === 0 : score === v));
          if (!ok) return false;
        }
        if (genreSel.length > 0) {
          const names: string[] = (item.node.genres ?? []).map((g: any) => g.name);
          if (!genreSel.every((g) => names.includes(g))) return false;
        }
        return true;
      })
    : tabItems;

  // etiquetas que hay en la pestaña actual (con cuántos animes tiene cada una)
  const genreOptions = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of tabItems) {
      for (const g of item.node.genres ?? []) map[g.name] = (map[g.name] ?? 0) + 1;
    }
    for (const g of genreSel) if (map[g] === undefined) map[g] = 0;
    return Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, statusFilter, genreSel]);

  const displayedItems = [...filteredItems].sort((a, b) => {
    switch (sortMode) {
      case "za":
        return b.node.title.localeCompare(a.node.title);
      case "recent": {
        // MAL no da la fecha en que añadiste el anime: usamos la de la última modificación
        const da = Date.parse(a.list_status?.updated_at ?? "") || 0;
        const db = Date.parse(b.list_status?.updated_at ?? "") || 0;
        return db - da;
      }
      case "score":
        return (
          (b.list_status?.score ?? 0) - (a.list_status?.score ?? 0) ||
          a.node.title.localeCompare(b.node.title)
        );
      default:
        return a.node.title.localeCompare(b.node.title);
    }
  });

  // carpetas: los animes de una misma franquicia que coinciden en la vista actual
  // (con una búsqueda activa se ve la lista plana)
  const rows: Row[] = [];
  if (groupFranchises && !searchActive) {
    const buckets = new Map<string, any[]>();
    for (const item of displayedItems) {
      const f = groupOf.get(item.node.id);
      if (!f) continue;
      if (!buckets.has(f.key)) buckets.set(f.key, []);
      buckets.get(f.key)!.push(item);
    }
    const emitted = new Set<string>();
    for (const item of displayedItems) {
      const f = groupOf.get(item.node.id);
      const members = f ? buckets.get(f.key)! : null;
      if (!f || !members || members.length < 2) {
        rows.push({ kind: "item", item });
        continue;
      }
      if (emitted.has(f.key)) continue;
      emitted.add(f.key);
      const ordered = [...members].sort(
        (a, b) => f.memberIds.indexOf(a.node.id) - f.memberIds.indexOf(b.node.id)
      );
      rows.push({ kind: "folder", franchise: f, members: ordered });
      if (expanded.has(f.key)) {
        for (const m of ordered) rows.push({ kind: "item", item: m, indent: true });
      }
    }
  } else {
    for (const item of displayedItems) rows.push({ kind: "item", item });
  }

  const toggleFolder = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === "folder") {
      const open = expanded.has(row.franchise.key);
      const typeCounts: Record<string, number> = {};
      for (const m of row.members) {
        const label = mediaLabel(m.node.media_type);
        typeCounts[label] = (typeCounts[label] ?? 0) + 1;
      }
      const scores = row.members
        .map((m) => m.list_status?.score ?? 0)
        .filter((n: number) => n > 0);
      const mean = scores.length
        ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)
        : "-";
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => toggleFolder(row.franchise.key)}
        >
          <View style={styles.stack}>
            <View style={styles.stackBack} />
            <Image
              source={{ uri: row.members[0].node.main_picture?.medium }}
              style={styles.poster}
            />
          </View>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>
              {open ? "▾ " : "▸ "}
              {row.franchise.title}
            </Text>
            <Text style={styles.meta}>
              {row.members.length} entradas ·{" "}
              {Object.entries(typeCounts)
                .map(([label, n]) => `${n} ${label}`)
                .join(" · ")}
            </Text>
            <Text style={styles.meta}>Nota media: {mean}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const item = row.item;
    return (
      <TouchableOpacity
        style={[styles.row, row.indent && styles.rowIndent]}
        activeOpacity={0.7}
        onPress={() => onSelectAnime(item.node.id)}
      >
        <Image source={{ uri: item.node.main_picture?.medium }} style={styles.poster} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {item.node.title}
          </Text>
          <Text style={styles.meta}>
            {row.indent ? `${mediaLabel(item.node.media_type)} · ` : ""}
            {item.list_status?.status} · Ep {item.list_status?.num_episodes_watched}/
            {item.node.num_episodes || "?"}
          </Text>
          <Text style={styles.meta}>Tu nota: {item.list_status?.score || "-"}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onOpenMenu} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Icon name="menu" size={26} color="#fff" />
        </TouchableOpacity>

        {searching ? (
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en esta lista..."
            placeholderTextColor="#6f8499"
            returnKeyType="search"
            autoFocus
          />
        ) : (
          <Text style={styles.headerTitle}>
            Mi lista ({displayedItems.length}/{items.length})
          </Text>
        )}

        <View style={styles.headerIcons}>
          {!searching ? (
            <TouchableOpacity onPress={refresh} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={styles.headerIcon}>
              {refreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="refresh" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={searching ? closeSearch : () => setSearching(true)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={styles.headerIcon}
          >
            <Icon name={searching ? "close" : "search"} size={22} color="#fff" />
          </TouchableOpacity>
          {!searching ? (
            <TouchableOpacity
              onPress={() => setSortMenuVisible(true)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={styles.headerIcon}
            >
              <Icon name="swap-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={tabsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onLayout={(e: any) => {
                tabX.current[tab.key] = e.nativeEvent.layout.x;
              }}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label} ({counts[tab.key] ?? 0})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {searching ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scoreRow}
            contentContainerStyle={styles.tabsContent}
          >
            <TouchableOpacity
              style={[styles.scoreChip, scoreSel.length === 0 && styles.tabActive]}
              onPress={() => setScoreSel([])}
            >
              <Text style={[styles.tabText, scoreSel.length === 0 && styles.tabTextActive]}>
                Todas las notas
              </Text>
            </TouchableOpacity>
            {([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, "none"] as (number | "none")[]).map((v) => {
              const active = scoreSel.includes(v);
              return (
                <TouchableOpacity
                  key={String(v)}
                  style={[styles.scoreChip, active && styles.tabActive]}
                  onPress={() => toggleScore(v)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {v === "none" ? "Sin nota" : `Nota ${v}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scoreRow}
            contentContainerStyle={styles.tabsContent}
          >
            <TouchableOpacity
              style={[styles.scoreChip, genreSel.length === 0 && styles.tabActive]}
              onPress={() => setGenreSel([])}
            >
              <Text style={[styles.tabText, genreSel.length === 0 && styles.tabTextActive]}>
                Todas las etiquetas
              </Text>
            </TouchableOpacity>
            {genreOptions.map(([name, count]) => {
              const active = genreSel.includes(name);
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.scoreChip, active && styles.tabActive]}
                  onPress={() => toggleGenre(name)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Modal
        visible={sortMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setSortMenuVisible(false)}
        >
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>Ordenar por</Text>
            {SORT_OPTIONS.map((o) => {
              const active = sortMode === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={styles.sortOption}
                  onPress={() => {
                    setSortMode(o.key);
                    setSortMenuVisible(false);
                  }}
                >
                  <Icon
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={active ? "#4d7cff" : "#9fb3c8"}
                  />
                  <Text style={[styles.sortLabel, active && styles.sortLabelActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.sortOption}
              onPress={() => {
                toggleGroup();
                setSortMenuVisible(false);
              }}
            >
              <View style={[styles.checkbox, groupFranchises && styles.checkboxOn]}>
                {groupFranchises ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={[styles.sortLabel, groupFranchises && styles.sortLabelActive]}>
                Agrupar temporadas, películas y OVAs en carpetas
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={{ flex: 1 }} {...swipe}>
      <FlatList
        data={rows}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyExtractor={(row: Row) =>
          row.kind === "folder" ? `f${row.franchise.key}` : `i${row.item.node.id}`
        }
        renderItem={renderRow}
        ListHeaderComponent={
          groupFranchises && (progress.running || groupError) ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                {groupError
                  ? groupError
                  : `Agrupando franquicias: ${progress.done}/${progress.total} (solo la primera vez)`}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{searching ? "Sin resultados." : "No hay animes en esta categoría."}</Text>
        }
      />
      </View>
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
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "bold", color: "#fff", marginHorizontal: 14 },
  searchInput: {
    flex: 1,
    height: 38,
    marginHorizontal: 14,
    backgroundColor: "#13233a",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 15,
  },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 0 },
  headerIcon: { marginLeft: 4 },
  tabsRow: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomColor: "#1c2e42",
    borderBottomWidth: 1,
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#13233a",
  },
  tabActive: { backgroundColor: "#2e51a2" },
  tabText: { color: "#9fb3c8", fontSize: 13 },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  row: {
    flexDirection: "row",
    padding: 12,
    borderBottomColor: "#1c2e42",
    borderBottomWidth: 1,
  },
  rowIndent: {
    marginLeft: 22,
    borderLeftColor: "#2e51a2",
    borderLeftWidth: 3,
    backgroundColor: "#0f2236",
  },
  stack: { width: 62, height: 86 },
  stackBack: {
    position: "absolute",
    left: 6,
    top: -4,
    width: 56,
    height: 80,
    borderRadius: 6,
    backgroundColor: "#2e51a2",
    opacity: 0.6,
  },
  divider: { height: 1, backgroundColor: "#1c2e42", marginVertical: 6 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#9fb3c8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#2e51a2", borderColor: "#2e51a2" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 16 },
  banner: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#13233a" },
  bannerText: { color: "#9fb3c8", fontSize: 12 },
  poster: { width: 56, height: 80, borderRadius: 6, backgroundColor: "#1c2e42" },
  info: { marginLeft: 12, flex: 1, justifyContent: "center" },
  title: { color: "#fff", fontSize: 15, fontWeight: "600" },
  meta: { color: "#9fb3c8", fontSize: 13, marginTop: 4 },
  scoreRow: { flexGrow: 0, flexShrink: 0, paddingTop: 10 },
  scoreChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#0f2236",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  sortSheet: { backgroundColor: "#13233a", borderRadius: 12, padding: 16 },
  sortTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 6 },
  sortOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  sortLabel: { color: "#dfeaf5", fontSize: 15, flex: 1 },
  sortLabelActive: { color: "#fff", fontWeight: "700" },
  emptyText: { color: "#9fb3c8", textAlign: "center", marginTop: 40 },
});
