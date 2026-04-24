import React, { useEffect, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { cn } from "../lib/utils";

type Props = {
  open: boolean;
  tipo?: string | null;
  title?: string;
  subtitle?: string;
  headerLabel?: string;
  servicio: string;
  shift: string;
  unidad?: string;
  jornada?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onClose: () => void;
  onConfirm: (payload: { blob: Blob; lat: number | null; lng: number | null }) => void | Promise<void>;
};

function getTipoLabel(tipo?: string | null) {
  const normalized = String(tipo || "").toUpperCase().trim();
  if (normalized === "IN") return "Entrada";
  if (normalized === "OUT") return "Salida";
  return "Registro";
}

function formatOverlayNow(date: Date) {
  const fecha = date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const hora = date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${fecha} ${hora.toLowerCase()}`;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line.trim(), x, currentY);
  return currentY;
}

export default function CameraPunchModal({
  open,
  tipo = null,
  title,
  subtitle,
  headerLabel,
  servicio,
  shift,
  initialLat = null,
  initialLng = null,
  onClose,
  onConfirm,
}: Props) {
  const [cameraError, setCameraError] = useState("");
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [locationText, setLocationText] = useState("Obteniendo ubicación...");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [processing, setProcessing] = useState(false);

  const tipoLabel = getTipoLabel(tipo);

  const resolvedTitle = title || `Foto obligatoria de ${tipoLabel.toLowerCase()}`;
  const resolvedSubtitle =
    subtitle ||
    "Toma la foto directamente con la cámara. Debe verse claramente tu rostro y que estás en el servicio establecido.";
  const resolvedHeaderLabel = headerLabel || tipoLabel.toUpperCase();

  useEffect(() => {
    if (!open) {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedBlob(null);
      setCapturedUrl("");
      setCameraError("");
      setLat(null);
      setLng(null);
      setLocationText("Obteniendo ubicación...");
      return;
    }

    setLat(initialLat);
    setLng(initialLng);

    if (initialLat != null && initialLng != null) {
      setLocationText(`Lat: ${initialLat.toFixed(6)} | Lng: ${initialLng.toFixed(6)}`);
    } else {
      setLocationText("Ubicación no disponible");
    }
  }, [open, initialLat, initialLng]);

  const getNativeLocation = async () => {
    try {
      const permissions = await Geolocation.requestPermissions();

      const granted =
        permissions.location === "granted" ||
        permissions.coarseLocation === "granted";

      if (!granted) {
        throw new Error("Debes permitir la ubicación para continuar.");
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });

      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;

      setLat(newLat);
      setLng(newLng);
      setLocationText(`Lat: ${newLat.toFixed(6)} | Lng: ${newLng.toFixed(6)}`);

      return { lat: newLat, lng: newLng };
    } catch (err: any) {
      setLat(null);
      setLng(null);
      setLocationText("Ubicación no disponible");
      throw new Error(err?.message || "No se pudo obtener la ubicación.");
    }
  };

  const buildAnnotatedImage = async (blob: Blob) => {
    const imageUrl = URL.createObjectURL(blob);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageUrl;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("No se pudo procesar la imagen.");
      }

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const overlayHeight = Math.max(canvas.height * 0.22, 180);
      const overlayY = canvas.height - overlayHeight;

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, overlayY, canvas.width, overlayHeight);

      const paddingX = Math.max(canvas.width * 0.03, 20);
      let currentY = overlayY + Math.max(canvas.height * 0.04, 34);
      const lineHeight = Math.max(canvas.height * 0.032, 24);
      const maxTextWidth = canvas.width - paddingX * 2;

      ctx.fillStyle = "#ffffff";

      ctx.font = `bold ${Math.max(canvas.width * 0.04, 26)}px sans-serif`;
      ctx.fillText(
        `${resolvedHeaderLabel} • ${formatOverlayNow(new Date())}`,
        paddingX,
        currentY
      );

      currentY += lineHeight * 1.05;

      ctx.font = `${Math.max(canvas.width * 0.03, 20)}px sans-serif`;
      ctx.fillText(`Tipo: ${tipoLabel}`, paddingX, currentY);

      currentY += lineHeight;
      ctx.fillText(`Turno: ${shift || "No disponible"}`, paddingX, currentY);

      currentY += lineHeight;
      currentY = drawWrappedText(
        ctx,
        `Servicio: ${servicio || "No disponible"}`,
        paddingX,
        currentY,
        maxTextWidth,
        lineHeight
      );

      currentY += lineHeight;
      const ubicacionTexto =
        lat != null && lng != null
          ? `Ubicación: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          : "Ubicación: no disponible";

      drawWrappedText(ctx, ubicacionTexto, paddingX, currentY, maxTextWidth, lineHeight);

      const finalBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("No se pudo generar la imagen final."));
        }, "image/jpeg", 0.92);
      });

      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      const finalUrl = URL.createObjectURL(finalBlob);

      setCapturedBlob(finalBlob);
      setCapturedUrl(finalUrl);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const openCamera = async () => {
    setProcessing(true);
    setCameraError("");

    try {
      await getNativeLocation();

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (!photo.webPath) {
        throw new Error("No se pudo obtener la foto.");
      }

      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      await buildAnnotatedImage(blob);
    } catch (err: any) {
      setCameraError(err?.message || "No se pudo tomar la foto.");
    } finally {
      setProcessing(false);
    }
  };

  const handleUsePhoto = async () => {
    if (!capturedBlob) return;
    await onConfirm({ blob: capturedBlob, lat, lng });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-6 text-center border-b border-slate-200">
          <h3 className="text-xl font-extrabold text-slate-900">{resolvedTitle}</h3>

          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            {resolvedSubtitle}
          </p>
        </div>

        <div className="p-4">
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[300px] flex items-center justify-center">
            {capturedUrl ? (
              <img
                src={capturedUrl}
                alt="Vista previa"
                className="w-full h-auto object-cover"
              />
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="text-sm font-bold text-slate-700">
                  Toma una foto con la cámara
                </div>
                <div className="text-xs text-slate-500 mt-3">{locationText}</div>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 text-center">
              {cameraError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            {!capturedBlob ? (
              <>
                <button
                  onClick={onClose}
                  disabled={processing}
                  className={cn(
                    "py-3 rounded-2xl font-bold text-sm border",
                    processing
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  CANCELAR
                </button>

                <button
                  onClick={openCamera}
                  disabled={processing}
                  className={cn(
                    "py-3 rounded-2xl font-bold text-sm border",
                    processing
                      ? "bg-[#0dcaf2]/60 text-white border-[#0dcaf2]/60 cursor-not-allowed"
                      : "bg-[#0dcaf2] text-white border-[#0dcaf2]"
                  )}
                >
                  {processing ? "PROCESANDO..." : "ABRIR CÁMARA"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm border border-slate-200"
                >
                  CANCELAR
                </button>

                <button
                  onClick={handleUsePhoto}
                  className="py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm border border-slate-900"
                >
                  USAR FOTO
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}