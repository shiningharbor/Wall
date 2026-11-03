# Mapa de código — Roche Photo Wall / Firebase + Cloudinary

- `src/app/wall/page.tsx` — pantalla WALL en TSX, refresco cada 4 s.
- `src/app/camera/page.tsx` — cámara CAMERA en TSX, PIN, foto JPEG.
- `src/components/PhotoSlot.tsx` — transición suave entre fotos.
- `src/app/globals.css` — distribución original de 10 fotos sobre 100×350 cm.
- `src/app/api/wall/route.ts` — API que consulta y actualiza Firestore.
- `src/app/api/upload/route.ts` — valida, sube a Cloudinary, registra en Firestore.
- `src/lib/firebase-admin.ts` — conexión privada a Cloud Firestore.
- `src/lib/photo-library.ts` — registro transaccional y límite de biblioteca.
- `src/lib/photo-wall.ts` — estado compartido, rotación y prioridades.
- `src/lib/cloudinary.ts` — conexión privada a Cloudinary.
- `scripts/import-legacy.mjs` — importación de fotos de una carpeta local.
- `scripts/migrate-upstash.mjs` — migración desde Redis anterior sin duplicar fotos.
- `firestore.rules.example` — reglas de seguridad recomendadas para la colección.
- `.env.example` — variables requeridas con marcadores, sin secretos.

Para trabajar local: `npm install`, copiar `.env.example` a `.env.local`, completar credenciales nuevas, `npm run dev`. Consulta `README.md` para los pasos de Firebase y Cloudinary.
