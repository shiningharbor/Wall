# WALL PRINCIPAL — GRID DE 5 FOTOGRAFÍAS

## Qué cambió

- `/wall`: exactamente **5 fotografías** en una retícula **2 + 1 + 2**: dos arriba, una grande al centro, dos abajo.
- Se mantiene la proporción física 100 × 350 cm, el fondo original, los marcos y las transiciones entre fotografías.
- API: la ruta `/api/wall?view=primary` devuelve **5** fotografías; protege siempre las **dos capturas más recientes** (de las diez disponibles en el estado compartido) y alterna otras tres cada ciclo. Esto evita que una captura nueva quede oculta al caer en las posiciones 6 a 10 del estado de Firestore.
- `/wall2`: conserva exactamente su distribución **10 fotografías**, su estiramiento 100% y su renderizado a resolución de pantalla. La consulta estándar `/api/wall` sigue devolviendo diez posiciones.
- No se cambia el esquema de datos de Firestore ni la subida de fotos.

## Archivos modificados

- `src/app/wall/page.tsx`
- `src/app/globals.css` (únicamente se añadieron estilos `.wall-primary-grid`, sin reescribir reglas para Wall 2)
- `src/lib/types.ts`
- `src/lib/photo-wall.ts`
- `src/app/api/wall/route.ts`
- `README.md` (documentación actualizada)

## Verificaciones realizadas

- Revisada sintaxis y transpilación de TypeScript de los archivos TS/TSX involucrados.
- Probada lógica de respuesta `/wall` = 5 fotos, `/wall2` = 10 fotos, incluidas las dos capturas recientes y llegada de fotos nuevas desde las posiciones 6–10.
- Vista previa en Chromium con imágenes de prueba, resoluciones 1080×1920, 1920×1080 y 768×768.
- No se ejecutó `npm run build` porque el paquete no contiene `node_modules` y no hay dependencias instaladas en el entorno de validación.

## Ejecutar

```bash
npm ci
npm run dev
```

Abre `/wall` para las cinco fotografías o `/wall2` para el muro original de diez.
