import * as FileSystem from "expo-file-system";

// Almacén de archivos JSON en el móvil (notas, favoritos, listas, caché...).
// Está pensado para no perder datos:
//  - se escribe primero en un archivo temporal y solo después sustituye al bueno
//  - cada guardado deja una copia del anterior (nombre.json.bak)
//  - si un archivo está estropeado se aparta (nombre.json.corrupt-...) en vez de
//    borrarlo, y se intenta recuperar de la copia
//  - los guardados del mismo archivo van en cola, nunca a la vez
const pathOf = (name: string) => `${FileSystem.documentDirectory}${name}`;

async function exists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

async function tryRead<T>(uri: string): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    const text = await FileSystem.readAsStringAsync(uri);
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false };
  }
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  const main = pathOf(name);

  if (await exists(main)) {
    const r = await tryRead<T>(main);
    if (r.ok) return r.value;
    console.log(`[Almacén] ${name} está dañado: se aparta y se intenta recuperar la copia`);
    try {
      await FileSystem.moveAsync({ from: main, to: `${main}.corrupt-${Date.now()}` });
    } catch {
      // si no se puede apartar, no pasa nada
    }
  }

  const bak = `${main}.bak`;
  if (await exists(bak)) {
    const r = await tryRead<T>(bak);
    if (r.ok) {
      console.log(`[Almacén] ${name} recuperado desde la copia`);
      return r.value;
    }
  }
  return fallback; // todavía no existe
}

const queues: Record<string, Promise<void>> = {};

async function doWrite(name: string, value: unknown): Promise<void> {
  const main = pathOf(name);
  const tmp = `${main}.tmp`;
  const bak = `${main}.bak`;
  try {
    await FileSystem.writeAsStringAsync(tmp, JSON.stringify(value));
    if (await exists(main)) {
      await FileSystem.deleteAsync(bak, { idempotent: true });
      await FileSystem.copyAsync({ from: main, to: bak });
    }
    await FileSystem.deleteAsync(main, { idempotent: true });
    await FileSystem.moveAsync({ from: tmp, to: main });
  } catch (e: any) {
    console.log(`[Almacén] no se pudo guardar ${name}:`, e?.message ?? e);
  }
}

export function writeJson(name: string, value: unknown): Promise<void> {
  const previous = queues[name] ?? Promise.resolve();
  const next = previous.then(() => doWrite(name, value));
  queues[name] = next;
  return next;
}
