import React, { useEffect, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { cn } from "../lib/utils";

type Props = {
  open: boolean;
  tipo: "IN" | "OUT";
  servicio: string;
  shift: string;
  novedades: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onClose: () => void;
  onConfirm: (payload: { blob: Blob; lat: number | null; lng: number | null }) => void;
};

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

  return `${fecha} ${hora}`;
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

export default function SupervisorCameraModal({
  open,
  tipo,
  servicio,
  shift,
  novedades,
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
  }, [open, initialLat, initialLng, capturedUrl]);

  const takeNativePhoto = async () => {
    setCameraError("");
    setProcessing(true);

    try {
      const permissions = await Camera.requestPermissions();

      const granted =
        permissions.camera === "granted" || permissions.photos === "granted";

      if (!granted) {
        throw new Error("Debes permitir la cámara para continuar.");
      }

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

      await drawOverlayOnImage(blob);
    } catch (err: any) {
      setCameraError(err?.message || "No se pudo tomar la foto.");
    } finally {
      setProcessing(false);
    }
  };

  const drawOverlayOnImage = async (fileOrBlob: Blob) => {
    setProcessing(true);
    setCameraError("");

    try {
      const imageUrl = URL.createObjectURL(fileOrBlob);

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageUrl;
      });

      const canvas = document.createElement("canvas");
      const width = img.width;
      const height = img.height;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar la imagen");

      ctx.drawImage(img, 0, 0, width, height);

      const overlayHeight = Math.max(320, Math.floor(height * 0.34));
      const overlayY = height - overlayHeight;
      const paddingX = 28;
      const titleSize = Math.max(32, Math.floor(width * 0.036));
      const bodySize = Math.max(24, Math.floor(width * 0.026));
      const lineHeight = Math.max(34, Math.floor(width * 0.032));
      const maxTextWidth = width - paddingX * 2;

      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      ctx.fillRect(0, overlayY, width, overlayHeight);

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${titleSize}px Arial`;
      ctx.fillText(
        `${tipo === "IN" ? "ENTRADA DE SUPERVISIÓN" : "SALIDA DE SUPERVISIÓN"} • ${formatOverlayNow(
          new Date()
        )}`,
        paddingX,
        overlayY + 46
      );

      ctx.font = `${bodySize}px Arial`;

      let currentY = overlayY + 95;
      currentY = drawWrappedText(
        ctx,
        `Servicio: ${servicio}`,
        paddingX,
        currentY,
        maxTextWidth,
        lineHeight
      );

      currentY += lineHeight + 6;
      ctx.fillText(`Turno: ${shift}`, paddingX, currentY);

      currentY += lineHeight + 6;
      const geoText =
        lat != null && lng != null
          ? `Ubicación: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          : "Ubicación: no disponible";

      currentY = drawWrappedText(ctx, geoText, paddingX, currentY, maxTextWidth, lineHeight);

      if (novedades.trim()) {
        currentY += lineHeight + 6;
        drawWrappedText(
          ctx,
          `Novedades: ${novedades.trim()}`,
          paddingX,
          currentY,
          maxTextWidth,
          lineHeight
        );
      }

      const finalBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("No se pudo generar la imagen"));
          },
          "image/jpeg",
          0.92
        );
      });

      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      const previewUrl = URL.createObjectURL(finalBlob);

      setCapturedBlob(finalBlob);
      setCapturedUrl(previewUrl);

      URL.revokeObjectURL(imageUrl);
    } catch (err: any) {
      setCameraError(err?.message || "No se pudo procesar la foto");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xl font-extrabold text-slate-900 text-center">
            {tipo === "IN"
              ? "Foto obligatoria de entrada de supervisión"
              : "Foto obligatoria de salida de supervisión"}
          </h3>

          <p className="text-xs text-slate-500 text-center mt-2">
            La foto incluirá hora, ubicación, servicio, turno y novedades.
          </p>

          <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-bold text-amber-800 text-center">
              Asegúrate de que tu rostro y el entorno del servicio se vean claramente en la foto.
            </p>
          </div>
        </div>

        <div className="p-4">
          <div className="rounded-2xl overflow-hidden bg-slate-100 relative border border-slate-200 min-h-[280px] flex items-center justify-center">
            {!capturedBlob ? (
              <div className="p-6 text-center">
                <div className="text-sm font-bold text-slate-700">
                  {tipo === "IN"
                    ? "Toma una sola foto de entrada de supervisión con tu rostro visible"
                    : "Toma una sola foto de salida de supervisión con tu rostro visible"}
                </div>
                <div className="text-xs text-slate-500 mt-2">{locationText}</div>
              </div>
            ) : (
              <img src={capturedUrl} alt="Captura supervisión" className="w-full h-[360px] object-cover" />
            )}
          </div>

          {processing && (
            <div className="mt-3 text-xs font-bold text-slate-500 text-center">
              Procesando foto...
            </div>
          )}

          {cameraError && (
            <div className="mt-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold p-3">
              {cameraError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleClose}
              className="py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm"
            >
              CANCELAR
            </button>

            {!capturedBlob ? (
              <button
                onClick={takeNativePhoto}
                disabled={processing}
                className={cn(
                  "py-3 rounded-2xl font-bold text-sm",
                  processing
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-[#0dcaf2] text-white"
                )}
              >
                ABRIR CÁMARA
              </button>
            ) : (
              <button
                onClick={() => capturedBlob && onConfirm({ blob: capturedBlob, lat, lng })}
                className="py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm"
              >
                USAR FOTO
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}