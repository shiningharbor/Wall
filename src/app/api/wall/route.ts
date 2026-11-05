import { NextResponse } from "next/server";
import { getWallSnapshot } from "@/lib/photo-wall";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const isPrimary = new URL(request.url).searchParams.get("view") === "primary";
    return NextResponse.json(await getWallSnapshot(isPrimary ? "primary" : "full"), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[wall]", error);
    return NextResponse.json({ error: "No se pudo cargar el muro." }, { status: 500,
      headers: { "Cache-Control": "no-store" } });
  }
}
