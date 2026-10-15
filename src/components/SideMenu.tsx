import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BackupModal from "./BackupModal";
import AboutModal from "./AboutModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  userName?: string;
  userPicture?: string;
  /** casilla "Mostrar contenido +18" */
  adultEnabled?: boolean;
  onToggleAdult?: () => void;
};

export default function SideMenu({
  visible,
  onClose,
  onLogout,
  userName,
  userPicture,
  adultEnabled = false,
  onToggleAdult,
}: Props) {
  const insets = useSafeAreaInsets();
  const [backupOpen, setBackupOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.panel, { paddingTop: insets.top + 24 }]}>
          <View style={styles.profile}>
            {userPicture ? (
              <Image source={{ uri: userPicture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
            <Text style={styles.name} numberOfLines={1}>
              {userName ?? "Usuario"}
            </Text>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.item} onPress={onToggleAdult} activeOpacity={0.7}>
            <View style={[styles.checkBox, adultEnabled && styles.checkBoxOn]}>
              {adultEnabled ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.itemText}>Mostrar contenido +18</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => setBackupOpen(true)}>
            <Text style={styles.itemText}>Copia de seguridad</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => setAboutOpen(true)}>
            <Text style={styles.itemText}>Información</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              onClose();
              onLogout();
            }}
          >
            <Text style={styles.itemText}>Cerrar sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => BackHandler.exitApp()}>
            <Text style={[styles.itemText, styles.exitText]}>Salir</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      </View>
      <BackupModal visible={backupOpen} onClose={() => setBackupOpen(false)} />
      <AboutModal visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  panel: {
    width: "75%",
    maxWidth: 320,
    backgroundColor: "#172338",
    paddingHorizontal: 20,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  profile: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1c2e42" },
  avatarPlaceholder: { backgroundColor: "#1c2e42" },
  name: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#243a55", marginVertical: 20 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  itemText: { color: "#fff", fontSize: 16 },
  exitText: { color: "#ff6b6b" },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#6f8499",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: { backgroundColor: "#2e51a2", borderColor: "#2e51a2" },
  checkMark: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 16 },
});
