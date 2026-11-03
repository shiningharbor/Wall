import { getAdminFirestore, WALL_DOCUMENT_PATH } from "@/lib/firebase-admin";
import type { StoredPhoto } from "@/lib/types";

// Las fotos en Cloudinary; únicamente índice + estado pequeño en un documento Firestore.
// Esta implementación está diseñada para un muro de evento (~100-1000 fotos), no para una galería ilimitada.
export const MAX_LIBRARY_PHOTOS = 1500;

export class LibraryFullError extends Error {
  constructor() {
    super(`El muro alcanzó el límite de ${MAX_LIBRARY_PHOTOS} fotos. Contacta al administrador.`);
    this.name = "LibraryFullError";
  }
}

export function parsePhotos(input: unknown): StoredPhoto[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is StoredPhoto =>
    item !== null && typeof item === "object" &&
    typeof item.id === "string" && typeof item.url === "string" &&
    typeof item.order === "number" && Number.isFinite(item.order) &&
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt),
  ).sort((a, b) => a.order - b.order);
}

// Una transacción asigna el consecutivo y registra la foto de forma atómica,
// incluso cuando varias tablets suben capturas simultáneamente.
export async function registerPhoto(input: Omit<StoredPhoto, "order">): Promise<StoredPhoto> {
  const db = getAdminFirestore();
  const ref = db.doc(WALL_DOCUMENT_PATH);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const photos = parsePhotos(data?.photos);
    const existing = photos.find((photo) => photo.id === input.id);
    if (existing) return existing; // idempotente para migraciones/reintentos
    if (photos.length >= MAX_LIBRARY_PHOTOS) throw new LibraryFullError();

    const previousOrder = Math.max(
      Number.isFinite(data?.nextOrder) ? data!.nextOrder as number : 0,
      photos.at(-1)?.order ?? 0,
    );
    const photo: StoredPhoto = { ...input, order: previousOrder + 1 };
    transaction.set(ref, {
      photos: [...photos, photo],
      nextOrder: photo.order,
    }, { merge: true });
    return photo;
  });
}
