import React from "react";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AnimeDataProvider } from "./src/data/AnimeDataContext";
import LoginScreen from "./src/screens/LoginScreen";
import MainScreen from "./src/screens/MainScreen";
import StartupSplash from "./src/components/StartupSplash";

function Root() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0d1b2a",
        }}
      >
        <ActivityIndicator size="large" color="#2e51a2" />
      </View>
    );
  }

  return token ? (
    <AnimeDataProvider>
      <MainScreen />
    </AnimeDataProvider>
  ) : (
    <LoginScreen />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <StartupSplash>
          <Root />
        </StartupSplash>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
