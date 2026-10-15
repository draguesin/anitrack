import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  StyleSheet,
} from "react-native";
import { APP_NAME, APP_VERSION, APP_AUTHOR, DISCORD_URL } from "../appInfo";

type Props = { visible: boolean; onClose: () => void };

export default function AboutModal({ visible, onClose }: Props) {
  const openDiscord = () => {
    Linking.openURL(DISCORD_URL).catch(() =>
      Alert.alert("No se pudo abrir el enlace", DISCORD_URL)
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView>
            <Text style={styles.title}>{APP_NAME}</Text>
            <Text style={styles.version}>Versión {APP_VERSION}</Text>

            <Text style={styles.author}>Creado por {APP_AUTHOR}</Text>

            <View style={styles.divider} />

            <Text style={styles.text}>
              {APP_NAME} está creada sin ánimo de lucro: puedes usarla gratis. Es un proyecto para
              la comunidad.
            </Text>
            <Text style={styles.text}>
              Si quieres apoyar el proyecto, únete al servidor de Discord. También es el lugar de
              contacto para dudas, fallos y sugerencias.
            </Text>

            <TouchableOpacity style={styles.discordButton} onPress={openDiscord}>
              <Text style={styles.discordText}>Unirse al servidor de Discord</Text>
            </TouchableOpacity>
            <Text style={styles.link}>{DISCORD_URL}</Text>

            <View style={styles.divider} />

            <Text style={styles.legal}>
              © {new Date().getFullYear()} {APP_AUTHOR}. Todos los derechos reservados.
            </Text>
            <Text style={styles.legal}>
              {APP_NAME} es una aplicación no oficial y no está afiliada ni respaldada por
              MyAnimeList ni por AniList. Los nombres, imágenes, datos y marcas de anime y
              personajes pertenecen a sus respectivos propietarios y se muestran con fines
              informativos.
            </Text>

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
  sheet: { backgroundColor: "#13233a", borderRadius: 12, padding: 20, maxHeight: "88%" },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center" },
  version: { color: "#9fb3c8", fontSize: 13, textAlign: "center", marginTop: 4 },
  author: {
    color: "#dfeaf5",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 14,
  },
  divider: { height: 1, backgroundColor: "#243a55", marginVertical: 18 },
  text: { color: "#dfeaf5", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  discordButton: {
    marginTop: 6,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#5865f2",
    alignItems: "center",
    justifyContent: "center",
  },
  discordText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  link: { color: "#7fb3ff", fontSize: 12, textAlign: "center", marginTop: 8 },
  legal: { color: "#9fb3c8", fontSize: 12, lineHeight: 17, marginBottom: 8 },
  close: { alignItems: "center", marginTop: 10, paddingVertical: 8 },
  closeText: { color: "#4d7cff", fontWeight: "600", fontSize: 15 },
});
