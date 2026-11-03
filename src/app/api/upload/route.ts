import sharp from "sharp";
import { NextResponse } from "next/server";
import { getCloudinary, getCloudinaryFolder } from "@/lib/cloudinary";
import { hasOperatorSession, validOperatorPin } from "@/lib/operator-session";
import { getAdminFirestore, WALL_DOCUMENT_PATH } from "@/lib/firebase-admin";
import { LibraryFullError, MAX_LIBRARY_PHOTOS, parsePhotos, registerPhoto } from "@/lib/photo-library";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // Debajo del límite de Vercel (4.5 MB).

function failure(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!hasOperatorSession(request) && !validOperatorPin(request.headers.get("x-upload-pin"))) {
    return failure(401, "Código de operador incorrecto.");
  }

  const bodySize = Number(request.headers.get("content-length") || 0);
  if (bodySize > MAX_IMAGE_BYTES + 100_000) {
    return failure(413, "La foto supera los 3 MB permitidos.");
  }

  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return failure(400, "No se recibió una fotografía.");
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return failure(413, "La foto supera los 3 MB permitidos.");
    }
    if (image.type !== "image/jpeg") {
      return failure(415, "Solo se permiten fotografías JPG.");
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height || metadata.width !== metadata.height ||
        metadata.width < 320 || metadata.width > 6000 ||
        metadata.format !== "jpeg") {
      return failure(422, "La fotografía debe ser válida, cuadrada (1:1) y de 320 a 6000 px.");
    }

    // Comprueba Firestore antes de subir a Cloudinary para evitar fotos huérfanas
    // si la base de datos no está configurada o ha llegado al límite.
    const database = getAdminFirestore();
    const existingLibrary = await database.doc(WALL_DOCUMENT_PATH).get();
    if (parsePhotos(existingLibrary.data()?.photos).length >= MAX_LIBRARY_PHOTOS) {
      return failure(409, `El muro alcanzó el límite de ${MAX_LIBRARY_PHOTOS} fotos.`);
    }

    const cloud = getCloudinary();
    // El navegador ya entregó un JPG real: no se convierte durante la descarga.
    const uploaded = await cloud.uploader.upload(`data:image/jpeg;base64,${bytes.toString("base64")}`, {
      format: "jpg",
      folder: getCloudinaryFolder(),
      resource_type: "image",
      overwrite: false,
      unique_filename: true,
    });

    const photo = await registerPhoto({
      id: uploaded.public_id,
      url: uploaded.secure_url,
      createdAt: Date.now(),
    });

    // URL DIRECTA del archivo JPG original almacenado en Cloudinary.
    // El QR debe abrir la imagen, sin transformación ni conversión posterior.
    const downloadUrl = uploaded.secure_url;

    return NextResponse.json({ ok: true, url: photo.url, downloadUrl, file: photo.id,
      width: uploaded.width, height: uploaded.height }, { status: 201,
      headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LibraryFullError) return failure(409, error.message);
    console.error("[upload]", error);
    return failure(500, "No se pudo guardar la fotografía. Revisa Cloudinary y Firebase.");
  }
}
