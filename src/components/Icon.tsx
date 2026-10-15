import React from "react";
import { View, Text } from "react-native";

// Iconos dibujados con vistas y texto, sin depender de ninguna fuente de iconos
// (la fuente de @expo/vector-icons no se cargaba en el emulador).
type Props = { name: string; size?: number; color?: string };

const GLYPHS: Record<string, string> = {
  refresh: "↻",
  "swap-vertical": "↕",
  close: "×",
  heart: "♥",
  "radio-button-on": "●",
  "radio-button-off": "○",
  "arrow-back": "←",
  list: "📋",
  "list-outline": "📋",
  people: "👥",
  "people-outline": "👥",
  adult: "🔞",
  "adult-outline": "🔞",
  compass: "🧭",
  "compass-outline": "🧭",
  calendar: "📅",
  "calendar-outline": "📅",
  "stats-chart": "📊",
  "stats-chart-outline": "📊",
};

export default function Icon({ name, size = 22, color = "#fff" }: Props) {
  const box = {
    width: size,
    height: size,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  if (name === "menu") {
    const barHeight = Math.max(2, Math.round(size / 11));
    const bar = {
      width: size * 0.85,
      height: barHeight,
      borderRadius: barHeight,
      backgroundColor: color,
    };
    return (
      <View style={[box, { justifyContent: "space-between", paddingVertical: size * 0.15 }]}>
        <View style={bar} />
        <View style={bar} />
        <View style={bar} />
      </View>
    );
  }

  if (name === "search") {
    const ring = size * 0.62;
    const stroke = Math.max(2, Math.round(size / 10));
    return (
      <View style={box}>
        <View
          style={{
            position: "absolute",
            top: size * 0.06,
            left: size * 0.06,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: stroke,
            borderColor: color,
          }}
        />
        <View
          style={{
            position: "absolute",
            right: size * 0.04,
            bottom: size * 0.16,
            width: size * 0.36,
            height: stroke,
            borderRadius: stroke,
            backgroundColor: color,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </View>
    );
  }

  const glyph = GLYPHS[name] ?? "•";
  // los iconos "-outline" de la barra de abajo son los inactivos: más apagados
  const dim = name.endsWith("-outline") ? 0.55 : 1;
  return (
    <View style={box}>
      <Text
        style={{
          color,
          fontSize: name === "close" ? size * 1.3 : size * 0.95,
          lineHeight: size * 1.2,
          opacity: dim,
          includeFontPadding: false,
        }}
      >
        {glyph}
      </Text>
    </View>
  );
}
