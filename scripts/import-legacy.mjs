import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { getScriptDb, WALL_DOCUMENT_PATH, registerImportedPhoto } from "./lib/firestore.mjs";

const db = getScriptDb();
let cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
let api_key = process.env.CLOUDINARY_API_KEY;
let api_secret = process.env.CLOUDINARY_API_SECRET;
if (process.env.CLOUDINARY_URL) {
  const parsed = new URL(process.env.CLOUDINARY_URL);
  if (parsed.protocol !== "cloudinary:") throw new Error("CLOUDINARY_URL no es válida.");
  cloud_name = parsed.hostname;
  api_key = decodeURIComponent(parsed.username);
  api_secret = decodeURIComponent(parsed.password);
}
if (!cloud_name || !api_key || !api_secret) {
  throw new Error("Faltan variables de Cloudinary (3 variables o CLOUDINARY_URL).");
}
cloudinary.config({ cloud_name, api_key, api_secret, secure: true });

const folder = process.env.CLOUDINARY_FOLDER?.trim() || "roche-oncology-wall";
const source = path.resolve(process.argv[2] || "legacy-captures");
const allFiles = await readdir(source, { withFileTypes: true }).catch(() => null);
if (!allFiles) throw new Error(`No existe la carpeta: ${source}`);

const photos = (await Promise.all(allFiles
  .filter((file) => file.isFile() && /\.(jpg|jpeg|png|webp|avif)$/i.test(file.name))
  .map(async (file) => ({
    name: file.name,
    path: path.join(source, file.name),
    modified: (await stat(path.join(source, file.name))).mtimeMs,
  })))).sort((a, b) => a.modified - b.modified || a.name.localeCompare(b.name));

const existing = await db.doc(WALL_DOCUMENT_PATH).get();
const knownIds = new Set((existing.data()?.photos ?? []).map((photo) => photo.id));
console.log(`Fotos encontradas: ${photos.length}. Ya registradas: ${knownIds.size}.`);

let imported = 0;
let skipped = 0;
for (const [index, file] of photos.entries()) {
  const id = `legacy_${createHash("sha256").update(file.name).digest("hex").slice(0, 20)}`;
  const publicId = `${folder}/${id}`;
  if (knownIds.has(publicId)) { skipped++; continue; }
  try {
    const uploaded = await cloudinary.uploader.upload(file.path, {
      folder,
      public_id: id,
      overwrite: true,
      unique_filename: false,
      resource_type: "image",
      invalidate: false,
    });
    const inserted = await registerImportedPhoto(db, {
      id: uploaded.public_id,
      url: uploaded.secure_url,
      createdAt: file.modified,
    });
    if (inserted) { imported++; knownIds.add(uploaded.public_id); }
    else skipped++;
    console.log(`[${index + 1}/${photos.length}] ${inserted ? "Importada" : "Omitida"}: ${file.name}`);
  } catch (error) {
    console.error(`Error con ${file.name}:`, error instanceof Error ? error.message : error);
  }
}
console.log(`Terminado. Importadas: ${imported}; omitidas: ${skipped}.`);
