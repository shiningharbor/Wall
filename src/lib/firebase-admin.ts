import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Solo se ejecuta en el servidor (rutas API Node.js).
// Modo local recomendado: FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
// Modo hosting: FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY como variables privadas.
const APP_NAME = "roche-photo-wall";
export const WALL_DOCUMENT_PATH = "photoWalls/roche-oncology";

let cachedDb: Firestore | null = null;

type ServiceAccountJson = {
  type?: unknown;
  project_id?: unknown;
  client_email?: unknown;
  private_key?: unknown;
};

function credentialsFromEnvironment() {
  const configuredProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  if (serviceAccountPath) {
    // La ruta puede ser relativa a la carpeta del proyecto o absoluta.
    const fullPath = resolve(process.cwd(), serviceAccountPath);
    let serviceAccount: ServiceAccountJson;
    try {
      serviceAccount = JSON.parse(readFileSync(fullPath, "utf8")) as ServiceAccountJson;
    } catch {
      throw new Error(
        `No se pudo leer FIREBASE_SERVICE_ACCOUNT_PATH (${serviceAccountPath}). ` +
          "Guarda un JSON válido de cuenta de servicio en esa ruta.",
      );
    }

    if (
      serviceAccount.type !== "service_account" ||
      typeof serviceAccount.project_id !== "string" ||
      typeof serviceAccount.client_email !== "string" ||
      typeof serviceAccount.private_key !== "string"
    ) {
      throw new Error("El JSON de Firebase no tiene los campos de cuenta de servicio requeridos.");
    }

    if (configuredProjectId && serviceAccount.project_id !== configuredProjectId) {
      throw new Error(
        `La cuenta de servicio pertenece a ${serviceAccount.project_id}, ` +
          `pero FIREBASE_PROJECT_ID indica ${configuredProjectId}.`,
      );
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
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!configuredProjectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      "Configura FIREBASE_SERVICE_ACCOUNT_PATH (JSON local) o " +
        "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY (servidor).",
    );
  }

  return {
    projectId: configuredProjectId,
    credential: cert({
      projectId: configuredProjectId,
      clientEmail,
      privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
    }),
  };
}

export function getAdminFirestore(): Firestore {
  if (cachedDb) return cachedDb;

  const app = getApps().some((existing) => existing.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(credentialsFromEnvironment(), APP_NAME);

  cachedDb = getFirestore(app);
  return cachedDb;
}
