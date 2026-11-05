# Roche Oncology — Photo Wall (Next.js + Firebase + Cloudinary)

**Versión adaptada:** las fotografías residen en **Cloudinary**; el catálogo y la rotación sincronizada de las 10 posiciones residen en **Firebase Cloud Firestore**. No se usa Redis, PHP ni almacenamiento local persistente. El **Wall principal (`/wall`) muestra ahora 5 fotografías**, mientras que **Wall 2 (`/wall2`) conserva 10** con el estiramiento y la nitidez ya aprobados.

Se conserva el muro vertical de 100 × 350 cm (proporción 2:7), la cámara frontal espejo con foto JPEG 1400×1400, la guía de recorte, el refresco cada 4 segundos, la protección de las dos fotos más nuevas y los cambios aleatorios cada 12 segundos. El Wall principal usa un collage de 5 imágenes (2 + 1 + 2); Wall 2 sigue usando 10 imágenes, sin cambios en su diseño.

## Arquitectura

```text
Tablet /camera ── POST /api/upload ── Next.js (servidor)
                                      ├─> Cloudinary (JPEG público, CDN)
                                      └─> Firestore (metadatos y número de orden)

Pantalla /wall ── GET /api/wall ───── Next.js (servidor)
                                      └─> Firestore (transacción de rotación)
                                       
Wall 2 recibe las 10 posiciones originales. El Wall principal obtiene una selección de 5 de esas fotos, priorizando las dos capturas más recientes y rotando las otras tres; ambas vistas comparten el estado de Firestore.
```

**Seguridad:** las rutas de Next.js acceden a Firestore con **Firebase Admin SDK** y a Cloudinary con variables de entorno privadas. El navegador no obtiene el secreto de Cloudinary ni la cuenta de servicio de Firebase. `/camera` requiere `UPLOAD_PIN`; `/wall` y las URLs de las fotos son públicas, apropiadas para una pantalla de evento siempre que exista consentimiento para mostrar las imágenes.

## 1. Requisitos

- Node.js 20.9+ (recomendado Node 22)
- Proyecto Firebase **`revolverx-50c19`**, con base de datos **Cloud Firestore** creada
- Cuenta Cloudinary **`dwseomfxe`**
- Hosting para Next.js con Node (por ejemplo, Vercel)

La clave `apiKey` del `firebaseConfig` web no autentica al servidor como administrador. Esta versión permite indicar el **archivo JSON de la cuenta de servicio** en lugar de copiar y pegar manualmente la `private_key`. **La clave divulgada en una conversación debe revocarse y reemplazarse por otra antes de usarla.** No abras las reglas Firestore al público para compensar un problema de credenciales.

## 2. Crear Cloud Firestore y credenciales del servidor

