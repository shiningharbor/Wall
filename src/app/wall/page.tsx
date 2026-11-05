"use client";

import { useEffect, useRef, useState } from "react";
import PhotoSlot from "@/components/PhotoSlot";
import { WALL_PRIMARY_CAPACITY, WALL_REFRESH_MS, type WallResponse } from "@/lib/types";

const EMPTY = Array.from({ length: WALL_PRIMARY_CAPACITY }, () => null);

export default function PhotoWall() {
  const [data, setData] = useState<WallResponse>({ images: EMPTY, libraryCount: 0, lastRandomAt: 0 });
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
    let mounted = true;
    const refresh = async () => {
      if (!mounted || busy.current) return;
      busy.current = true;
      try {
        const response = await fetch(`/api/wall?view=primary&t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo consultar el servidor.");
        const result = (await response.json()) as WallResponse;
        if (!Array.isArray(result.images) || result.images.length !== WALL_PRIMARY_CAPACITY) {
          throw new Error("La API devolvió una distribución incompleta.");
        }
        if (mounted) { setData(result); setError(""); }
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Error de conexión.");
      } finally {
        busy.current = false;
      }
    };
    const onVisible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(() => void refresh(), WALL_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    void refresh();
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <main className="wall-screen">
      <section className="photo-wall" aria-label="Collage de cinco fotografías Roche Oncology">
        <div className="wall-grid wall-primary-grid">
          {data.images.map((url, index) => (
            <PhotoSlot key={index} url={url} />
          ))}
        </div>
      </section>
      {debug && (
        <aside className="wall-debug" role="status">
          {error ? `Error: ${error}` : `Fotos: ${data.libraryCount} | Última rotación: ${data.lastRandomAt
            ? new Date(data.lastRandomAt).toLocaleTimeString("es-MX") : "—"} | API: 4 s`}
        </aside>
      )}
    </main>
  );
}
