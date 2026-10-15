import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimeData } from "../data/AnimeDataContext";
import { useSubscores, SUBSCORES } from "../data/SubscoresContext";
import { isAdultItem } from "../data/adult";
import {
  getAnimeDetails,
  updateListStatus,
  ListStatus,
  ListStatusUpdate,
} from "../api/malClient";

type Props = {
  animeId: number;
  onBack: () => void;
};

const STATUSES: { key: ListStatus; label: string }[] = [
  { key: "watching", label: "Viendo" },
  { key: "completed", label: "Completado" },
  { key: "on_hold", label: "En espera" },
  { key: "dropped", label: "Abandonado" },
  { key: "plan_to_watch", label: "Pendiente" },
];

const AIRING_TEXT: Record<string, string> = {
  finished_airing: "Finalizado",
  currently_airing: "En emisión",
  not_yet_aired: "Próximamente",
};

export default function AnimeDetailScreen({ animeId, onBack }: Props) {
  const { items, updateEntry } = useAnimeData();
  const { subscores, setSubscore } = useSubscores();
  const insets = useSafeAreaInsets();
  const item = items.find((i) => i.node.id === animeId);

  const [details, setDetails] = useState<any>(null);
  const [detailsError, setDetailsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [numberOpen, setNumberOpen] = useState(false);
  const [numberText, setNumberText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setDetailsError(false);
    getAnimeDetails(animeId)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {
        if (!cancelled) setDetailsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  if (!item) return null;

  const node = item.node;
  const ls = item.list_status ?? {};
  const watched: number = ls.num_episodes_watched ?? 0;
  const total: number = node.num_episodes ?? 0; // 0 = desconocido
  const score: number = ls.score ?? 0;
  const status: string = ls.status ?? "plan_to_watch";

  const save = async (changes: ListStatusUpdate) => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await updateListStatus(animeId, changes);
      updateEntry(animeId, result);
    } catch (e: any) {
      Alert.alert("No se pudo guardar en MyAnimeList", e.message ?? "Error desconocido");
    } finally {
      setSaving(false);
    }
  };

  const addEpisode = () => {
    if (total > 0 && watched >= total) return;
    const next = watched + 1;
    const finished = total > 0 && next >= total;
    const changes: ListStatusUpdate = { numWatchedEpisodes: next };
    if (finished) changes.status = "completed";
    else if (status !== "watching") changes.status = "watching";
    save(changes);
  };

  const removeEpisode = () => {
    if (watched <= 0) return;
    const changes: ListStatusUpdate = { numWatchedEpisodes: watched - 1 };
    if (status === "completed") changes.status = "watching";
    save(changes);
  };

  const openNumber = () => {
    setNumberText(String(watched));
    setNumberOpen(true);
  };

  const applyNumber = (value: number) => {
    let n = Math.max(0, Math.floor(value));
    if (total > 0) n = Math.min(n, total);
    setNumberOpen(false);
    if (n === watched) return;
    const changes: ListStatusUpdate = { numWatchedEpisodes: n };
    if (total > 0 && n >= total) changes.status = "completed";
    else if (n > 0 && (status === "plan_to_watch" || status === "completed")) changes.status = "watching";
    save(changes);
  };

  const changeStatus = (next: ListStatus) => {
    if (next === status) return;
    const changes: ListStatusUpdate = { status: next };
    // como en la web de MAL: al completar, los episodios pasan al total
    if (next === "completed" && total > 0) changes.numWatchedEpisodes = total;
    save(changes);
  };

  const changeScore = (n: number) => {
    // tocar la nota activa la quita
    save({ score: n === score ? 0 : n });
  };

  const mean = details?.mean ?? node.mean;
  const genres: { id: number; name: string }[] =
    details?.genres ?? node.genres ?? [];
  const studios: string = (details?.studios ?? node.studios ?? [])
    .map((s: any) => s.name)
    .join(", ");
  const infoLine = [
    details?.media_type ? String(details.media_type).toUpperCase() : null,
    details?.status ? AIRING_TEXT[details.status] ?? null : null,
    total > 0 ? `${total} eps` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const plusDisabled = saving || (total > 0 && watched >= total);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {node.title}
        </Text>
        <View style={styles.headerRight}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.topRow}>
          <Image
            source={{ uri: node.main_picture?.large ?? node.main_picture?.medium }}
            style={styles.poster}
          />
          <View style={styles.topInfo}>
            {infoLine ? <Text style={styles.infoText}>{infoLine}</Text> : null}
            {mean ? <Text style={styles.infoText}>★ {mean} en MAL</Text> : null}
            {studios ? (
              <Text style={styles.infoText} numberOfLines={2}>
                {studios}
              </Text>
            ) : null}
          </View>
        </View>

        {genres.length > 0 ? (
          <View style={styles.chipsRow}>
            {genres.map((g) => (
              <View key={g.id} style={styles.genreChip}>
                <Text style={styles.genreChipText}>{g.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progreso</Text>
          <Text style={styles.episodes}>
            {watched} / {total > 0 ? total : "?"} episodios
          </Text>
          {total > 0 ? (
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, (watched / total) * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          <View style={styles.epButtons}>
            <TouchableOpacity
              style={[styles.minusButton, (saving || watched === 0) && styles.disabled]}
              onPress={removeEpisode}
              disabled={saving || watched === 0}
            >
              <Text style={styles.minusText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.plusButton, plusDisabled && styles.disabled]}
              onPress={addEpisode}
              disabled={plusDisabled}
            >
              <Text style={styles.plusText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.minusButton, saving && styles.disabled]}
              onPress={openNumber}
              disabled={saving}
            >
              <Text style={styles.numberButtonText}>Nº</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado</Text>
          <View style={styles.chipsRow}>
            {STATUSES.map((s) => {
              const active = status === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.chip, active && styles.chipActive, saving && styles.disabled]}
                  onPress={() => changeStatus(s.key)}
                  disabled={saving}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Tu nota{score > 0 ? `: ${score}` : " (sin puntuar)"}
          </Text>
          <View style={styles.chipsRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = score === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.scoreChip, active && styles.chipActive, saving && styles.disabled]}
                  onPress={() => changeScore(n)}
                  disabled={saving}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isAdultItem(item) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Subnotas (solo en la app)</Text>
            {SUBSCORES.map((sub) => {
              const value = subscores[animeId]?.[sub.key] ?? 0;
              return (
                <View key={sub.key} style={styles.subRow}>
                  <Text style={styles.subLabel}>{sub.label}</Text>
                  <TouchableOpacity
                    style={[styles.subButton, value === 0 && styles.disabled]}
                    onPress={() => setSubscore(animeId, sub.key, value - 1)}
                    disabled={value === 0}
                  >
                    <Text style={styles.subButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.subValue}>{value > 0 ? value : "-"}</Text>
                  <TouchableOpacity
                    style={[styles.subButton, value >= 10 && styles.disabled]}
                    onPress={() => setSubscore(animeId, sub.key, value + 1)}
                    disabled={value >= 10}
                  >
                    <Text style={styles.subButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sinopsis</Text>
          {details?.synopsis ? (
            <Text style={styles.synopsis}>{details.synopsis}</Text>
          ) : detailsError ? (
            <Text style={styles.muted}>No se pudo cargar la sinopsis.</Text>
          ) : (
            <ActivityIndicator color="#4d9cf5" style={styles.spinner} />
          )}
        </View>
      </ScrollView>

      <Modal
        visible={numberOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNumberOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setNumberOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={styles.cardTitle}>Episodios vistos</Text>
            <TextInput
              style={styles.numberInput}
              value={numberText}
              onChangeText={(t: string) => setNumberText(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              maxLength={5}
            />
            <Text style={styles.muted}>
              {total > 0 ? `Máximo: ${total}` : "Este anime no tiene número de episodios fijado."}
            </Text>
            <View style={styles.numberButtons}>
              {total > 0 ? (
                <TouchableOpacity
                  style={styles.numberAllButton}
                  onPress={() => applyNumber(total)}
                >
                  <Text style={styles.numberAllText}>Todos ({total})</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.numberOkButton}
                onPress={() => applyNumber(Number(numberText || "0"))}
              >
                <Text style={styles.plusText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1b2a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "bold",
    color: "#fff",
    marginHorizontal: 14,
  },
  headerRight: { width: 26, alignItems: "center" },
  content: { padding: 12 },
  topRow: { flexDirection: "row" },
  poster: { width: 110, height: 156, borderRadius: 8, backgroundColor: "#1c2e42" },
  topInfo: { flex: 1, marginLeft: 14, justifyContent: "center", gap: 6 },
  infoText: { color: "#dfeaf5", fontSize: 14 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  genreChip: {
    backgroundColor: "#13233a",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  genreChipText: { color: "#9fb3c8", fontSize: 12 },
  card: {
    backgroundColor: "#13233a",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  episodes: { color: "#dfeaf5", fontSize: 15, marginTop: 8 },
  track: {
    height: 8,
    backgroundColor: "#1c2e42",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10,
  },
  fill: { height: 8, backgroundColor: "#4d9cf5", borderRadius: 4 },
  epButtons: { flexDirection: "row", gap: 10, marginTop: 14 },
  minusButton: {
    width: 54,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1c2e42",
    alignItems: "center",
    justifyContent: "center",
  },
  plusButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#2196f3",
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { color: "#fff", fontSize: 28, lineHeight: 30 },
  minusText: { color: "#fff", fontSize: 28, fontWeight: "700", lineHeight: 32 },
  numberButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { backgroundColor: "#13233a", borderRadius: 12, padding: 16 },
  numberInput: {
    marginTop: 12,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#1c2e42",
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  numberButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  numberAllButton: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#1c2e42",
    alignItems: "center",
    justifyContent: "center",
  },
  numberAllText: { color: "#dfeaf5", fontSize: 15, fontWeight: "600" },
  numberOkButton: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#2196f3",
    alignItems: "center",
    justifyContent: "center",
  },
  plusText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  chip: {
    backgroundColor: "#1c2e42",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scoreChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1c2e42",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#2e51a2" },
  chipText: { color: "#9fb3c8", fontSize: 14 },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  synopsis: { color: "#dfeaf5", fontSize: 14, lineHeight: 20, marginTop: 8 },
  muted: { color: "#9fb3c8", fontSize: 13, marginTop: 8 },
  spinner: { marginTop: 12 },
  subRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  subLabel: { color: "#dfeaf5", fontSize: 15, flex: 1 },
  subButton: {
    width: 40,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1c2e42",
    alignItems: "center",
    justifyContent: "center",
  },
  subButtonText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 24 },
  subValue: { color: "#fff", fontSize: 18, fontWeight: "700", width: 44, textAlign: "center" },
});
