import { getScriptDb, WALL_DOCUMENT_PATH } from "./lib/firestore.mjs";

try {
  const db = getScriptDb();
  const document = await db.doc(WALL_DOCUMENT_PATH).get();
  console.log("[OK] Firebase Admin pudo conectarse a Cloud Firestore.");
  console.log(`Proyecto: ${db.projectId}`);
  console.log(`Documento del muro: ${WALL_DOCUMENT_PATH}`);
  console.log(document.exists ? "El documento ya existe." : "El documento todavía no existe (normal antes de la primera foto).");
} catch (error) {
  console.error("[ERROR] Firebase no está listo.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
