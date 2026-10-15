import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import Icon from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useAnimeData } from "../data/AnimeDataContext";
import { SettingsProvider, useSettings } from "../data/SettingsContext";
import { SubscoresProvider } from "../data/SubscoresContext";
import SideMenu from "../components/SideMenu";
import HomeScreen from "./HomeScreen";
import StatsScreen from "./StatsScreen";
import DiscoverScreen from "./DiscoverScreen";
import CalendarScreen from "./CalendarScreen";
import AnimeDetailScreen from "./AnimeDetailScreen";

type Tab = "home" | "discover" | "calendar" | "stats";

const TABS: { key: Tab; label: string; icon: any; iconActive: any }[] = [
  { key: "home", label: "Animes", icon: "list-outline", iconActive: "list" },
  {
    key: "discover",
    label: "Descubrir",
    icon: "compass-outline",
    iconActive: "compass",
  },
  {
    key: "calendar",
    label: "Calendario",
    icon: "calendar-outline",
    iconActive: "calendar",
  },
  {
    key: "stats",
    label: "Estadísticas",
    icon: "stats-chart-outline",
    iconActive: "stats-chart",
  },
];

export default function MainScreen() {
  return (
    <SettingsProvider>
      <SubscoresProvider>
        <MainContent />
      </SubscoresProvider>
    </SettingsProvider>
  );
}

function MainContent() {
  const { logout } = useAuth();
  const { items, profile, loading, error, refresh } = useAnimeData();
  const insets = useSafeAreaInsets();
  const { adultEnabled, toggleAdult } = useSettings();

  const [tab, setTab] = useState<Tab>("home");
  const [menuVisible, setMenuVisible] = useState(false);
  // Descubrir no carga nada hasta que se abre por primera vez
  const [discoverOpened, setDiscoverOpened] = useState(false);
  const [calendarOpened, setCalendarOpened] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  // El botón "atrás" de Android cierra la ficha del anime en vez de salir de la app
  useEffect(() => {
    if (detailId === null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setDetailId(null);
      return true;
    });
    return () => sub.remove();
  }, [detailId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e51a2" />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={refresh}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openMenu = () => setMenuVisible(true);

  return (
    <View style={styles.container}>
      {/* Las pantallas siguen montadas para conservar filtros y scroll */}
      <View style={[styles.page, tab !== "home" && styles.hidden]}>
        <HomeScreen onOpenMenu={openMenu} onSelectAnime={setDetailId} />
      </View>
      {discoverOpened ? (
        <View style={[styles.page, tab !== "discover" && styles.hidden]}>
          <DiscoverScreen onOpenMenu={openMenu} />
        </View>
      ) : null}
      {calendarOpened ? (
        <View style={[styles.page, tab !== "calendar" && styles.hidden]}>
          <CalendarScreen onOpenMenu={openMenu} />
        </View>
      ) : null}
      <View style={[styles.page, tab !== "stats" && styles.hidden]}>
        <StatsScreen onOpenMenu={openMenu} />
      </View>

      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6 }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tabButton}
              onPress={() => {
                if (t.key === "discover") setDiscoverOpened(true);
                if (t.key === "calendar") setCalendarOpened(true);
                setTab(t.key);
              }}
            >
              <Icon
                name={active ? t.iconActive : t.icon}
                size={22}
                color={active ? "#4d7cff" : "#9fb3c8"}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {detailId !== null ? (
        <View style={styles.overlay}>
          <AnimeDetailScreen animeId={detailId} onBack={() => setDetailId(null)} />
        </View>
      ) : null}

      <SideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onLogout={logout}
        userName={profile?.name}
        userPicture={profile?.picture}
        adultEnabled={adultEnabled}
        onToggleAdult={toggleAdult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1b2a" },
  page: { flex: 1 },
  hidden: { display: "none" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0d1b2a" },
  center: {
    flex: 1,
    backgroundColor: "#0d1b2a",
    justifyContent: "center",
    alignItems: "center",
  },
  error: { color: "#ff6b6b", padding: 16, textAlign: "center" },
  retry: {
    backgroundColor: "#2e51a2",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#13233a",
    borderTopColor: "#1c2e42",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 4 },
  tabLabel: { color: "#9fb3c8", fontSize: 11, marginTop: 2 },
  tabLabelActive: { color: "#4d7cff", fontWeight: "600" },
});
