# ZONA SEGURA DE LA CÁMARA — ADAPTACIÓN AL WALL PRINCIPAL DE 5 FOTOS

## Cambios en `/camera`

- Se sustituyó la guía horizontal anterior por una guía **vertical centrada**.
- Nueva zona segura: **44 % del ancho** y **76 % del alto** del visor cuadrado; `left: 28%`, `top: 12%`.
- El texto de ayuda indica que, en `/wall`, los cuatro marcos verticales recortan los lados de la foto.
- Se ajustó la etiqueta de la guía para que no se corte en visores pequeños.

## Por qué

En la retícula de cinco fotos (2 + 1 + 2), los marcos superiores e inferiores son altos y estrechos. Un JPG cuadrado se muestra con `object-fit: cover`, conservando aproximadamente **el 51 % central del ancho** en los cuatro marcos laterales. La guía mantiene un pequeño margen dentro de esa zona visible.

## Se conserva

- Captura cuadrada **1400 × 1400 px** en JPG (sin aplicar recorte adicional por la guía).
- Cámara frontal/espejo, cambio de cámara, subida, código QR y sesiones de operador.
- `/wall`: retícula de cinco fotos, fondos y transiciones.
- `/wall2`: diez fotos, deformación a pantalla y mejora de nitidez, sin cambios.

## Pruebas

Guía comprobada con renderizado del visor en Chromium a **320 × 568**, **390 × 844**, **768 × 1024** y **1024 × 768**. En las cuatro resoluciones, la guía mantiene su tamaño relativo y el texto de la etiqueta queda visible.

**Nota:** se comprobó el diseño de la interfaz, no una cámara real ni la subida a Cloudinary.
