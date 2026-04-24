import React, { useEffect, useMemo, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { cn } from "../lib/utils";
import CameraPunchModal from "./CameraPunchModal";

type Shift = "Matutino" | "Nocturno" | "12x12" | "24x24" | "48x48";
type PunchType = "IN" | "OUT";

type MapRecord = {
  tipo: "IN" | "OUT";
  lat: number;
  lng: number;
  fechaTexto: string;
  horaTexto: string;
  servicio: string;
};

type AssignedService = {
  id: number;
  nombre: string;
  activo?: number;
} | null;

type AssignedShift = {
  id: number;
  nombre: string;
  activo?: number;
} | null;

function formatDateTime(value: any) {
  const d = value ? new Date(value) : null;
  if (!d || isNaN(d.getTime())) return { date: "-", time: "-", dateKey: "" };

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

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dateKey = `${yyyy}-${mm}-${dd}`;

  return { date, time, dateKey };
}

function formatOnlyTime(value: Date) {
  return value.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}


function itHasMap(it: any) {
  return it?.lat != null && it?.lng != null;
}

export default function TimeClockSimple({
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
  const [msg, setMsg] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [, setLoadingList] = useState(false);

  const [assignedService, setAssignedService] = useState<AssignedService>(null);
  const [assignedShift, setAssignedShift] = useState<AssignedShift>(null);

  const [loadingAssignedService, setLoadingAssignedService] = useState(false);
  const [loadingAssignedShift, setLoadingAssignedShift] = useState(false);

  const [assignedServiceError, setAssignedServiceError] = useState("");
  const [assignedShiftError, setAssignedShiftError] = useState("");

  const [now, setNow] = useState(new Date());

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTitle, setSuccessTitle] = useState("");
  const [successText, setSuccessText] = useState("");

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedMapRecord, setSelectedMapRecord] = useState<MapRecord | null>(null);

  const [pendingTipo, setPendingTipo] = useState<PunchType | null>(null);
  const [pendingServicio, setPendingServicio] = useState<string>("");
  const [pendingTurno, setPendingTurno] = useState<string>("");

  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);

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

  const parseResponse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json().catch(() => ({}));
    }
    const text = await res.text().catch(() => "");
    return { _raw: text };
  };

  const loadAssignedService = async () => {
    setLoadingAssignedService(true);
    setAssignedServiceError("");

    try {
      const res = await fetch(`${apiUrl}/api/timeclock/my-assigned-service`, {
        method: "GET",
        headers: authHeaders,
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo obtener el servicio asignado.");
      }

      setAssignedService(data.service || null);
    } catch (e: any) {
      setAssignedService(null);
      setAssignedServiceError(e?.message || "No se pudo obtener el servicio asignado.");
    } finally {
      setLoadingAssignedService(false);
    }
  };

  const loadAssignedShift = async () => {
    setLoadingAssignedShift(true);
    setAssignedShiftError("");

    try {
      const res = await fetch(`${apiUrl}/api/timeclock/my-assigned-shift`, {
        method: "GET",
        headers: authHeaders,
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo obtener el turno asignado.");
      }

      setAssignedShift(data.shift || null);
    } catch (e: any) {
      setAssignedShift(null);
      setAssignedShiftError(e?.message || "No se pudo obtener el turno asignado.");
    } finally {
      setLoadingAssignedShift(false);
    }
  };

  const loadHistory = async () => {
    setLoadingList(true);
    setMsg("");

    try {
      const res = await fetch(`${apiUrl}/api/timeclock/history?limit=30`, {
        method: "GET",
        headers: authHeaders,
      });

      const data: any = await parseResponse(res);

      if (!res.ok) {
        const detail =
          data?.error ||
          (data?._raw ? "Respuesta no JSON (posible aviso de ngrok)" : "") ||
          `HTTP ${res.status}`;
        throw new Error(detail || "No se pudo obtener historial");
      }

      if (!data.success) {
        throw new Error(data.error || "No se pudo obtener historial");
      }

      setItems(data.items || []);
    } catch (e: any) {
      setMsg(e?.message || "Error cargando historial");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadAssignedService();
    loadAssignedShift();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastItem = items.length ? items[0] : null;
  const lastType = lastItem ? (String(lastItem?.tipo || "").toUpperCase() as PunchType) : null;

  const openEntryRecord = useMemo(() => {
    if (!items.length) return null;

    const sorted = [...items].sort((a, b) => {
      const ta = new Date(a.hora || a.datetime || a.created_at).getTime();
      const tb = new Date(b.hora || b.datetime || b.created_at).getTime();
      return ta - tb;
    });

    let currentOpen: any = null;

    for (const it of sorted) {
      const tipo = String(it.tipo || "").toUpperCase();
      if (tipo === "IN") currentOpen = it;
      else if (tipo === "OUT") currentOpen = null;
    }

    return currentOpen;
  }, [items]);

  const resolvedAssignedShift = assignedShift?.nombre?.trim() || String(shift || "").trim();
  const resolvedAssignedService = assignedService?.nombre?.trim() || "";

  const canIN =
    !loading &&
    lastType !== "IN" &&
    !!resolvedAssignedShift &&
    !!resolvedAssignedService &&
    !loadingAssignedService &&
    !loadingAssignedShift;

  const canOUT = !loading && lastType === "IN";

  const lastMovementData = useMemo(() => {
    if (!lastItem) return null;

    const dt = formatDateTime(lastItem.hora || lastItem.datetime || lastItem.created_at);

    const lastTurnoRaw = String(lastItem.turno || "").trim();
    const lastTurnoResolved = lastTurnoRaw || resolvedAssignedShift || "Sin turno";

    return {
      tipoTexto: String(lastItem.tipo || "").toUpperCase() === "IN" ? "Entrada" : "Salida",
      hora: dt.time,
      fecha: dt.date,
      servicio: lastItem.lugar_trabajo || resolvedAssignedService || "Sin servicio",
      turno: lastTurnoResolved,
    };
  }, [lastItem, resolvedAssignedShift, resolvedAssignedService]);

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

  const openConfirmModal = async (tipo: PunchType) => {
    setMsg("");

    let servicioToSend = resolvedAssignedService;
    let turnoToSend = resolvedAssignedShift;

    if (tipo === "OUT" && openEntryRecord) {
      servicioToSend =
        String(openEntryRecord.lugar_trabajo || "").trim() || resolvedAssignedService;

      turnoToSend =
        String(openEntryRecord.turno || "").trim() || resolvedAssignedShift;
    }

    if (!servicioToSend) {
      setMsg("No tienes un servicio asignado. Contacta al administrador.");
      return;
    }

    if (!turnoToSend) {
      setMsg("No tienes un turno asignado. Contacta al administrador.");
      return;
    }

    try {
      await requestNativeLocation();
    } catch (err: any) {
      setMsg(err?.message || "Debes permitir ubicación para continuar.");
      return;
    }

    setPendingTipo(tipo);
    setPendingServicio(servicioToSend);
    setPendingTurno(turnoToSend);
    setShowConfirmModal(true);
  };

  const proceedToCamera = () => {
    setShowConfirmModal(false);
    setShowCameraModal(true);
  };

  const confirmPunchWithPhoto = async (payload: {
    blob: Blob;
    lat: number | null;
    lng: number | null;
  }) => {
    if (!pendingTipo) return;

    setShowCameraModal(false);
    setLoading(true);
    setMsg("");

    try {
      const formData = new FormData();
      formData.append("tipo", pendingTipo);
      formData.append("foto", payload.blob, `fichaje-${pendingTipo}-${Date.now()}.jpg`);

      if (payload.lat != null) formData.append("lat", String(payload.lat));
      if (payload.lng != null) formData.append("lng", String(payload.lng));

      const res = await fetch(`${apiUrl}/api/timeclock/punch`, {
        method: "POST",
        headers: uploadHeaders,
        body: formData,
      });

      const data: any = await parseResponse(res);

      if (!res.ok) {
        const detail =
          data?.error ||
          (data?._raw ? "Respuesta no JSON (posible aviso de ngrok)" : "") ||
          `HTTP ${res.status}`;
        throw new Error(detail || "No se pudo registrar");
      }

      if (!data.success) throw new Error(data.error || "No se pudo registrar");

      setMsg(pendingTipo === "IN" ? "✅ Entrada registrada" : "✅ Salida registrada");

      setSuccessTitle(pendingTipo === "IN" ? "Entrada registrada" : "Salida registrada");
      setSuccessText(
        pendingTipo === "IN"
          ? `Tu entrada fue registrada correctamente a las ${formatOnlyTime(new Date())}.`
          : `Tu salida fue registrada correctamente a las ${formatOnlyTime(new Date())}.`
      );

      setShowSuccessModal(true);

      setPendingTipo(null);
      setPendingServicio("");
      setPendingTurno("");
      setCurrentLat(null);
      setCurrentLng(null);

      await loadHistory();
    } catch (e: any) {
      setMsg(e?.message || "Error al fichar");
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = lastType === "IN" ? "EN SERVICIO" : "FUERA DE TURNO";

  const buildOsmEmbedUrl = (lat: number, lng: number) => {
    const delta = 0.0035;
    const left = lng - delta;
    const right = lng + delta;
    const top = lat + delta;
    const bottom = lat - delta;

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
  };

  const openMapModal = (record: MapRecord) => {
    setSelectedMapRecord(record);
    setShowMapModal(true);
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, "_blank");
  };

  const showSingleOpenEntryMessage = canOUT && !!openEntryRecord;
  const showAssignedHint =
    !showSingleOpenEntryMessage &&
    !loadingAssignedService &&
    !loadingAssignedShift &&
    !!resolvedAssignedShift &&
    !!resolvedAssignedService;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans max-w-md mx-auto relative">
      <CameraPunchModal
        open={showCameraModal}
        tipo={pendingTipo}
        servicio={pendingServicio}
        shift={pendingTurno}
        initialLat={currentLat}
        initialLng={currentLng}
        onClose={() => setShowCameraModal(false)}
        onConfirm={confirmPunchWithPhoto}
      />

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold mx-auto mb-4">
              ?
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 text-center">
              Confirmar {pendingTipo === "IN" ? "entrada" : "salida"}
            </h3>

            <p className="text-sm text-slate-600 text-center mt-2">
              Después se abrirá la cámara para tomar una foto obligatoria donde se vea claramente tu rostro.
            </p>

            <div className="mt-5 bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Movimiento
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {pendingTipo === "IN" ? "Registrar entrada" : "Registrar salida"}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Turno
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{pendingTurno}</div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Servicio
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{pendingServicio}</div>
              </div>

              {currentLat != null && currentLng != null && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Ubicación
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingTipo(null);
                }}
                className="py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm"
              >
                CANCELAR
              </button>

              <button
                onClick={proceedToCamera}
                className="py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm"
              >
                CONTINUAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showMapModal && selectedMapRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-xl font-extrabold text-slate-900 text-center">
                Ubicación del registro
              </h3>
              <p className="text-sm text-slate-600 text-center mt-2">
                {selectedMapRecord.tipo === "IN" ? "Entrada" : "Salida"} • {selectedMapRecord.fechaTexto} • {selectedMapRecord.horaTexto}
              </p>
            </div>

            <div className="p-4">
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <iframe
                  title="Mapa de ubicación"
                  src={buildOsmEmbedUrl(selectedMapRecord.lat, selectedMapRecord.lng)}
                  className="w-full h-[280px] border-0"
                  loading="lazy"
                />
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Servicio
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {selectedMapRecord.servicio}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Coordenadas
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1 break-all">
                    {selectedMapRecord.lat.toFixed(6)}, {selectedMapRecord.lng.toFixed(6)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-4">
                <button
                  onClick={() => openInGoogleMaps(selectedMapRecord.lat, selectedMapRecord.lng)}
                  className="py-3 rounded-2xl bg-[#0dcaf2] text-white font-bold text-sm"
                >
                  ABRIR EN GOOGLE MAPS
                </button>

                <button
                  onClick={() => {
                    setShowMapModal(false);
                    setSelectedMapRecord(null);
                  }}
                  className="py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm"
                >
                  CERRAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              ✓
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Control horario</p>
          <h2 className="text-2xl font-extrabold text-slate-900">Fichaje</h2>
          <p className="text-xs text-slate-500 mt-1">
            Turno: <span className="font-semibold text-slate-900">{resolvedAssignedShift || shift}</span>
          </p>
          <p className="text-xs text-[#0dcaf2] font-bold mt-2">Hora actual: {formatOnlyTime(now)}</p>
        </div>

        <button onClick={onBack} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs">
          Volver
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</div>
          <div className="text-sm font-extrabold text-slate-900 mt-1">{statusLabel}</div>
        </div>
      </div>

      {lastMovementData && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Último movimiento
          </div>

          <div className="mt-3">
            <div className="text-sm font-extrabold text-slate-900">{lastMovementData.tipoTexto}</div>
            <div className="text-xs text-slate-500 mt-1">{lastMovementData.fecha}</div>
            <div className="text-sm font-semibold text-slate-800 mt-1">{lastMovementData.hora}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                {lastMovementData.turno}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                {lastMovementData.servicio}
              </span>

              {itHasMap(lastItem) && (
                <button
                  onClick={() =>
                    openMapModal({
                      tipo: String(lastItem?.tipo || "").toUpperCase() === "IN" ? "IN" : "OUT",
                      lat: Number(lastItem.lat),
                      lng: Number(lastItem.lng),
                      fechaTexto: lastMovementData.fecha,
                      horaTexto: lastMovementData.hora,
                      servicio: lastMovementData.servicio,
                    })
                  }
                  className="text-[10px] font-bold uppercase tracking-widest text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200"
                >
                  Ver mapa
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div
          className={cn(
            "p-3 rounded-xl text-xs font-bold text-center mb-4",
            msg.includes("✅") ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700"
          )}
        >
          {msg}
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Turno asignado
            </label>
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-3 text-sm font-semibold">
              {loadingAssignedShift ? "Cargando turno..." : resolvedAssignedShift || "Sin turno asignado"}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Servicio asignado
            </label>
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-3 text-sm font-semibold">
              {loadingAssignedService ? "Cargando servicio..." : resolvedAssignedService || "Sin servicio asignado"}
            </div>
          </div>

          {showSingleOpenEntryMessage ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800">
              Tienes una entrada abierta. La salida usará ese mismo turno y servicio automáticamente.
            </div>
          ) : showAssignedHint ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
              Los datos de turno y servicio son asignados por administración.
            </div>
          ) : null}

          {!showSingleOpenEntryMessage && assignedShiftError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
              {assignedShiftError}
            </div>
          )}

          {!showSingleOpenEntryMessage && assignedServiceError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
              {assignedServiceError}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-6">
        <button
          disabled={!canIN}
          onClick={() => openConfirmModal("IN")}
          className={cn(
            "py-4 rounded-2xl font-bold text-sm border transition shadow-sm",
            !canIN
              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              : "bg-[#0dcaf2] text-white border-[#0dcaf2] hover:brightness-[0.98] active:scale-[0.99]"
          )}
        >
          REGISTRAR ENTRADA
        </button>

        <button
          disabled={!canOUT}
          onClick={() => openConfirmModal("OUT")}
          className={cn(
            "py-4 rounded-2xl font-bold text-sm border transition shadow-sm",
            !canOUT
              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              : "bg-slate-900 text-white border-slate-900 hover:brightness-[0.98] active:scale-[0.99]"
          )}
        >
          REGISTRAR SALIDA
        </button>
      </div>

    </div>
  );
}
