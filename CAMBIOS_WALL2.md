# WALL 2 — Pantalla completa con mejor nitidez (v2)

## Cambio solicitado

Mantener el estiramiento total de Wall 2 que ya se aprobó, pero evitar que las imágenes se vean borrosas.

## Solución implementada

- Se retiró el `svg` con `foreignObject` de tamaño base `1000 × 3500`, que escalaba la composición completa como una superficie desde su resolución interna.
- Wall 2 se renderiza directamente en el tamaño **real de la pantalla** (`width: 100%; height: 100%`). Así cada fotografía y el fondo se dibujan en el tamaño final, sin el paso intermedio de escalado de `foreignObject`.
- Las fotografías conservan `object-fit: fill`. **Se estiran y deforman de arriba abajo y de izquierda a derecha**, sin recortar ni preservar su proporción.
- Se adaptaron los espacios verticales y horizontales, los marcos y los bordes con unidades relativas a cada eje para reproducir prácticamente pixel por pixel la geometría de la versión anterior.
- Se mantuvieron intactos el archivo del fondo, las fotos originales de Cloudinary, el sistema de carga, las transiciones y el orden de las imágenes.
- **Wall 1 (`/wall`) no se modificó**.

## Archivos afectados

- `src/app/wall2/page.tsx`
- `src/app/globals.css` (reglas limitadas a `.wall2-*`)

## Pruebas

- TypeScript (`npm run typecheck`): correcto.
- ESLint de `wall2/page.tsx`: correcto.
- Chromium: comprobado con una serie de 10 fotografías JPG de prueba de 1400 × 1400 píxeles, en pantallas `1920 × 1080`, `1080 × 1920` y `768 × 768`.
- Las coordenadas y el tamaño de los espacios fotografícos permanecen equivalentes a los de la versión anterior (diferencias de redondeo inferiores a 0.1 px en los tests).

## Nota sobre calidad

Los JPG capturados por el proyecto se generan a 1400 × 1400 px y se almacenan sin una transformación de reducción adicional. Esta corrección elimina el escalado intermedio del navegador, pero no puede recuperar detalle si una foto ya está desenfocada, si la cámara capturó poca luz, o si una pantalla muestra fotos con una deformación extrema. El fondo original también es un PNG de 1180 × 4134 px; para un aspecto verdaderamente 4K, sería recomendable obtener su fuente de diseño en resolución superior. No se alteró ningún elemento de marca.

## Uso

```bash
npm ci
npm run dev
```

Abrir `/wall2`. El proyecto requiere la misma configuración de Firebase y Cloudinary que antes.
