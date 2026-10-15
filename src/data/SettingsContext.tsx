import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { readJson, writeJson } from "./storage";

const FILE = "settings.json";

type Settings = {
  /** la casilla "Mostrar contenido +18" del menú lateral */
  adultEnabled: boolean;
  /** true cuando ya dijiste una vez que eres mayor de 18: no se vuelve a preguntar */
  adultConfirmed: boolean;
  /** agrupar temporadas, películas y OVAs de un mismo anime en carpetas */
  groupFranchises: boolean;
};

type Ctx = Settings & {
  toggleAdult: () => void;
  toggleGroup: () => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    adultEnabled: false,
    adultConfirmed: false,
    groupFranchises: false,
  });
  const loaded = useRef(false);

  useEffect(() => {
    readJson<Partial<Settings>>(FILE, {}).then((saved) => {
      setSettings({
        adultEnabled: !!saved.adultEnabled && !!saved.adultConfirmed,
        adultConfirmed: !!saved.adultConfirmed,
        groupFranchises: !!saved.groupFranchises,
      });
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (loaded.current) writeJson(FILE, settings);
  }, [settings]);

  const toggleAdult = useCallback(() => {
    if (settings.adultEnabled) {
      setSettings((s) => ({ ...s, adultEnabled: false }));
      return;
    }
    if (settings.adultConfirmed) {
      setSettings((s) => ({ ...s, adultEnabled: true }));
      return;
    }
    // primera vez: se pregunta una sola vez
    Alert.alert(
      "Contenido para adultos",
      "Esto muestra las estadísticas y subnotas de los animes +18 de tu lista. ¿Eres mayor de 18 años?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, soy mayor de 18",
          onPress: () =>
            setSettings((s) => ({ ...s, adultEnabled: true, adultConfirmed: true })),
        },
      ]
    );
  }, [settings.adultEnabled, settings.adultConfirmed]);

  const toggleGroup = useCallback(() => {
    setSettings((s) => ({ ...s, groupFranchises: !s.groupFranchises }));
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, toggleAdult, toggleGroup }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings debe usarse dentro de SettingsProvider");
  return ctx;
}
