export const WALL_CAPACITY = 10;
export const WALL_REFRESH_MS = 4000;
export const WALL_RANDOM_MS = 12000;
export const WALL_PROTECTED_NEWEST = 2;

export type StoredPhoto = {
  id: string;
  url: string;
  order: number;
  createdAt: number;
};

export type Slot = { id: string; order: number } | null;

export type WallState = {
  slots: Slot[];
  lastProcessedOrder: number;
  lastRandomAt: number;
};

export type WallResponse = {
  images: (string | null)[];
  libraryCount: number;
  lastRandomAt: number;
};
