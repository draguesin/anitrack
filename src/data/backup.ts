import { readJson, writeJson } from "./storage";

// Copia de seguridad: lo que solo existe en la app (subnotas y ajustes).
// La caché de franquicias no se incluye: se vuelve a generar sola.
const BACKUP_FILES = ["subscores.json", "settings.json"];

export async function buildBackup(): Promise<string> {
  const files: Record<string, unknown> = {};
  for (const name of BACKUP_FILES) {
    const value = await readJson<unknown>(name, null);
    if (value !== null) files[name] = value;
  }
  return JSON.stringify({
    app: "AniTrack",
    format: 1,
    createdAt: new Date().toISOString(),
    files,
  });
}

export function summarizeBackup(text: string): string {
  const data = parseBackup(text);
  const subs = Object.keys(data.files["subscores.json"] ?? {}).length;
  return `${subs} animes con subnotas`;
}

function parseBackup(text: string): { files: Record<string, any> } {
  let data: any;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error("El texto no es una copia válida (está incompleto o mal pegado).");
  }
  if (!data || data.app !== "AniTrack" || typeof data.files !== "object" || !data.files) {
    throw new Error("Esto no parece una copia de AniTrack.");
  }
  return data;
}

/** Escribe los archivos de la copia. Después hay que reiniciar la app. */
export async function restoreBackup(text: string): Promise<void> {
  const data = parseBackup(text);
  for (const name of BACKUP_FILES) {
    if (data.files[name] !== undefined) await writeJson(name, data.files[name]);
  }
}
