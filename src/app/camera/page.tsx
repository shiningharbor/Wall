"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "idle" | "opening" | "ready" | "sending" | "failed" | "sent";
const OUTPUT_PX = 1400;

export default function CameraStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mirrorRef = useRef(true);

  const [mode, setMode] = useState<Mode>("idle");
  const [pin, setPin] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const [notice, setNotice] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) { video.pause(); video.srcObject = null; }
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
    setPhoto(null);
  }, []);

  const openCamera = useCallback(async () => {
    const generation = ++generationRef.current;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    stopCamera();
    clearPreview();
    setNotice("");
    setMode("opening");

    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("idle");
      setNotice("La cámara requiere HTTPS y un navegador compatible.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
      });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) throw new Error("La cámara no está disponible.");
      streamRef.current = stream;
      video.srcObject = stream;
      const isFront = stream.getVideoTracks()[0]?.getSettings()?.facingMode !== "environment";
      mirrorRef.current = isFront;
      setMirrored(isFront);
      await video.play();
      if (generation !== generationRef.current) return;
      setMode("ready");
    } catch {
      if (generation !== generationRef.current) return;
      stopCamera();
      setMode("idle");
      setNotice("No se pudo abrir la cámara. Revisa permisos o activa HTTPS.");
    }
  }, [clearPreview, stopCamera]);

  useEffect(() => {
    void openCamera();
    return () => {
      generationRef.current++;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      stopCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [openCamera, stopCamera]);

  const captureSquare = async (): Promise<Blob> => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) throw new Error("La cámara no está lista.");
    const square = Math.min(video.videoWidth, video.videoHeight);
    const left = (video.videoWidth - square) / 2;
    const top = (video.videoHeight - square) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("No fue posible procesar la imagen.");
    if (mirrorRef.current) { ctx.translate(OUTPUT_PX, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, left, top, square, square, 0, 0, OUTPUT_PX, OUTPUT_PX);
    // La guía de zona segura no se captura: está fuera del canvas.
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se generó la foto.")),
        "image/jpeg", 0.88);
    });
  };

  const sendPhoto = async (blob: Blob) => {
    if (!pin.trim()) { setMode("failed"); setNotice("Introduce el código de operador."); return; }
    setMode("sending");
    setNotice("");
    try {
      const form = new FormData();
      form.append("image", blob, "captura.jpg");
      const result = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-upload-pin": pin.trim() },
        body: form,
        cache: "no-store",
      });
      const data: { ok?: boolean; error?: string } = await result.json();
      if (!result.ok || !data.ok) throw new Error(data.error || "Error al guardar la fotografía.");
      setMode("sent");
      setNotice("Fotografía enviada al muro.");
      restartTimer.current = setTimeout(() => void openCamera(), 1200);
    } catch (cause) {
      setMode("failed");
      setNotice(cause instanceof Error ? cause.message : "No se guardó la fotografía.");
    }
  };

  const handleAction = async () => {
    if (mode === "idle") { await openCamera(); return; }
    if (mode === "failed" && photo) { await sendPhoto(photo); return; }
    if (mode !== "ready") return;
    if (!pin.trim()) { setNotice("Introduce el código de operador antes de tomar la foto."); return; }
    setMode("sending");
    try {
      const blob = await captureSquare();
      const objectUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objectUrl;
      setPhoto(blob);
      setPreview(objectUrl);
      stopCamera();
      await sendPhoto(blob);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo capturar la foto.";
      await openCamera();
      setNotice(message);
    }
  };

  const cameraActive = mode === "ready";
  const disabled = mode === "opening" || mode === "sending" || mode === "sent";
  const actionText: Record<Mode, string> = {
    idle: "Activar cámara", opening: "Abriendo cámara…", ready: "Tomar foto",
    sending: "Subiendo foto…", failed: "Reintentar envío", sent: "✓ Foto enviada",
  };

  return (
    <main className="studio">
      <header className="studio-heading">
        <div className="studio-eyebrow">ROCHE ONCOLOGY</div>
        <div className="studio-title">Estudio fotográfico</div>
      </header>
      <div className="capture-frame" aria-label="Encuadre cuadrado de la fotografía">
        <div className="viewfinder">
          {!cameraActive && !preview && (
            <svg className="camera-mark" aria-hidden="true" viewBox="0 0 48 48" fill="none"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 16h8l3-4h10l3 4h8a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3z" />
              <circle cx="24" cy="27" r="8" />
            </svg>
          )}
          <video ref={videoRef} autoPlay muted playsInline
            className={`camera-video${mirrored ? " mirrored" : ""}`}
            style={{ visibility: cameraActive ? "visible" : "hidden" }} />
          {/* Previsualización local; no aparece durante la toma. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img className="captured-still" src={preview} alt="Foto capturada" />}
          {cameraActive && (
            <div className="safe-zone" aria-hidden="true">
              <span className="safe-label">Zona segura</span>
              <span className="safe-corner tl" /><span className="safe-corner tr" />
              <span className="safe-corner bl" /><span className="safe-corner br" />
            </div>
          )}
        </div>
      </div>
      <p className="framing-tip">
        Coloca rostros dentro del cuadro central: permanecerán visibles en todos los recortes del muro.
      </p>
      <label className="operator-input">
        <span>Código del operador</span>
        <input type="password" placeholder="Código privado" value={pin} autoComplete="off"
          onChange={(event) => { setPin(event.target.value); setNotice(""); }} />
      </label>
      <button className="shutter" disabled={disabled} onClick={() => void handleAction()} type="button">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="14" r="4" />
        </svg>
        {actionText[mode]}
      </button>
      <p className={`camera-notice${mode === "sent" ? " is-success" : ""}`} role="status">{notice || " "}</p>
    </main>
  );
}
