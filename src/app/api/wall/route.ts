import { NextResponse } from "next/server";
import { getWallSnapshot } from "@/lib/photo-wall";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getWallSnapshot(), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[wall]", error);
    return NextResponse.json({ error: "No se pudo cargar el muro." }, { status: 500,
      headers: { "Cache-Control": "no-store" } });
  }
}
