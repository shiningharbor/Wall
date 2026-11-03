import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const OPERATOR_COOKIE_NAME = "roche_operator_session";
export const OPERATOR_SESSION_SECONDS = 10 * 60 * 60; // Un turno de 10 horas.

function sessionSecret(): string {
  // Recomendado en producción: OPERATOR_SESSION_SECRET de 32+ caracteres aleatorios.
  // El PIN sigue funcionando como respaldo para no romper la configuración anterior.
  const secret = process.env.OPERATOR_SESSION_SECRET || process.env.UPLOAD_PIN;
  if (!secret) throw new Error("Configura UPLOAD_PIN en el servidor.");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

export function validOperatorPin(candidate: string | null): boolean {
  const expected = process.env.UPLOAD_PIN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(candidate, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createOperatorSession(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + OPERATOR_SESSION_SECONDS;
  const payload = `v1.${expiresAt}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function hasOperatorSession(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const raw = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${OPERATOR_COOKIE_NAME}=`));
  if (!raw) return false;

  const token = raw.slice(OPERATOR_COOKIE_NAME.length + 1);
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || !/^\d+$/.test(parts[1])) return false;

  const expiry = Number(parts[1]);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() / 1000) return false;

  const payload = parts.slice(0, 3).join(".");
  const supplied = parts[3];
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  const a = Buffer.from(supplied, "hex");
  const b = Buffer.from(sign(payload), "hex");
  return timingSafeEqual(a, b);
}
