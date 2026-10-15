import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Share,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
} from "react-native";
import { buildBackup, restoreBackup, summarizeBackup } from "../data/backup";

type Props = { visible: boolean; onClose: () => void };

export default function BackupModal({ visible, onClose }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const json = await buildBackup();
      await Share.share({ message: json, title: "Copia de seguridad de AniTrack" });
    } catch (e: any) {
      Alert.alert("No se pudo crear la copia", e?.message ?? "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const doRestore = () => {
    let summary: string;
    try {
      summary = summarizeBackup(text);
    } catch (e: any) {
      Alert.alert("Copia no válida", e.message);
      return;
    }
    Alert.alert(
      "Restaurar copia",
      `La copia tiene ${summary}.\n\nEsto sustituye tus notas, favoritos y listas actuales.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restaurar",
          style: "destructive",
          onPress: async () => {
            try {
              await restoreBackup(text);
              Alert.alert(
                "Copia restaurada",
                "La app se cerrará para cargar los datos. Ábrela de nuevo.",
                [{ text: "OK", onPress: () => BackHandler.exitApp() }],
                { cancelable: false }
              );
            } catch (e: any) {
              Alert.alert("No se pudo restaurar", e?.message ?? "Error desconocido");
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Copia de seguridad</Text>
            <Text style={styles.hint}>
              Guarda tus notas y favoritos de personajes, listas, subnotas y ajustes. Se exporta como
              texto: envíatelo (Telegram, Drive, correo...) y guárdalo.
            </Text>

            <TouchableOpacity style={styles.button} onPress={doExport} disabled={busy}>
              <Text style={styles.buttonText}>Exportar copia</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.label}>Restaurar: pega aquí el texto de una copia</Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              multiline
              placeholder='{"app":"AniTrack", ...}'
              placeholderTextColor="#6f8499"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.button, !text.trim() && styles.disabled]}
              onPress={doRestore}
              disabled={!text.trim()}
            >
              <Text style={styles.buttonText}>Restaurar copia</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#13233a", borderRadius: 12, padding: 16, maxHeight: "85%" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  hint: { color: "#9fb3c8", fontSize: 13, marginTop: 8, lineHeight: 18 },
  label: { color: "#fff", fontSize: 14, fontWeight: "600" },
  button: {
    marginTop: 14,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#2e51a2",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  divider: { height: 1, backgroundColor: "#243a55", marginVertical: 18 },
  input: {
    marginTop: 10,
    minHeight: 90,
    maxHeight: 160,
    borderRadius: 8,
    backgroundColor: "#1c2e42",
    color: "#fff",
    fontSize: 12,
    padding: 10,
    textAlignVertical: "top",
  },
  close: { alignItems: "center", marginTop: 16, paddingVertical: 6 },
  closeText: { color: "#4d7cff", fontWeight: "600", fontSize: 15 },
});
