import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

config({ path: ".env.local" });
export const WALL_DOCUMENT_PATH = "photoWalls/roche-oncology";
export const MAX_LIBRARY_PHOTOS = 1500;

function getCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  if (jsonPath) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(readFileSync(resolve(process.cwd(), jsonPath), "utf8"));
    } catch {
      throw new Error(`No se pudo leer el JSON de Firebase en ${jsonPath}.`);
    }
    if (serviceAccount?.type !== "service_account" ||
        !serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("El archivo no es un JSON válido de cuenta de servicio de Firebase.");
    }
    if (projectId && projectId !== serviceAccount.project_id) {
      throw new Error(`FIREBASE_PROJECT_ID (${projectId}) no coincide con el JSON (${serviceAccount.project_id}).`);
    }
    return {
      projectId: serviceAccount.project_id,
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    };
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error("Configura FIREBASE_SERVICE_ACCOUNT_PATH o las tres variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.");
  }
  return {
    projectId,
    credential: cert({
      projectId,
      clientEmail,
      privateKey: rawKey.replace(/\\n/g, "\n"),
    }),
  };
}

export function getScriptDb() {
  const app = getApps()[0] ?? initializeApp(getCredentials());
  return getFirestore(app);
}

export async function registerImportedPhoto(db, input) {
  const ref = db.doc(WALL_DOCUMENT_PATH);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data() ?? {};
    const photos = Array.isArray(data.photos) ? data.photos : [];
    if (photos.some((photo) => photo.id === input.id)) return false;
    if (photos.length >= MAX_LIBRARY_PHOTOS) {
      throw new Error(`Se llegó al límite de ${MAX_LIBRARY_PHOTOS} fotos.`);
    }
    const order = Math.max(Number(data.nextOrder) || 0, ...photos.map((photo) => Number(photo.order) || 0)) + 1;
    tx.set(ref, { photos: [...photos, { ...input, order }], nextOrder: order }, { merge: true });
    return true;
  });
}
