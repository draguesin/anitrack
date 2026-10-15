# AniTrack

Aplicación Android para gestionar tu lista de **MyAnimeList** desde el móvil.
Hecha con React Native + Expo (TypeScript). Proyecto personal, sin ánimo de lucro.

*Android app to manage your MyAnimeList anime list. React Native + Expo + TypeScript. Personal, non-profit project.*

## Qué hace

- **Tu lista de MAL**: pestañas por estado, orden, búsqueda por título y etiqueta, filtro por nota.
- **Ficha del anime**: +1 / −1 episodio, estado, nota y sinopsis, guardado directamente en MAL.
- **Carpetas por franquicia**: agrupa temporadas, películas y OVAs de un mismo anime.
- **Descubrir**: rankings de MAL (mejor valorados, populares, en emisión...) con filtro por género.
- **Calendario**: próximos episodios de los animes que sigues (datos de la API de AniList).
- **Estadísticas**: nivel según episodios vistos, notas, géneros favoritos.
- **Copia de seguridad** de los datos que solo existen en la app.
- Navegación deslizando entre pestañas. Opción de contenido +18, desactivada por defecto.

## Tecnología

- React Native 0.76 + Expo SDK 52, TypeScript
- API oficial de MyAnimeList v2 (OAuth 2.0 con PKCE) y API GraphQL de AniList
- Tokens guardados con `expo-secure-store`; datos locales en archivos JSON con escritura segura (temporal + copia `.bak`)

## Seguridad y privacidad

- Todo el código fuente está en este repositorio, para que se pueda revisar.
- No hay `client_secret` ni claves en el código: el Client ID se lee de `.env` (ver `.env.example`).
- La app solo habla con `api.myanimelist.net` y `graphql.anilist.co`. No hay analíticas ni anuncios.
- Los datos propios (ajustes, subnotas) se quedan en el móvil.

## Cómo ejecutarlo

Necesitas Node.js, el SDK de Android y una cuenta de MyAnimeList.

1. Crea una aplicación en la configuración de la API de MAL y copia su Client ID.
2. Copia `.env.example` como `.env` y rellena `EXPO_PUBLIC_MAL_CLIENT_ID`.
   El redirect URI registrado en MAL debe coincidir con el que usa `src/auth`.
3. Instala y arranca:

```bash
npm install
npx expo prebuild
npx expo run:android
```

## Aviso

AniTrack no está afiliado a MyAnimeList ni a AniList. Los nombres y datos de los animes pertenecen a sus
respectivos propietarios. Esta es la versión pública: no incluye las funciones que dependen de leer páginas web de MAL.

## Autor

Creado por **Nogardris**. Gratis para la comunidad; si quieres apoyar el proyecto o contactar, únete al
[servidor de Discord](https://discord.gg/rfHFQ97xNV).

Licencia MIT.