1. En [Firebase Console](https://console.firebase.google.com/) abre el proyecto `revolverx-50c19`.
2. En **Build > Firestore Database > Create database** crea la base de datos si aún no existe (usa el modo de producción). No necesita colecciones manuales; el servidor creará `photoWalls/roche-oncology`.
3. En **Configuración del proyecto (engranaje) > Cuentas de servicio > Firebase Admin SDK**, **revoca la clave privada que compartiste en el chat** (y revisa las claves activas en Google Cloud IAM). Después, **Generar nueva clave privada** y descarga el nuevo JSON. **Nunca compartas ese archivo ni lo incluyas en un ZIP, correo o repositorio.**
4. **Local:** guarda ese JSON completo, sin modificar ni reformatear, en `secrets/firebase-service-account.json`. El proyecto lo leerá mediante `FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json`. No copies `private_key` a `.env.local` y no necesitas `FIREBASE_CLIENT_EMAIL` al usar el JSON.
5. **Servidor en Vercel:** no subas el archivo JSON. En su lugar configura las variables privadas `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`; deja **sin definir** `FIREBASE_SERVICE_ACCOUNT_PATH`.
6. Protege la colección en las reglas Firestore: revisa `firestore.rules.example`. **Integra solo la sección de `photoWalls` en las reglas actuales**, sin borrar las de otras apps que compartan el proyecto.

> Un `firebaseConfig` con `apiKey`, `authDomain`, `appId` y `measurementId` corresponde al **SDK de navegador**. Esta aplicación conserva el acceso mediado por las APIs de Next.js y, por seguridad, usa el SDK Admin solamente en servidor; basta con el `projectId` de la configuración web.

## 3. Cloudinary y rotación de credenciales

Tu `cloud_name` es `dwseomfxe`. Configura `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` como variables **privadas**, o usa una única variable `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@dwseomfxe` (sin definir las otras tres). Se recomienda **revocar y regenerar el API Secret que apareció en la conversación** y utilizar el nuevo. No se ha copiado ninguna clave secreta al código ni al ZIP.

## 4. Instalación local

```bash
npm install
cp .env.example .env.local
# Guardar un JSON privado NUEVO en secrets/firebase-service-account.json
npm run check:firebase
npm run dev
```

En Windows PowerShell: `Copy-Item .env.example .env.local`.

1. Edita `.env.local` y deja `FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json`.
2. Crea la carpeta `secrets` (ya incluida en el ZIP) y coloca dentro el **nuevo JSON de Firebase**, renombrándolo exactamente a `firebase-service-account.json`.
3. Completa la nueva clave de Cloudinary y un PIN nuevo y largo en `.env.local` (los que compartiste en la conversación deben rotarse). No dejes los ejemplos `COLOCA_...`.
4. Comprueba Firebase antes de abrir la cámara:

```bash
npm run check:firebase
```

5. Si el diagnóstico dice `[OK]`, inicia la aplicación:

```bash
npm run dev
```

`.env.local` y el directorio `secrets/` están excluidos del control de versiones. **Nunca** uses `NEXT_PUBLIC_` para los secretos.

Abre `http://localhost:3000`:

- `/camera` — tablet fotográfica con PIN.
- `/wall` — muro vertical principal con 5 fotografías.
- `/wall?debug=1` — diagnóstico de fotos y rotación.
- `/wall2` — muro de 10 fotografías, deformación total a pantalla y mejor nitidez.
- `/api/wall` — 10 fotos en JSON para Wall 2 y diagnóstico.
- `/api/wall?view=primary` — 5 fotos en JSON para Wall principal.

La cámara requiere `localhost` o **HTTPS** cuando se usa remotamente.

## 5. Recuperar el fondo aprobado

Copia `assets/images/Puerta 100x350.png` del proyecto original a:

`public/images/Puerta 100x350.png`

El archivo original no venía en el ZIP que se proporcionó. Sin él, aparece el fondo alternativo que ya tenía esta app. **No se redibujó ni modificó el arte original.**

## 6. Migrar fotos antiguas sin perderlas

Si todavía tienes el directorio `assets/captures` del sistema anterior, cópialo a `legacy-captures` y ejecuta:

```bash
npm run import:legacy
# O:
npm run import:legacy -- "C:\\ruta\\a\\capturas"
```

Las fotos van a Cloudinary y se registran en Firestore. El importador detecta IDs ya registrados y no crea entradas duplicadas. Conserva el orden de modificación de archivos para la secuencia inicial.

Si **ya tenías fotos registradas en Upstash Redis**, puedes migrar **sus URL actuales sin volver a subir archivos**. Agrega temporalmente en `.env.local` las dos variables antiguas `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, luego ejecuta:

```bash
npm run migrate:upstash
```

Cuando termines, quita las credenciales antiguas. Puedes ejecutar el migrador de nuevo sin duplicar IDs. No combines indiscriminadamente migraciones si quieres respetar un orden cronológico exacto: el orden se establece al importar.

## 7. Publicar en Vercel

1. Sube el proyecto a un repositorio sin `.env.local`, `node_modules`, `legacy-captures` ni JSON de cuenta de servicio.
2. En Vercel, **Add New > Project**, importa el repositorio (framework Next.js).
3. En **Environment Variables** agrega `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `UPLOAD_PIN` y, si quieres, `CLOUDINARY_FOLDER`. **No agregues `FIREBASE_SERVICE_ACCOUNT_PATH` en Vercel** si no existe el archivo privado en ese entorno.
4. Verifica que la clave privada conserve saltos de línea reales o caracteres `\n`; el código acepta ambas representaciones.
5. Ejecuta el despliegue. Si modificas variables, vuelve a desplegar.

Se generarán URLs como `https://tu-proyecto.vercel.app/camera` y `https://tu-proyecto.vercel.app/wall`.

## 8. Estructura de datos en Firestore

Documento: `photoWalls/roche-oncology`.

```text
photos: [{ id, url, order, createdAt }, ...]
nextOrder: número secuencial
state: { slots: [10 elementos], lastProcessedOrder, lastRandomAt }
```

El catálogo y la rotación se actualizan mediante **transacciones Firestore**, para que varias tablets o pantallas no sobrescriban los estados unas de otras. El límite deliberado es **1,500 fotos por muro**, para no superar el tamaño máximo de un documento Firestore. Para una biblioteca ilimitada se necesitaría una estructura con subcolecciones e índices, que no forma parte de esta entrega.

## 9. Verificación de código

```bash
npm run typecheck
npm run lint
npm run build
```

**Importante:** la adaptación del proyecto no crea por sí sola la base de datos Cloud Firestore, no obtiene una cuenta de servicio y no despliega el proyecto a tu cuenta. Esas acciones requieren acceso a tus cuentas. No compartas secretos privados por chat.
