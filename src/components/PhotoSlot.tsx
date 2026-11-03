"use client";

import { useEffect, useState } from "react";

type Props = { url: string | null };

// Se precarga cada foto antes de empezar la disolvencia de un segundo.
export default function PhotoSlot({ url }: Props) {
  const [current, setCurrent] = useState<string | null>(url);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!url) return;
    if (url === current || url === incoming) return;
    let active = true;
    const preload = new window.Image();
    preload.onload = async () => {
      try { await preload.decode(); } catch { /* onload ya confirmó el archivo. */ }
      if (active) setIncoming(url);
    };
    preload.src = url;
    return () => { active = false; preload.onload = null; };
  }, [url, current, incoming]);

  useEffect(() => {
    if (url !== null) return;
    // El muro vacía un espacio únicamente cuando el backend no tiene imagen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(null);
    setIncoming(null);
  }, [url]);

  useEffect(() => {
    if (!incoming) return;
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setVisible(true));
    });
    const done = window.setTimeout(() => {
      setCurrent(incoming);
      setIncoming(null);
      setVisible(false);
    }, 1100);
    return () => { cancelAnimationFrame(frame1); cancelAnimationFrame(frame2); window.clearTimeout(done); };
  }, [incoming]);

  return (
    <div className={`photo-cell${!current && !incoming ? " is-empty" : ""}`}>
      <div className="photo-frame-wall">
        <div className="photo-image-wall">
          {/* Usamos img deliberadamente para mantener imágenes antiguas durante el fundido. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {current && <img src={current} alt="" draggable={false} decoding="async" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {incoming && <img src={incoming} alt="" draggable={false} decoding="async"
            className={`photo-entering${visible ? " is-visible" : ""}`} />}
        </div>
      </div>
    </div>
  );
}
