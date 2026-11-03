import { getAdminFirestore, WALL_DOCUMENT_PATH } from "@/lib/firebase-admin";
import { parsePhotos } from "@/lib/photo-library";
import {
  WALL_CAPACITY,
  WALL_PROTECTED_NEWEST,
  WALL_RANDOM_MS,
  type Slot,
  type StoredPhoto,
  type WallResponse,
  type WallState,
} from "@/lib/types";

function asState(input: unknown): WallState | null {
  try {
    const value = (typeof input === "string" ? JSON.parse(input) : input) as WallState;
    if (!value || !Array.isArray(value.slots) || value.slots.length !== WALL_CAPACITY ||
        !Number.isFinite(value.lastProcessedOrder) || !Number.isFinite(value.lastRandomAt)) return null;
    return value;
  } catch {
    return null;
  }
}

function newState(photos: StoredPhoto[], now: number): WallState {
  const recent = photos.slice(-WALL_CAPACITY);
  const slots: Slot[] = Array.from({ length: WALL_CAPACITY }, (_, i) => {
    const photo = recent[i];
    return photo ? { id: photo.id, order: photo.order } : null;
  });
  return {
    slots,
    lastProcessedOrder: photos.at(-1)?.order ?? 0,
    lastRandomAt: now,
  };
}

function rotateOldPhotos(slots: Slot[], photos: StoredPhoto[]): boolean {
  const visible = slots.flatMap((slot, index) => slot ? [index] : []);
  if (visible.length <= WALL_PROTECTED_NEWEST) return false;

  // Solo las DOS fotos incorporadas más recientemente quedan protegidas.
  visible.sort((a, b) => (slots[b]?.order ?? 0) - (slots[a]?.order ?? 0));
  const candidates = visible.slice(WALL_PROTECTED_NEWEST).sort(() => Math.random() - 0.5);
  const visibleIds = new Set(slots.flatMap((slot) => slot ? [slot.id] : []));
  const outside = photos.filter((photo) => !visibleIds.has(photo.id))
    .sort(() => Math.random() - 0.5);

  const replaceCount = Math.min(2, candidates.length, outside.length);
  let changed = false;
  for (let index = 0; index < replaceCount; index++) {
    slots[candidates[index]] = { id: outside[index].id, order: 0 };
    changed = true;
  }

  // Con la biblioteca totalmente visible, intercambia dos fotos no protegidas.
  const remaining = candidates.slice(replaceCount);
  if (remaining.length >= 2 && replaceCount < 2) {
    const [a, b] = remaining;
    [slots[a], slots[b]] = [slots[b], slots[a]];
    changed = true;
  }
  return changed;
}

export function advanceWallState(
  stored: WallState | null,
  photos: StoredPhoto[],
  now: number,
): { state: WallState; changed: boolean } {
  if (!stored) return { state: newState(photos, now), changed: true };

  const ids = new Set(photos.map((p) => p.id));
  const onScreen = new Set<string>();
  let changed = false;
  const slots = stored.slots.map((slot) => {
    if (!slot || !ids.has(slot.id) || onScreen.has(slot.id)) {
      if (slot) changed = true;
      return null;
    }
    onScreen.add(slot.id);
    return { ...slot };
  });
  const state: WallState = { ...stored, slots };

  // Procesa una captura pendiente por consulta y la muestra inmediatamente.
  const incoming = photos.find((p) => p.order > state.lastProcessedOrder);
  if (incoming) {
    let index = slots.findIndex((slot) => slot === null);
    if (index === -1) {
      index = slots.reduce((oldestIndex, slot, i) =>
        (slot?.order ?? 0) < (slots[oldestIndex]?.order ?? 0) ? i : oldestIndex, 0);
    }
    slots[index] = { id: incoming.id, order: incoming.order };
    state.lastProcessedOrder = incoming.order;
    changed = true;
  }

  // Rellena huecos sin introducir duplicados ni adelantar fotos pendientes.
  const currentIds = new Set(slots.flatMap((slot) => slot ? [slot.id] : []));
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) continue;
    const candidate = [...photos].reverse().find((p) =>
      p.order <= state.lastProcessedOrder && !currentIds.has(p.id));
    if (!candidate) continue;
    slots[i] = { id: candidate.id, order: 0 };
    currentIds.add(candidate.id);
    changed = true;
  }

  if (!incoming && now - state.lastRandomAt >= WALL_RANDOM_MS) {
    changed = rotateOldPhotos(slots, photos) || changed;
    state.lastRandomAt = now;
    changed = true;
  }
  return { state, changed };
}

function responseFromState(state: WallState, photos: StoredPhoto[]): WallResponse {
  const urls = new Map(photos.map((photo) => [photo.id, photo.url]));
  return {
    images: state.slots.map((slot) => (slot && urls.get(slot.id)) || null),
    libraryCount: photos.length,
    lastRandomAt: state.lastRandomAt,
  };
}

export async function getWallSnapshot(): Promise<WallResponse> {
  const db = getAdminFirestore();
  const ref = db.doc(WALL_DOCUMENT_PATH);

  // Firestore reintenta una transacción cuando otra pantalla actualiza el muro.
  // Así todas las pantallas comparten la misma rotación y no pisan el estado.
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const photos = parsePhotos(data?.photos);
    const now = Date.now();
    const current = asState(data?.state);
    const { state, changed } = advanceWallState(current, photos, now);

    if (changed) {
      transaction.set(ref, { state }, { merge: true });
    }
    return responseFromState(state, photos);
  });
}
