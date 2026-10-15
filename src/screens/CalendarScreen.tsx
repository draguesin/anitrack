import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Icon from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimeData } from "../data/AnimeDataContext";
import { useSettings } from "../data/SettingsContext";
import { getMyShows, getSchedule, MyShow, ScheduleEntry } from "../api/anilist";

type Props = { onOpenMenu: () => void };
type Mode = "mine" | "all";

const DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pad = (n: number) => String(n).padStart(2, "0");

// orden de los chips de día: lunes primero (getDay(): 0 = domingo)
const DAY_CHIPS: { key: number; label: string }[] = [
  { key: 1, label: "Lun" },
  { key: 2, label: "Mar" },
  { key: 3, label: "Mié" },
  { key: 4, label: "Jue" },
  { key: 5, label: "Vie" },
  { key: 6, label: "Sáb" },
  { key: 0, label: "Dom" },
];

function fmtDateTime(ms: number, withTime: boolean) {
  const d = new Date(ms);
  const day = `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return withTime ? `${day} · ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

function countdown(ms: number, now: number) {
  const diff = ms - now;
  const mins = Math.floor(Math.abs(diff) / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? `en ${text}` : `hace ${text}`;
}

type Card = {
  key: string;
  title: string;
  cover?: string;
  badge: string;
  /** instante de emisión en ms; null si solo se sabe el mes */
  at: number | null;
  hasTime: boolean;
  dateText?: string;
  extra?: string;
  mine: boolean;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function CalendarScreen({ onOpenMenu }: Props) {
  const { items } = useAnimeData();
  const { adultEnabled } = useSettings();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("mine");
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const [now, setNow] = useState(Date.now());

  const [mine, setMine] = useState<MyShow[] | null>(null);
  const [week, setWeek] = useState<ScheduleEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedMine = useRef("");
  const loadedWeek = useRef("");

  // la cuenta atrás se actualiza cada minuto
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const listById = useMemo(() => {
    const m = new Map<number, any>();
    for (const i of items) m.set(i.node.id as number, i);
    return m;
  }, [items]);

  // animes tuyos que pueden tener episodios por salir: viendo y pendientes sin terminar de emitir
  const myIds = useMemo(
    () =>
      items
        .filter(
          (i) =>
            ["watching", "plan_to_watch"].includes(i.list_status?.status) &&
            i.node.status !== "finished_airing"
        )
        .map((i) => i.node.id as number),
    [items]
  );
  const myKey = myIds.join(",");

  useEffect(() => {
    if (mode !== "mine") return;
    const key = `${myKey}|${nonce}`;
    if (loadedMine.current === key) return;
    loadedMine.current = key;
    if (myIds.length === 0) {
      setMine([]);
      return;
    }
    setLoading(true);
    setError(null);
    getMyShows(myIds)
      .then(setMine)
      .catch((e: any) => setError(e.message ?? "Error desconocido"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, myKey, nonce]);

  useEffect(() => {
    if (mode !== "all") return;
    const key = String(nonce);
    if (loadedWeek.current === key) return;
    loadedWeek.current = key;
    const from = Math.floor(startOfToday() / 1000);
    setLoading(true);
    setError(null);
    getSchedule(from, from + 7 * 86400)
      .then(setWeek)
      .catch((e: any) => setError(e.message ?? "Error desconocido"))
      .finally(() => setLoading(false));
  }, [mode, nonce]);

  const cards: Card[] = useMemo(() => {
    const out: Card[] = [];
    if (mode === "mine") {
      const today = startOfToday();
      for (const s of mine ?? []) {
        const item = listById.get(s.malId);
        if (!item) continue;
        const status = item.list_status?.status;
        const watched: number = item.list_status?.num_episodes_watched ?? 0;
        const base = {
          key: `m${s.malId}`,
          title: String(item.node.title),
          cover: item.node.main_picture?.medium as string | undefined,
          mine: true,
        };
        if (s.next) {
          const behind = s.next.episode - 1 - watched;
          out.push({
            ...base,
            badge: `EP ${s.next.episode}`,
            at: s.next.airingAt * 1000,
            hasTime: true,
            extra:
              status === "watching"
                ? behind > 0
                  ? `${behind} ep. sin ver`
                  : "Al día"
                : "En pendientes",
          });
        } else if (s.status === "NOT_YET_RELEASED" && s.start?.year) {
          const { year, month, day } = s.start;
          if (day && month) {
            const at = new Date(year as number, month - 1, day).getTime();
            if (at < today) continue;
            out.push({ ...base, badge: "Estreno", at, hasTime: false, extra: "En pendientes" });
          } else {
            out.push({
              ...base,
              badge: "Estreno",
              at: null,
              hasTime: false,
              dateText: month ? `${MONTH_SHORT[month - 1]} ${year}` : `${year}`,
              extra: "Fecha por confirmar",
            });
          }
        }
      }
    } else {
      for (const e of week ?? []) {
        if (e.adult && !adultEnabled) continue;
        const item = e.malId ? listById.get(e.malId) : undefined;
        out.push({
          key: `w${e.id}`,
          title: item ? String(item.node.title) : e.title,
          cover: e.cover ?? item?.node.main_picture?.medium,
          badge: `EP ${e.episode}`,
          at: e.airingAt * 1000,
          hasTime: true,
          extra: item ? "En tu lista" : undefined,
          mine: !!item,
        });
      }
    }
    out.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
    return out;
  }, [mode, mine, week, listById, adultEnabled]);

  const visible =
    dayFilter === null
      ? cards
      : cards.filter((c) => c.at !== null && new Date(c.at).getDay() === dayFilter);

  const refresh = () => {
    setNonce((n) => n + 1);
    setNow(Date.now());
  };

  const renderCard = ({ item: c }: { item: Card }) => (
    <View style={styles.card}>
      <View>
        {c.cover ? (
          <Image source={{ uri: c.cover }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverEmpty]} />
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{c.badge}</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {c.title}
        </Text>
        {c.extra ? (
          <Text style={[styles.extra, c.mine && styles.extraMine]}>{c.extra}</Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <View style={styles.cardBottom}>
          <Text style={styles.date}>
            {c.at !== null ? fmtDateTime(c.at, c.hasTime) : c.dateText}
          </Text>
          {c.at !== null ? (
            <Text style={styles.countdown}>{countdown(c.at, now)}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  const emptyText =
    mode === "mine"
      ? "No tienes animes en emisión o por estrenarse en Viendo ni Pendientes."
      : "No hay episodios en el calendario de esta semana.";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onOpenMenu} hitSlop={10}>
          <Icon name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendario</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={refresh} hitSlop={10}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="refresh" size={22} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDayFilter(new Date().getDay())} hitSlop={10}>
            <Text style={styles.todayText}>HOY</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.modeRow}>
        {(
          [
            { key: "mine", label: "Mis animes" },
            { key: "all", label: "Todos" },
          ] as { key: Mode; label: string }[]
        ).map((m) => {
          const active = mode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeButton, active && styles.modeActive]}
              onPress={() => setMode(m.key)}
            >
              <Text style={[styles.modeText, active && styles.modeTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daysRow}
        contentContainerStyle={styles.daysContent}
      >
        <TouchableOpacity
          style={[styles.dayChip, dayFilter === null && styles.dayActive]}
          onPress={() => setDayFilter(null)}
        >
          <Text style={[styles.dayText, dayFilter === null && styles.dayTextActive]}>
            Todos los días
          </Text>
        </TouchableOpacity>
        {DAY_CHIPS.map((d) => {
          const active = dayFilter === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              style={[styles.dayChip, active && styles.dayActive]}
              onPress={() => setDayFilter(d.key)}
            >
              <Text style={[styles.dayText, active && styles.dayTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(c: Card) => c.key}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          error ? (
            <View>
              <Text style={styles.error}>{error}</Text>
              <TouchableOpacity style={styles.retry} onPress={refresh}>
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.hint}>
              {mode === "mine"
                ? "Próximo episodio de lo que estás viendo y tienes pendiente · hora local"
                : "Todos los episodios de los próximos 7 días · hora local"}
            </Text>
          )
        }
        ListEmptyComponent={
          loading || error ? null : <Text style={styles.empty}>{emptyText}</Text>
        }
      />
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "bold", color: "#fff", marginHorizontal: 14 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 18 },
  todayText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },
  modeRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8, paddingBottom: 10 },
  modeButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#13233a",
    alignItems: "center",
    justifyContent: "center",
  },
  modeActive: { backgroundColor: "#2e51a2" },
  modeText: { color: "#9fb3c8", fontWeight: "600", fontSize: 14 },
  modeTextActive: { color: "#fff" },
  daysRow: { flexGrow: 0, flexShrink: 0, borderBottomColor: "#1c2e42", borderBottomWidth: 1 },
  daysContent: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#13233a",
  },
  dayActive: { backgroundColor: "#2e51a2" },
  dayText: { color: "#9fb3c8", fontSize: 13 },
  dayTextActive: { color: "#fff", fontWeight: "600" },
  listContent: { padding: 12, paddingBottom: 24 },
  hint: { color: "#9fb3c8", fontSize: 12, marginBottom: 10 },
  error: { color: "#ff6b6b", fontSize: 13, marginBottom: 8 },
  retry: {
    alignSelf: "flex-start",
    backgroundColor: "#2e51a2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  empty: { color: "#9fb3c8", textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  card: {
    flexDirection: "row",
    backgroundColor: "#13233a",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
    height: 124,
  },
  cover: { width: 86, height: 124, backgroundColor: "#1c2e42" },
  coverEmpty: { backgroundColor: "#1c2e42" },
  badge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(13,27,42,0.88)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cardInfo: { flex: 1, padding: 12 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  extra: { color: "#9fb3c8", fontSize: 12, marginTop: 4 },
  extraMine: { color: "#7fb3ff" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  date: { color: "#dfeaf5", fontSize: 13 },
  countdown: { color: "#4d9cf5", fontSize: 13, fontWeight: "600" },
});
