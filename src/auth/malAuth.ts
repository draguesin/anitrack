import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  MAL_CLIENT_ID,
  REDIRECT_URI,
  MAL_AUTH_ENDPOINT,
  MAL_TOKEN_ENDPOINT,
} from "../config";

const KEY_ACCESS = "mal_access_token";
const KEY_REFRESH = "mal_refresh_token";
const KEY_EXPIRY = "mal_expiry";

// MAL exige el método PKCE "plain": no se usa expo-auth-session porque
// esa librería bloquea "plain" por motivos de seguridad (solo permite
// S256), así que montamos el flujo a mano con expo-web-browser.

function base64UrlEncode(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    result += chars[bytes[i] >> 2];
    result += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    result += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    result += chars[bytes[i + 2] & 63];
  }
  return result.replace(/\+/g, "-").replace(/\//g, "_");
}

async function generateCodeVerifier(): Promise<string> {
  // 48 bytes es múltiplo de 3, así el base64 no necesita padding
  const bytes = await Crypto.getRandomBytesAsync(48);
  return base64UrlEncode(bytes);
}

function extractCodeFromUrl(url: string): string | null {
  const match = url.match(/[?&]code=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function loginWithMAL() {
  const codeVerifier = await generateCodeVerifier();
  // En el método "plain" el challenge es literalmente el mismo verifier,
  // sin aplicar ningún hash.
  const codeChallenge = codeVerifier;

  const authUrl =
    `${MAL_AUTH_ENDPOINT}?` +
    `response_type=code` +
    `&client_id=${encodeURIComponent(MAL_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=plain`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

  if (result.type !== "success" || !result.url) {
    throw new Error("Login cancelado o fallido");
  }

  const code = extractCodeFromUrl(result.url);
  if (!code) {
    throw new Error("MAL no devolvió un código de autorización");
  }

  const tokenResponse = await fetch(MAL_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MAL_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Error al obtener el token (${tokenResponse.status}): ${text}`);
  }

  const data = await tokenResponse.json();
  await saveTokens(data.access_token, data.refresh_token, data.expires_in);
  return data.access_token;
}

async function saveTokens(
  access: string,
  refresh: string | undefined,
  expiresIn: number | undefined
) {
  await SecureStore.setItemAsync(KEY_ACCESS, access);
  if (refresh) await SecureStore.setItemAsync(KEY_REFRESH, refresh);
  const expiry = Date.now() + (expiresIn ?? 3600) * 1000;
  await SecureStore.setItemAsync(KEY_EXPIRY, String(expiry));
}

export async function getValidAccessToken(): Promise<string | null> {
  const access = await SecureStore.getItemAsync(KEY_ACCESS);
  const expiry = await SecureStore.getItemAsync(KEY_EXPIRY);
  if (!access) return null;

  if (expiry && Date.now() < Number(expiry) - 60_000) {
    return access;
  }
  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(KEY_REFRESH);
  if (!refreshToken) return null;

  const response = await fetch(MAL_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MAL_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    await logout();
    return null;
  }

  const data = await response.json();
  await saveTokens(data.access_token, data.refresh_token, data.expires_in);
  return data.access_token;
}

export async function logout() {
  await SecureStore.deleteItemAsync(KEY_ACCESS);
  await SecureStore.deleteItemAsync(KEY_REFRESH);
  await SecureStore.deleteItemAsync(KEY_EXPIRY);
}