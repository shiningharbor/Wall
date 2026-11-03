import { v2 as cloudinary } from "cloudinary";

export function getCloudinary() {
  let cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  let api_key = process.env.CLOUDINARY_API_KEY;
  let api_secret = process.env.CLOUDINARY_API_SECRET;

  // Permite también el formato CLOUDINARY_URL ofrecido por Cloudinary.
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      if (url.protocol !== "cloudinary:") throw new Error("Esquema incorrecto");
      cloud_name = url.hostname;
      api_key = decodeURIComponent(url.username);
      api_secret = decodeURIComponent(url.password);
    } catch {
      throw new Error("CLOUDINARY_URL debe usar cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
    }
  }

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error("Faltan las variables privadas de Cloudinary.");
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return cloudinary;
}

export function getCloudinaryFolder() {
  return process.env.CLOUDINARY_FOLDER?.trim() || "roche-oncology-wall";
}
