"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import "./camera.css";

type Mode = "idle" | "opening" | "ready" | "sending" | "failed" | "sent";
type Facing = "user" | "environment";
type UploadedPhoto = { ok?: boolean; url?: string; error?: string };
type Selection = { deviceId?: string; facing?: Facing };

const OUTPUT_PX = 1400;
const JPEG_QUALITY = 0.92;

function deviceFacing(label: string): Facing | null {
  if (/back|rear|environment|trasera|posterior|traseira/i.test(label)) return "environment";
  if (/front|user|facetime|selfie|frontal|delantera/i.test(label)) return "user";
  return null;
}

async function requestCamera(selection: Selection): Promise<MediaStream> {
  const resolution = { width: { ideal: 1920 }, height: { ideal: 1920 } };

  if (selection.deviceId) {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...resolution, deviceId: { exact: selection.deviceId } },
    });
  }

  const facing = selection.facing ?? "user";
  try {
    // En móviles, "exact: user" prioriza la cámara frontal real.
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...resolution, facingMode: { exact: facing } },
    });
  } catch {
    // Algunos webcams de escritorio no exponen facingMode.
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...resolution, facingMode: { ideal: facing } },
    });
  }
}

export default function CameraStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const photoRef = useRef<Blob | null>(null);
  const mirrorRef = useRef(true);

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [pin, setPin] = useState("");

  const [mode, setMode] = useState<Mode>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const [notice, setNotice] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState("");
  const [activeFacing, setActiveFacing] = useState<Facing>("user");

  const [photoUrl, setPhotoUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const clearCapture = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    photoRef.current = null;
    setPreview(null);
    setPhotoUrl("");
    setQrUrl("");
  }, []);

  const openCamera = useCallback(async (selection: Selection = { facing: "user" }) => {
    const generation = ++generationRef.current;
    stopCamera();
    clearCapture();
    setNotice("");
    setMode("opening");

    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("idle");
      setNotice("Para usar la cámara se necesita HTTPS (o localhost) y permisos del navegador.");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await requestCamera(selection);
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      let available = (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === "videoinput");
      const preferredFacing = selection.facing ?? "user";
      const current = stream.getVideoTracks()[0];
      const settings = current?.getSettings();
      const found = available.find((device) => device.deviceId === settings?.deviceId);
      const detected = (settings?.facingMode as Facing | undefined) ??
        deviceFacing(found?.label ?? "");

      // Si el navegador ignoró la preferencia frontal, corregirla por deviceId.
      if (!selection.deviceId && detected && detected !== preferredFacing) {
        const preferred = available.find((device) =>
          device.deviceId !== settings?.deviceId && deviceFacing(device.label) === preferredFacing
        );
        if (preferred) {
          stream.getTracks().forEach((track) => track.stop());
          stream = await requestCamera({ deviceId: preferred.deviceId });
          available = (await navigator.mediaDevices.enumerateDevices())
            .filter((device) => device.kind === "videoinput");
        }
      }

      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) throw new Error("No se encontró el visor de cámara.");
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (generation !== generationRef.current) return;

      const track = stream.getVideoTracks()[0];
      const currentId = track?.getSettings().deviceId ?? "";
      const camera = available.find((device) => device.deviceId === currentId);
      const isFacing = (track?.getSettings().facingMode as Facing | undefined) ??
        deviceFacing(camera?.label ?? "") ?? preferredFacing;
      const isFront = isFacing === "user";
      mirrorRef.current = isFront;
      setMirrored(isFront);
      setActiveFacing(isFacing);
      setActiveDeviceId(currentId);
      setCameras(available);
      setMode("ready");
    } catch {
      if (generation !== generationRef.current) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      stream?.getTracks().forEach((track) => track.stop());
      stopCamera();
      setMode("idle");
      setNotice("No fue posible activar esta cámara. Revisa permisos, HTTPS o selecciona otra.");
    }
  }, [stopCamera, clearCapture]);

  // El servidor conserva la sesión en una cookie HttpOnly durante 10 horas.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const response = await fetch("/api/operator", { cache: "no-store" });
        const body = (await response.json()) as { authenticated?: boolean };
        if (alive) setAuthenticated(Boolean(response.ok && body.authenticated));
      } catch {
        if (alive) setNotice("No se pudo verificar la sesión del operador.");
      } finally {
        if (alive) setChecking(false);
      }
    };
    void check();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // Tras relogin por expiración, conserva una foto pendiente de reintento.
    if (authenticated && !photoRef.current) void openCamera({ facing: "user" });
  }, [authenticated, openCamera]);

  useEffect(() => () => {
    generationRef.current += 1;
    stopCamera();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, [stopCamera]);

  const unlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginBusy || !pin.trim()) return;
    setLoginBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
        cache: "no-store",
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "No se pudo ingresar.");
      setPin("");
      setAuthenticated(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo ingresar.");
    } finally {
      setLoginBusy(false);
    }
  };

  const captureSquare = async (): Promise<Blob> => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) throw new Error("La cámara no está lista.");
    const square = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - square) / 2;
    const sourceY = (video.videoHeight - square) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("No fue posible procesar la fotografía.");
    if (mirrorRef.current) {
      ctx.translate(OUTPUT_PX, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sourceX, sourceY, square, square, 0, 0, OUTPUT_PX, OUTPUT_PX);

    // JPEG 1400×1400, universalmente compatible con iPhone, Android y PC.
    // Las guías de zona segura son HTML y NO se imprimen en la foto.
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob?.type === "image/jpeg") resolve(blob);
        else reject(new Error("El navegador no pudo generar el JPG."));
      }, "image/jpeg", JPEG_QUALITY);
    });
  };

  const sendPhoto = async (blob: Blob) => {
    setMode("sending");
    setNotice("");
    try {
      const form = new FormData();
      form.append("image", blob, "roche-oncology.jpg");
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const body = (await response.json()) as UploadedPhoto;
      if (!response.ok || !body.ok) {
        if (response.status === 401) {
          setAuthenticated(false);
          throw new Error("La sesión del operador venció. Ingresa el código otra vez.");
        }
        throw new Error(body.error || "No se pudo guardar la foto.");
      }
      if (!body.url) {
        // No repetir la subida si Cloudinary ya confirmó el guardado.
        setMode("sent");
        setPhotoUrl(body.url ?? "");
        setNotice("La foto se guardó, pero el servidor no devolvió la URL del QR.");
        return;
      }

      setPhotoUrl(body.url);
      setMode("sent");
      setNotice("¡Foto enviada al muro! Escanea el QR para abrir y guardar el JPG.");
      try {
        const code = await QRCode.toDataURL(body.url, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 360,
          color: { dark: "#0755a6", light: "#ffffff" },
        });
        setQrUrl(code);
      } catch {
        // La foto ya está guardada. El enlace sigue siendo utilizable.
        setNotice("Foto guardada. No fue posible dibujar el QR, usa el enlace de descarga.");
      }
    } catch (error) {
      setMode("failed");
      setNotice(error instanceof Error ? error.message : "No se guardó la fotografía.");
    }
  };

  const handleAction = async () => {
    if (mode === "idle") { await openCamera({ facing: activeFacing }); return; }
    if (mode === "failed" && photoRef.current) {
      await sendPhoto(photoRef.current);
      return;
    }
    if (mode !== "ready") return;
    setMode("sending");
    try {
      const blob = await captureSquare();
      const objectUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objectUrl;
      photoRef.current = blob;
      setPreview(objectUrl);
      stopCamera();
      await sendPhoto(blob);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo tomar la foto.";
      await openCamera({ facing: activeFacing });
      setNotice(message);
    }
  };

  const switchCamera = () => {
    const next: Facing = activeFacing === "user" ? "environment" : "user";
    const match = cameras.find((camera) =>
      camera.deviceId !== activeDeviceId && deviceFacing(camera.label) === next
    );
    void openCamera(match ? { deviceId: match.deviceId, facing: next } : { facing: next });
  };

  const chooseCamera = (deviceId: string) => {
    const camera = cameras.find((item) => item.deviceId === deviceId);
    if (!camera) return;
    void openCamera({ deviceId, facing: deviceFacing(camera.label) ?? activeFacing });
  };

  const cameraActive = mode === "ready";
  const disabled = mode === "opening" || mode === "sending" || mode === "sent";
  const actionText: Record<Mode, string> = {
    idle: "Activar cámara", opening: "Abriendo cámara…", ready: "Tomar foto",
    sending: "Subiendo fotografía…", failed: "Reintentar envío", sent: "Foto enviada",
  };

  return (
    <main className={`studio${mode === "sent" ? " studio--sent" : ""}`}>
      <header className="studio-heading">
        <div className="studio-eyebrow">ROCHE ONCOLOGY</div>
        <div className="studio-title">Estudio fotográfico</div>
      </header>

      {checking ? (
        <p className="camera-notice" role="status">Comprobando sesión del operador…</p>
      ) : !authenticated ? (
        <form className="camera-login" onSubmit={(event) => void unlock(event)}>
          <p>Ingresa el código de operador una sola vez al iniciar el turno.</p>
          <label className="operator-input">
            <span>Código del operador</span>
            <input type="password" value={pin} placeholder="Código privado"
              autoComplete="off" onChange={(event) => { setPin(event.target.value); setNotice(""); }} />
          </label>
          <button className="shutter" type="submit" disabled={loginBusy || !pin.trim()}>
            {loginBusy ? "Validando código…" : "Iniciar sesión"}
          </button>
          <p className="camera-notice" role="status">{notice || "\u00a0"}</p>
        </form>
      ) : (
        <>
          <div className="capture-frame" aria-label="Encuadre de la fotografía">
            <div className="viewfinder">
              {!cameraActive && !preview && <span className="camera-mark" aria-hidden="true">◎</span>}
              <video ref={videoRef} autoPlay muted playsInline
                className={`camera-video${mirrored ? " mirrored" : ""}`}
                style={{ visibility: cameraActive ? "visible" : "hidden" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img className="captured-still" src={preview} alt="Fotografía capturada" />}
              {cameraActive && (
                <div className="safe-zone" aria-hidden="true">
                  <span className="safe-label">Zona segura · rostros</span>
                  <span className="safe-corner tl" /><span className="safe-corner tr" />
                  <span className="safe-corner bl" /><span className="safe-corner br" />
                </div>
              )}
            </div>
          </div>

          {mode === "sent" ? (
            <section className="camera-result" aria-live="polite">
              <h2>¡Foto enviada al muro!</h2>
              <p>Escanea el QR para abrir tu foto JPG y guardarla en tu celular.</p>
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="camera-qr" src={qrUrl} alt="Código QR de descarga de la fotografía en Cloudinary" />
              ) : (
                <p>Preparando QR…</p>
              )}
              <div className="camera-result-links">
                {photoUrl && <a href={photoUrl} target="_blank" rel="noopener noreferrer">Abrir / guardar JPG</a>}
              </div>
              <small>En iPhone, abre la foto, mantenla presionada y elige «Guardar en Fotos».</small>
              <button className="shutter" type="button" onClick={() => void openCamera({ facing: activeFacing })}>
                Nueva fotografía
              </button>
            </section>
          ) : (
            <>
              <p className="framing-tip">
                Mantén los rostros dentro del rectángulo horizontal: protege los recortes
                de las fotos grandes y las pequeñas del nuevo muro.
              </p>
              <div className="camera-controls">
                <button className="camera-switch" type="button" onClick={switchCamera}
                  disabled={mode === "opening" || mode === "sending"}>
                  ⇄ Cambiar a cámara {activeFacing === "user" ? "trasera" : "frontal"}
                </button>
                {cameras.length > 1 && (
                  <label className="camera-selector">
                    <span>Elegir cámara</span>
                    <select value={activeDeviceId} onChange={(event) => chooseCamera(event.target.value)}
                      disabled={mode === "opening" || mode === "sending"}>
                      {cameras.map((camera, index) => (
                        <option key={camera.deviceId || index} value={camera.deviceId}>
                          {camera.label || `Cámara ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <button className="shutter" disabled={disabled}
                onClick={() => void handleAction()} type="button">
                {actionText[mode]}
              </button>
              <p className="camera-notice" role="status">
                {notice || "\u00a0"}
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}
