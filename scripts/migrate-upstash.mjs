// Importa los registros del proyecto Redis anterior, reutilizando las URLs de
// Cloudinary existentes. No descarga, sube ni duplica archivos de imagen.
import { getScriptDb, registerImportedPhoto } from "./lib/firestore.mjs";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  throw new Error("Configura UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN temporalmente en .env.local.");
}
const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(["ZRANGE", "roche:wall:photos:v1", "0", "-1"]),
});
if (!response.ok) throw new Error(`Error consultando Upstash: HTTP ${response.status}`);
const payload = await response.json();
if (payload.error || !Array.isArray(payload.result)) {
  throw new Error(`Respuesta de Upstash inválida: ${String(payload.error || "sin registros")}`);
}
const photos = payload.result.map((item) => {
  try { return typeof item === "string" ? JSON.parse(item) : item; }
  catch { return null; }
}).filter((photo) => photo && typeof photo.id === "string" &&
  typeof photo.url === "string" && Number.isFinite(photo.order));
photos.sort((a, b) => a.order - b.order);

const db = getScriptDb();
let imported = 0;
let skipped = 0;
for (const photo of photos) {
  const inserted = await registerImportedPhoto(db, {
    id: photo.id,
    url: photo.url,
    createdAt: Number.isFinite(photo.createdAt) ? photo.createdAt : Date.now(),
  });
  if (inserted) imported++;
  else skipped++;
}
console.log(`Migración finalizada: ${imported} importadas, ${skipped} ya existentes.`);
console.log("El orden del catálogo se respetó; la rotación visual se reinicia con Firestore.");
