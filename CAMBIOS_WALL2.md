# WALL 2 — Estiramiento completo al tamaño de pantalla

## Qué cambió

- **Sólo `/wall2`** utiliza un lienzo base de 1000 × 3500 px (misma proporción 100 × 350 cm del diseño original), dentro de un SVG que se escala con `preserveAspectRatio="none"`.
- Así se **estira toda la composición** al 100 % del ancho y el alto de la ventana, sin conservar su proporción original. Se deforman juntos fondo, fotografías, marcos, distribución, separaciones, efectos y animaciones.
- Las fotografías de Wall 2 usan `object-fit: fill`, por lo que no se recortan con `cover`: su contenido visual también se estira para rellenar cada marco.
- **Wall 1 (`/wall`) no cambia**: sigue conservando su proporción original y sus fotografías usan `object-fit: cover`.
- Las llamadas de API, la rotación de fotos, la carga y la disolvencia permanecen como antes.

## Archivos modificados

- `src/app/wall2/page.tsx`
- `src/app/globals.css` (nuevas reglas limitadas a `.wall2-*`)

## Uso

En la carpeta del proyecto:

```bash
npm ci
npm run dev
```

Abrir `http://localhost:3000/wall2`. Para producción se puede compilar con `npm run build` y luego `npm start`, con dependencias y configuración del proyecto disponibles.

El efecto no precisa fijar una resolución; cubre automáticamente pantallas horizontales, verticales o cuadradas.

## Validación

- TypeScript: `npm run typecheck` sin errores.
- ESLint: sin errores.
- Prueba de representación en Chromium con vistas de 1920 × 1080, 1080 × 1920 y 768 × 768: el marco completo ocupa el área de cada pantalla y las fotografías usan `object-fit: fill`.
- No fue posible terminar `next build` en el entorno de edición porque Next intentó descargar un paquete binario de SWC y no había acceso a la red; esto no indica un error de código.

> El estiramiento no proporcional es intencional y puede ensanchar rostros, textos o logotipos en pantallas muy distintas de la proporción original.
