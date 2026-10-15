import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimeData } from "../data/AnimeDataContext";
import { useSettings } from "../data/SettingsContext";
import { useSubscores, SUBSCORES } from "../data/SubscoresContext";
import { isAdultItem } from "../data/adult";

type Props = { onOpenMenu: () => void };

const CHART_HEIGHT = 120;
const GENRES_PREVIEW = 10;

// El nivel n se alcanza con 5·n·(n+1) episodios: 10 → nivel 1, 30 → nivel 2,
// 60 → nivel 3... Cada nivel cuesta 10 episodios más que el anterior.
// Para hacerlo más fácil o más difícil, cambia este número.
const LEVEL_FACTOR = 5;

function levelFor(episodes: number) {
  let level = 0;
  while (LEVEL_FACTOR * (level + 1) * (level + 2) <= episodes) level++;
  const base = LEVEL_FACTOR * level * (level + 1);
  const next = LEVEL_FACTOR * (level + 1) * (level + 2);
  return { level, current: episodes - base, needed: next - base };
}

function ScoreChart({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <View style={styles.chart}>
      {counts.map((count, i) => {
        const h = count === 0 ? 0 : Math.max(3, (count / max) * CHART_HEIGHT);
        return (
          <View key={i} style={styles.barCol}>
            <Text style={styles.barCount}>{count}</Text>
            <View style={[styles.bar, { height: h }]} />
            <Text style={styles.barLabel}>{i + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Escala por niveles para las notas de +18
const TIERS: { label: string; min: number; max: number }[] = [
  { label: "S", min: 10, max: 10 },
  { label: "A", min: 8, max: 9 },
  { label: "B", min: 6, max: 7 },
  { label: "C", min: 4, max: 5 },
  { label: "D", min: 1, max: 3 },
];

type AnimeView = "all" | "normal" | "adult";
type AdultMode = "tiers" | "sub";

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsContent}
      style={styles.chipsRow}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function StatsScreen({ onOpenMenu }: Props) {
  const { items } = useAnimeData();
  const { adultEnabled } = useSettings();
  const { subscores } = useSubscores();
  const insets = useSafeAreaInsets();
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [animeViewState, setAnimeView] = useState<AnimeView>("all");
  const [adultMode, setAdultMode] = useState<AdultMode>("tiers");

  // sin el +18 activado en el menú, el selector no existe y se ve todo junto
  const animeView: AnimeView = adultEnabled ? animeViewState : "all";

  const stats = useMemo(() => {
    const scoreCounts: number[] = new Array(10).fill(0);
    let scoredTotal = 0;
    let scoredSum = 0;
    let episodes = 0;
    let watchedSeries = 0;
    const genreMap: Record<string, number> = {};

    for (const item of items) {
      const ls = item.list_status;
      episodes += ls?.num_episodes_watched ?? 0;

      const score = ls?.score ?? 0;
      if (score >= 1 && score <= 10) {
        scoreCounts[score - 1] += 1;
        scoredTotal += 1;
        scoredSum += score;
      }

      // series vistas y géneros favoritos: todo menos los pendientes
      if (ls?.status !== "plan_to_watch") {
        watchedSeries += 1;
        for (const g of item.node.genres ?? []) {
          genreMap[g.name] = (genreMap[g.name] ?? 0) + 1;
        }
      }
    }

    const genres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]);

    return {
      scoreCounts,
      scoredTotal,
      unscored: items.length - scoredTotal,
      mean: scoredTotal ? (scoredSum / scoredTotal).toFixed(2) : "-",
      episodes,
      watchedSeries,
      genres,
      maxGenre: genres.length ? genres[0][1] : 1,
    };
  }, [items]);

  const lvl = levelFor(stats.episodes);

  // gráfico de notas de animes según el selector (Todos / Sin +18 / +18)
  const animeScores = useMemo(() => {
    const counts: number[] = new Array(10).fill(0);
    let total = 0;
    let sum = 0;
    let all = 0;
    for (const item of items) {
      const adult = isAdultItem(item);
      if (animeView === "normal" && adult) continue;
      if (animeView === "adult" && !adult) continue;
      all += 1;
      const score = item.list_status?.score ?? 0;
      if (score >= 1 && score <= 10) {
        counts[score - 1] += 1;
        total += 1;
        sum += score;
      }
    }
    return { counts, total, unscored: all - total, mean: total ? (sum / total).toFixed(2) : "-", all };
  }, [items, animeView]);

  const tierCounts = useMemo(
    () =>
      TIERS.map((t) => {
        let n = 0;
        for (let sc = t.min; sc <= t.max; sc++) n += animeScores.counts[sc - 1];
        return n;
      }),
    [animeScores]
  );

  // medias de las subnotas de los animes +18
  const subAverages = useMemo(() => {
    const adultIds = new Set<number>(
      items.filter((i) => isAdultItem(i)).map((i) => i.node.id as number)
    );
    return SUBSCORES.map((sub) => {
      let sum = 0;
      let n = 0;
      for (const idStr of Object.keys(subscores)) {
        const id = Number(idStr);
        const v = subscores[id]?.[sub.key];
        if (v && adultIds.has(id)) {
          sum += v;
          n += 1;
        }
      }
      return { ...sub, avg: n ? sum / n : 0, n };
    });
  }, [items, subscores]);

  const cards = [
    { label: "Entradas", value: String(items.length) },
    { label: "Series vistas", value: String(stats.watchedSeries) },
    { label: "Episodios vistos", value: stats.episodes.toLocaleString("es-ES") },
    { label: "Nota media", value: stats.mean },
    { label: "Puntuados", value: String(stats.scoredTotal) },
  ];

  const genresShown = showAllGenres
    ? stats.genres
    : stats.genres.slice(0, GENRES_PREVIEW);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onOpenMenu} hitSlop={10}>
          <Icon name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Estadísticas</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.levelCard}>
          <Text style={styles.levelTitle}>Nivel {lvl.level}</Text>
          <View style={styles.levelTrack}>
            <View
              style={[
                styles.levelFill,
                { width: `${(lvl.current / lvl.needed) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.levelSub}>
            {lvl.current} / {lvl.needed} episodios para el nivel {lvl.level + 1}
          </Text>
        </View>

        <View style={styles.cardsGrid}>
          {cards.map((c) => (
            <View key={c.label} style={styles.card}>
              <Text style={styles.cardLabel}>{c.label}</Text>
              <Text style={styles.cardValue}>{c.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {animeView === "adult" ? "Notas de Hentai" : "Notas de animes"}
          </Text>
          <Text style={styles.sectionSub}>
            {animeScores.unscored} sin puntuar · media {animeScores.mean}
          </Text>

          {adultEnabled ? (
            <Chips<AnimeView>
              options={[
                { key: "all", label: "Todos" },
                { key: "normal", label: "Sin +18" },
                { key: "adult", label: "+18" },
              ]}
              value={animeView}
              onChange={setAnimeView}
            />
          ) : null}

          {animeView === "adult" ? (
            <View>
              <Chips<AdultMode>
                options={[
                  { key: "tiers", label: "Niveles (S-D)" },
                  { key: "sub", label: "Subnotas" },
                ]}
                value={adultMode}
                onChange={setAdultMode}
              />
              {adultMode === "tiers" ? (
                <View>
                  {TIERS.map((t, i) => {
                    const max = Math.max(1, ...tierCounts);
                    return (
                      <View key={t.label} style={styles.genreRow}>
                        <Text style={styles.tierLabel}>{t.label}</Text>
                        <View style={styles.genreTrack}>
                          <View
                            style={[
                              styles.genreFill,
                              { width: `${(tierCounts[i] / max) * 100}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.genreCount}>{tierCounts[i]}</Text>
                      </View>
                    );
                  })}
                  <Text style={styles.tierHint}>
                    S = 10 · A = 8-9 · B = 6-7 · C = 4-5 · D = 1-3
                  </Text>
                </View>
              ) : (
                <View>
                  {subAverages.map((sub) => (
                    <View key={sub.key} style={styles.genreRow}>
                      <Text style={styles.genreName}>{sub.label}</Text>
                      <View style={styles.genreTrack}>
                        <View
                          style={[styles.genreFill, { width: `${(sub.avg / 10) * 100}%` }]}
                        />
                      </View>
                      <Text style={styles.subAvg}>
                        {sub.n ? sub.avg.toFixed(1) : "-"}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.tierHint}>
                    Media de tus subnotas (se ponen en la ficha de cada anime +18). Solo se
                    guardan en la app.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <ScoreChart counts={animeScores.counts} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Géneros favoritos</Text>
          <Text style={styles.sectionSub}>
            Sin contar los pendientes · {stats.genres.length} géneros
          </Text>

          {genresShown.map(([name, count]) => (
            <View key={name} style={styles.genreRow}>
              <Text style={styles.genreName} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.genreTrack}>
                <View
                  style={[
                    styles.genreFill,
                    { width: `${(count / stats.maxGenre) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.genreCount}>{count}</Text>
            </View>
          ))}

          {stats.genres.length > GENRES_PREVIEW ? (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowAllGenres((v) => !v)}
            >
              <Text style={styles.moreText}>
                {showAllGenres ? "Ver menos" : `Ver todos (${stats.genres.length})`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  content: { padding: 12, paddingBottom: 24 },
  levelCard: {
    backgroundColor: "#13233a",
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  levelTitle: { color: "#fff", fontSize: 26, fontWeight: "800" },
  levelTrack: {
    height: 12,
    backgroundColor: "#1c2e42",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 12,
  },
  levelFill: { height: 12, backgroundColor: "#4d9cf5", borderRadius: 6 },
  levelSub: { color: "#9fb3c8", fontSize: 13, marginTop: 8 },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#13233a",
    borderRadius: 10,
    padding: 14,
  },
  cardLabel: { color: "#9fb3c8", fontSize: 13 },
  cardValue: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 4 },
  section: {
    backgroundColor: "#13233a",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  sectionSub: { color: "#9fb3c8", fontSize: 13, marginTop: 2, marginBottom: 12 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_HEIGHT + 44,
  },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: {
    width: "60%",
    backgroundColor: "#4d9cf5",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barCount: { color: "#dfeaf5", fontSize: 11, marginBottom: 3 },
  barLabel: { color: "#9fb3c8", fontSize: 12, marginTop: 4 },
  genreRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  genreName: { color: "#dfeaf5", fontSize: 14, width: 110 },
  genreTrack: {
    flex: 1,
    height: 10,
    backgroundColor: "#1c2e42",
    borderRadius: 5,
    overflow: "hidden",
  },
  genreFill: { height: 10, backgroundColor: "#4d9cf5", borderRadius: 5 },
  genreCount: {
    color: "#9fb3c8",
    fontSize: 13,
    width: 36,
    textAlign: "right",
  },
  chipsRow: { flexGrow: 0, marginBottom: 12 },
  chipsContent: { gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1c2e42",
  },
  chipActive: { backgroundColor: "#2e51a2" },
  chipText: { color: "#9fb3c8", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  tierLabel: { color: "#fff", fontSize: 16, fontWeight: "800", width: 30 },
  tierHint: { color: "#9fb3c8", fontSize: 12, marginTop: 12 },
  subAvg: { color: "#dfeaf5", fontSize: 13, width: 36, textAlign: "right" },
  moreButton: { alignItems: "center", paddingTop: 14, paddingBottom: 2 },
  moreText: { color: "#4d7cff", fontWeight: "600", fontSize: 14 },
});
