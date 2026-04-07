import React, { useEffect, useMemo, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  MapPinned,
  RefreshCw,
  Shield,
} from "lucide-react";
import { cn } from "../lib/utils";
import SupervisorCameraModal from "./SupervisorCameraModal";

type Shift = "Matutino" | "Nocturno";
type SupervisionType = "IN" | "OUT";

type ServiceRow = {
  id: number;
  nombre: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
};

function formatDateTime(value: any) {
  const d = value ? new Date(value) : null;
  if (!d || isNaN(d.getTime())) return { date: "-", time: "-" };

  const date = d.toLocaleDateString("es-MX", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  const time = d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return { date, time };
}

function formatOnlyTime(value: Date) {
  return value.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getStaticMapUrl(lat: number, lng: number) {
  const delta = 0.0016;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export default function SupervisorReportSimple({
  apiUrl,
  token,
  shift,
  onBack,
}: {
  apiUrl: string;
  token: string;
  shift: Shift;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  const [msg, setMsg] = useState("");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [entryNotes, setEntryNotes] = useState("");
  const [exitNotes, setExitNotes] = useState("");

  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);

  const [showCameraModal, setShowCameraModal] = useState(false);
  const [pendingTipo, setPendingTipo] = useState<SupervisionType>("IN");

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTitle, setSuccessTitle] = useState("");
  const [successText, setSuccessText] = useState("");

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoTitle, setPhotoTitle] = useState("");

  const [now, setNow] = useState(new Date());

  const baseHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    }),
    []
  );

  const authHeaders = useMemo(
    () => ({
      ...baseHeaders,
      Authorization: `Bearer ${token}`,
    }),
    [baseHeaders, token]
  );

  const uploadHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
    }),
    [token]
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setEntryNotes("");
    setExitNotes("");
    setMsg("");
  }, [selectedServiceId]);

  const parseResponse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json().catch(() => ({}));
    }
    const text = await res.text().catch(() => "");
    return { _raw: text };
  };

  const loadServices = async () => {
    setLoadingServices(true);
    try {
      const res = await fetch(`${apiUrl}/api/services`, {
        method: "GET",
        headers: authHeaders,
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudieron cargar los servicios.");
      }

      setServices(data.services || []);
    } catch (e: any) {
      setMsg(e?.message || "Error cargando servicios");
    } finally {
      setLoadingServices(false);
    }
  };

  const loadHistory = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${apiUrl}/api/supervision/history?limit=30`, {
        method: "GET",
        headers: authHeaders,
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cargar historial.");
      }

      setItems(data.items || []);
    } catch (e: any) {
      setMsg(e?.message || "Error cargando historial");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadServices();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestNativeLocation = async () => {
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

      setCurrentLat(pos.coords.latitude);
      setCurrentLng(pos.coords.longitude);

      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
    } catch (err: any) {
      throw new Error(err?.message || "No se pudo obtener la ubicación.");
    }
  };

  const selectedService = services.find((s) => String(s.id) === selectedServiceId);

  const selectedServiceHistory = useMemo(() => {
    if (!selectedServiceId) return [];
    return [...items]
      .filter((it) => String(it.servicio_id) === String(selectedServiceId))
      .sort((a, b) => {
        const ta = new Date(a.hora || a.created_at).getTime();
        const tb = new Date(b.hora || b.created_at).getTime();
        return tb - ta;
      });
  }, [items, selectedServiceId]);

  const selectedServiceLastMove = selectedServiceHistory.length
    ? selectedServiceHistory[0]
    : null;

  const openEntryRecordBySelectedService = useMemo(() => {
    if (!selectedServiceLastMove) return null;
    return String(selectedServiceLastMove.tipo || "").toUpperCase() === "IN"
      ? selectedServiceLastMove
      : null;
  }, [selectedServiceLastMove]);

  const globalOpenEntryRecord = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const ta = new Date(a.hora || a.created_at).getTime();
      const tb = new Date(b.hora || b.created_at).getTime();
      return ta - tb;
    });

    const openMap = new Map<string, any>();

    sorted.forEach((it) => {
      const key = String(it.servicio_id);
      const tipo = String(it.tipo || "").toUpperCase();

      if (tipo === "IN") {
        openMap.set(key, it);
      } else if (tipo === "OUT") {
        openMap.delete(key);
      }
    });

    const openValues = Array.from(openMap.values()).sort((a, b) => {
      const ta = new Date(a.hora || a.created_at).getTime();
      const tb = new Date(b.hora || b.created_at).getTime();
      return tb - ta;
    });

    return openValues[0] || null;
  }, [items]);

  const openEntryRecord = openEntryRecordBySelectedService || globalOpenEntryRecord || null;

  useEffect(() => {
    if (globalOpenEntryRecord && !selectedServiceId) {
      setSelectedServiceId(String(globalOpenEntryRecord.servicio_id));
    }
  }, [globalOpenEntryRecord, selectedServiceId]);

  const hasAnyOpenEntry = !!openEntryRecord;

  const canRegisterIn =
    !!selectedServiceId && !hasAnyOpenEntry && !loading && !loadingServices;

  const canRegisterOut =
    !!openEntryRecord && !loading && !loadingServices;

  const openEntryDateTime = openEntryRecord?.hora
    ? formatDateTime(openEntryRecord.hora)
    : null;

  const serviceStatusText = hasAnyOpenEntry
    ? "Tienes una entrada abierta. Debes registrar la salida."
    : !selectedServiceId
    ? "Selecciona un servicio para comenzar."
    : "Este servicio está listo para registrar entrada.";

  const serviceStatusClass = hasAnyOpenEntry
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : !selectedServiceId
    ? "bg-slate-100 border-slate-200 text-slate-600"
    : "bg-emerald-50 border-emerald-200 text-emerald-800";

  const openCamera = async (tipo: SupervisionType) => {
    setMsg("");

    if (tipo === "IN" && !selectedServiceId) {
      setMsg("Selecciona un servicio.");
      return;
    }

    if (tipo === "IN" && !canRegisterIn) {
      setMsg("Ya tienes una entrada abierta en un servicio. Primero registra la salida.");
      return;
    }

    if (tipo === "OUT" && !canRegisterOut) {
      setMsg("No hay una entrada abierta para registrar la salida.");
      return;
    }

    try {
      await requestNativeLocation();
      setPendingTipo(tipo);
      setShowCameraModal(true);
    } catch (err: any) {
      setMsg(err?.message || "No se pudo preparar la ubicación.");
    }
  };

  const confirmSupervisionWithPhoto = async (payload: {
    blob: Blob;
    lat: number | null;
    lng: number | null;
  }) => {
    setShowCameraModal(false);
    setLoading(true);
    setMsg("");

    try {
      let serviceToUse = selectedService;
      let notesToUse = entryNotes.trim();

      if (pendingTipo === "OUT") {
        if (!openEntryRecord) {
          throw new Error("No existe una entrada abierta para registrar la salida.");
        }

        serviceToUse =
          services.find((s) => String(s.id) === String(openEntryRecord.servicio_id)) ||
          selectedService;

        notesToUse = exitNotes.trim();
      }

      if (!serviceToUse) {
        throw new Error("Servicio inválido.");
      }

      const formData = new FormData();
      formData.append("servicio_id", String(serviceToUse.id));
      formData.append("tipo", pendingTipo);
      formData.append("turno", shift);
      formData.append("novedades", notesToUse);
      formData.append("foto", payload.blob, `supervision-${pendingTipo}-${Date.now()}.jpg`);

      if (payload.lat != null) formData.append("lat", String(payload.lat));
      if (payload.lng != null) formData.append("lng", String(payload.lng));

      const res = await fetch(`${apiUrl}/api/supervision/report`, {
        method: "POST",
        headers: uploadHeaders,
        body: formData,
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        const detail =
          data?.error ||
          (data?._raw ? "Respuesta no JSON del servidor." : "") ||
          `HTTP ${res.status}`;
        throw new Error(detail || "No se pudo registrar supervisión");
      }

      setMsg(
        pendingTipo === "IN"
          ? "✅ Entrada de supervisión registrada"
          : "✅ Salida de supervisión registrada"
      );

      setSuccessTitle(pendingTipo === "IN" ? "Entrada registrada" : "Salida registrada");
      setSuccessText(
        pendingTipo === "IN"
          ? `Tu entrada de supervisión fue registrada correctamente a las ${formatOnlyTime(new Date())}.`
          : `Tu salida de supervisión fue registrada correctamente a las ${formatOnlyTime(new Date())}.`
      );
      setShowSuccessModal(true);

      if (pendingTipo === "IN") {
        setEntryNotes("");
      } else {
        setExitNotes("");
        setSelectedServiceId("");
      }

      setCurrentLat(null);
      setCurrentLng(null);

      await loadHistory();
    } catch (e: any) {
      setMsg(e?.message || "Error al registrar supervisión");
    } finally {
      setLoading(false);
    }
  };

  const openPhotoModal = async (item: any) => {
    setPhotoLoading(true);
    setPhotoError("");
    setShowPhotoModal(true);
    setPhotoTitle(`Foto de supervisión • ${item.servicio_nombre || "Servicio"}`);

    try {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
        setPhotoUrl("");
      }

      const res = await fetch(`${apiUrl}${item.foto_url}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!res.ok) {
        throw new Error(`No se pudo cargar la foto (${res.status})`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
    } catch (e: any) {
      setPhotoError(e?.message || "No se pudo abrir la foto.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setPhotoLoading(false);
    setPhotoError("");
    setPhotoTitle("");

    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
      setPhotoUrl("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans max-w-md mx-auto relative">
      <SupervisorCameraModal
        open={showCameraModal}
        tipo={pendingTipo}
        servicio={
          pendingTipo === "OUT" && openEntryRecord
            ? String(openEntryRecord.servicio_nombre || "Sin servicio")
            : selectedService?.nombre || "Sin servicio"
        }
        shift={shift}
        novedades={pendingTipo === "OUT" ? exitNotes : entryNotes}
        initialLat={currentLat}
        initialLng={currentLng}
        onClose={() => setShowCameraModal(false)}
        onConfirm={confirmSupervisionWithPhoto}
      />

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 text-center">{successTitle}</h3>
            <p className="text-sm text-slate-600 text-center mt-2">{successText}</p>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full mt-5 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {showPhotoModal && (
        <div className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900 text-center">
                {photoTitle}
              </h3>
            </div>

            <div className="p-4">
              <div className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 min-h-[280px] flex items-center justify-center">
                {photoLoading ? (
                  <div className="text-sm font-bold text-slate-500">Cargando foto...</div>
                ) : photoError ? (
                  <div className="p-4 text-center text-sm font-bold text-red-600">
                    {photoError}
                  </div>
                ) : photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Foto de supervisión"
                    className="w-full h-[420px] object-cover"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-500">Sin foto disponible</div>
                )}
              </div>

              <button
                onClick={closePhotoModal}
                className="w-full mt-4 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.22em]">
            Supervisor
          </p>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">Supervisión</h2>
            <p className="text-xs text-slate-500 mt-1">
              Registro operativo de entradas, salidas y evidencia del servicio.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100">
            <div className="w-2 h-2 rounded-full bg-[#0dcaf2]" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0dcaf2]">
              Turno {shift}
            </span>
          </div>
        </div>

        <button
          onClick={onBack}
          className="bg-white border border-slate-100 text-slate-700 px-4 py-3 rounded-2xl font-bold text-xs shadow-sm inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
      </div>

      <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-[0_20px_60px_rgba(15,23,42,0.18)] mb-5 relative overflow-hidden border border-slate-800">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                Módulo activo
              </p>
              <h3 className="text-2xl font-bold">Supervisión de servicio</h3>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Hora actual
              </p>
              <p className="text-sm font-bold text-white mt-1">{formatOnlyTime(now)}</p>
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-2 text-[#0dcaf2] text-[11px] font-extrabold uppercase tracking-widest">
            <div className="w-2 h-2 bg-[#0dcaf2] rounded-full animate-pulse" />
            En supervisión
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Servicios
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {loadingServices ? "Cargando..." : services.length}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Historial
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {loadingList ? "Cargando..." : items.length}
              </div>
            </div>
          </div>
        </div>

        <Shield className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white/5 rotate-12" />
      </div>

      {msg && (
        <div
          className={cn(
            "p-3 rounded-2xl text-xs font-bold text-center mb-4 border",
            msg.includes("✅")
              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
              : "bg-red-50 border-red-100 text-red-700"
          )}
        >
          {msg}
        </div>
      )}

      <div
        className={cn(
          "mb-5 rounded-[1.5rem] border px-4 py-4 text-sm font-semibold shadow-sm",
          serviceStatusClass
        )}
      >
        {serviceStatusText}
      </div>

      {!hasAnyOpenEntry ? (
        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Registro de entrada
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                Preparar supervisión
              </div>
            </div>

            <div className="w-11 h-11 rounded-2xl bg-[#0dcaf2]/10 text-[#0dcaf2] flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Servicio a supervisar
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                disabled={loadingServices || loading}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
              >
                <option value="">Selecciona un servicio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Novedades de entrada
              </label>
              <textarea
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                placeholder="Describe novedades, observaciones o condiciones encontradas al llegar..."
                rows={4}
                disabled={loading}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none resize-none"
              />
            </div>

            {selectedService?.direccion && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs font-semibold text-blue-800">
                Dirección del servicio: {selectedService.direccion}
              </div>
            )}
          </div>

          <button
            disabled={!canRegisterIn}
            onClick={() => openCamera("IN")}
            className={cn(
              "w-full mt-5 py-4 rounded-2xl font-bold text-sm border transition shadow-sm inline-flex items-center justify-center gap-2",
              !canRegisterIn
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-[#0dcaf2] text-white border-[#0dcaf2] hover:brightness-[0.98] active:scale-[0.99] shadow-lg shadow-cyan-500/20"
            )}
          >
            <Camera className="w-4 h-4" />
            REGISTRAR ENTRADA
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Registro de salida
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                Cerrar supervisión
              </div>
            </div>

            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CircleAlert className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Servicio seleccionado
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-2">
              {openEntryRecord?.servicio_nombre || "Servicio"}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">Fecha:</span>{" "}
                {openEntryDateTime?.date || "-"}
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">Hora de entrada:</span>{" "}
                {openEntryDateTime?.time || "-"}
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">Turno:</span> {shift}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Novedades de salida
            </label>
            <textarea
              value={exitNotes}
              onChange={(e) => setExitNotes(e.target.value)}
              placeholder="Describe novedades, observaciones o condiciones al retirarte..."
              rows={4}
              disabled={loading}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none resize-none"
            />
          </div>

          <div className="mt-4 rounded-2xl px-4 py-3 text-xs font-semibold border bg-amber-50 border-amber-200 text-amber-800">
            Solo agrega las novedades finales y captura la foto para registrar la salida.
          </div>

          <button
            disabled={!canRegisterOut}
            onClick={() => openCamera("OUT")}
            className={cn(
              "w-full mt-5 py-4 rounded-2xl font-bold text-sm border transition shadow-sm inline-flex items-center justify-center gap-2",
              !canRegisterOut
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-slate-900 text-white border-slate-900 hover:brightness-[0.98] active:scale-[0.99]"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            REGISTRAR SALIDA
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock3 className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Estado</span>
            </div>

            <div
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center",
                hasAnyOpenEntry
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              <CircleAlert className="w-4 h-4" />
            </div>
          </div>

          <div
            className={cn(
              "mt-4 text-sm font-extrabold leading-tight",
              hasAnyOpenEntry ? "text-amber-700" : "text-emerald-700"
            )}
          >
            {!selectedServiceId && !hasAnyOpenEntry
              ? "Sin seleccionar"
              : hasAnyOpenEntry
              ? "Salida pendiente"
              : "Listo para entrada"}
          </div>

          <div className="text-xs text-slate-500 mt-2">
            {!selectedServiceId && !hasAnyOpenEntry
              ? "Elige un servicio"
              : hasAnyOpenEntry
              ? "Existe una supervisión abierta"
              : "No hay pendientes"}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              <FileText className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Movimientos</span>
            </div>

            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-slate-600" />
            </div>
          </div>

          <div className="mt-4 text-3xl font-extrabold text-slate-900 leading-none">
            {loadingList ? "..." : items.length}
          </div>

          <div className="text-xs text-slate-500 mt-2">Registros recientes</div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Historial de supervisiones
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              Movimientos recientes
            </div>
          </div>

          <button
            onClick={loadHistory}
            disabled={loadingList}
            className="text-[10px] font-bold text-[#0dcaf2] uppercase tracking-widest inline-flex items-center gap-1"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loadingList && "animate-spin")} />
            {loadingList ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-slate-400 italic text-center py-6">
            Aún no hay supervisiones registradas.
          </div>
        ) : (
          <div className="space-y-4">
            {items.slice(0, 12).map((it) => {
              const dt = formatDateTime(it.hora || it.created_at);
              const isIn = String(it.tipo || "").toUpperCase() === "IN";

              return (
                <div
                  key={it.id}
                  className="bg-slate-50 rounded-[1.5rem] px-4 py-4 border border-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">
                        {isIn ? "Entrada de supervisión" : "Salida de supervisión"}
                      </div>

                      <div className="mt-1">
                        <div className="text-xs text-slate-500">{dt.date}</div>
                        <div className="text-xs font-semibold text-slate-700">{dt.time}</div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "min-w-[78px] h-11 px-3 rounded-2xl flex items-center justify-center shrink-0 text-[11px] font-extrabold tracking-widest",
                        isIn
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      )}
                    >
                      {isIn ? "ENTRADA" : "SALIDA"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      {it.turno}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      {it.servicio_nombre}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border",
                        isIn
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : "text-slate-700 bg-slate-100 border-slate-200"
                      )}
                    >
                      {isIn ? "Entrada" : "Salida"}
                    </span>
                    {it.foto_url && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#0dcaf2] bg-cyan-50 px-2 py-1 rounded-lg border border-cyan-200">
                        Con foto
                      </span>
                    )}
                  </div>

                  {it.novedades && (
                    <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
                      <span className="font-bold">Novedades:</span> {it.novedades}
                    </div>
                  )}

                  {it.lat != null && it.lng != null && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-white">
                      <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400 inline-flex items-center gap-2">
                        <MapPinned className="w-3.5 h-3.5" />
                        Ubicación registrada
                      </div>

                      <iframe
                        title={`mapa-supervision-${it.id}`}
                        src={getStaticMapUrl(Number(it.lat), Number(it.lng))}
                        className="w-full h-[180px] border-0"
                        loading="lazy"
                      />

                      <div className="px-3 py-2 text-[10px] font-bold text-slate-500 border-t border-slate-100">
                        Ubicación: {Number(it.lat).toFixed(6)}, {Number(it.lng).toFixed(6)}
                      </div>
                    </div>
                  )}

                  {it.foto_url && (
                    <button
                      onClick={() => openPhotoModal(it)}
                      className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#0dcaf2]"
                    >
                      <Camera className="w-4 h-4" />
                      VER FOTO
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}