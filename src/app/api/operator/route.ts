import { NextResponse } from "next/server";
import {
  createOperatorSession,
  hasOperatorSession,
  OPERATOR_COOKIE_NAME,
  OPERATOR_SESSION_SECONDS,
  validOperatorPin,
} from "@/lib/operator-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

// Si la tablet conserva su sesión, no se vuelve a pedir el PIN.
export async function GET(request: Request) {
  return NextResponse.json({ authenticated: hasOperatorSession(request) }, { headers });
}

export async function POST(request: Request) {
  let pin: unknown;
  try {
    ({ pin } = (await request.json()) as { pin?: unknown });
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400, headers });
  }
  if (typeof pin !== "string" || !validOperatorPin(pin.trim())) {
    return NextResponse.json({ ok: false, error: "Código de operador incorrecto." }, { status: 401, headers });
  }

  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(OPERATOR_COOKIE_NAME, createOperatorSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: OPERATOR_SESSION_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(OPERATOR_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
