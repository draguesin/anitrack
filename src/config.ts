// Client ID de tu aplicación registrada en https://myanimelist.net/apiconfig
export const MAL_CLIENT_ID =
  process.env.EXPO_PUBLIC_MAL_CLIENT_ID ?? "PEGA_TU_CLIENT_ID_AQUI";

// Debe coincidir EXACTAMENTE con la "App Redirect URL" que registres en MAL.
// El scheme "anitrack" viene de app.json -> expo.scheme
export const REDIRECT_URI = "anitrack://redirect";

export const MAL_AUTH_ENDPOINT = "https://myanimelist.net/v1/oauth2/authorize";
export const MAL_TOKEN_ENDPOINT = "https://myanimelist.net/v1/oauth2/token";
export const MAL_API_BASE = "https://api.myanimelist.net/v2";
