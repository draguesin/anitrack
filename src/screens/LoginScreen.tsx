import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../auth/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await login();
    } catch (e: any) {
      Alert.alert("Error al iniciar sesión", e.message ?? "Inténtalo de nuevo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AniTrack</Text>
      <Text style={styles.subtitle}>Conecta tu cuenta de MyAnimeList</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Iniciar sesión con MAL</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        Se abrirá el navegador para iniciar sesión directamente en
        myanimelist.net. Tu contraseña nunca pasa por esta app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1b2a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#9fb3c8", marginBottom: 32 },
  button: {
    backgroundColor: "#2e51a2",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: {
    color: "#5a7290",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 20,
  },
});
