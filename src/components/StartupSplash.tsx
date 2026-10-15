import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";

// Pantalla de inicio a pantalla completa: se ve unos segundos al abrir la app y
// se desvanece (o se quita al tocarla). El splash nativo de Android 12+ solo
// permite un icono centrado, por eso esta imagen se pinta dentro de la propia app.
const SHOW_MS = 1800;
const FADE_MS = 600;

declare const require: (path: string) => any;

export default function StartupSplash({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  useEffect(() => {
    const t = setTimeout(close, SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      {children}
      {visible ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <TouchableWithoutFeedback onPress={close}>
            <View style={styles.fill}>
              <Image
                source={require("../../assets/splash-bg.jpg")}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <Text style={styles.title}>AniTrack</Text>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1b2a" },
  fill: { flex: 1, backgroundColor: "#0d1b2a", justifyContent: "flex-end", alignItems: "center" },
  title: {
    color: "#9fc0e8",
    fontSize: 22,
    fontWeight: "300",
    letterSpacing: 6,
    marginBottom: 70,
    opacity: 0.85,
  },
});
