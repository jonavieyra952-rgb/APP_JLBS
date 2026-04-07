import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  FileText,
  Filter,
  MapPinned,
  RefreshCw,
  Shield,
} from "lucide-react";
import { cn } from "../lib/utils";

type Shift = "Matutino" | "Nocturno";
type HistoryFilter = "all" | "today";

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

  return {
    date,
    time,
    dateKey: `${yyyy}-${mm}-${dd}`,
  };
}

function getStaticMapUrl(lat: number, lng: number) {
  const delta = 0.0016;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

type Props = {
  apiUrl: string;
  token: string;
  shift: Shift;
  initialFilter?: HistoryFilter;
  onBack: () => void;
};

export default function SupervisorHistorySimple({
  apiUrl,
  token,
  shift,
  initialFilter = "all",
  onBack,
}: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>(initialFilter);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoTitle, setPhotoTitle] = useState("");

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

  useEffect(() => {
    setActiveFilter(initialFilter);
  }, [initialFilter]);

  const parseResponse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json().catch(() => ({}));
    }
    const text = await res.text().catch(() => "");
    return { _raw: text };
  };

  const loadHistory = async () => {
    setLoadingList(true);
    setMsg("");

    try {
      const res = await fetch(`${apiUrl}/api/supervision/history?limit=100`, {
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
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayKey = `${yyyy}-${mm}-${dd}`;

    return items.filter((it) => {
      const dt = formatDateTime(it.hora || it.created_at);
      return dt.dateKey === todayKey;
    });
  }, [items, activeFilter]);

  const todayCount = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayKey = `${yyyy}-${mm}-${dd}`;

    return items.filter((it) => {
      const dt = formatDateTime(it.hora || it.created_at);
      return dt.dateKey === todayKey;
    }).length;
  }, [items]);

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
            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">Historial</h2>
            <p className="text-xs text-slate-500 mt-1">
              Consulta supervisiones, evidencias y ubicaciones registradas.
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
              <h3 className="text-2xl font-bold">Historial de supervisión</h3>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Hoy
              </div>
              <div className="text-sm font-bold text-white mt-1">{todayCount}</div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Total
              </div>
              <div className="text-sm font-bold text-white mt-1">{items.length}</div>
            </div>
          </div>
        </div>

        <Shield className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white/5 rotate-12" />
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-2xl text-xs font-bold text-center bg-red-50 border border-red-100 text-red-700">
          {msg}
        </div>
      )}

      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 mb-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Filtro de historial
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {activeFilter === "today" ? "Mostrando registros de hoy" : "Mostrando todos los registros"}
            </div>
          </div>

          <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center">
            <Filter className="w-4 h-4 text-slate-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActiveFilter("today")}
            className={cn(
              "py-3 rounded-2xl font-bold text-sm border transition",
              activeFilter === "today"
                ? "bg-[#0dcaf2] text-white border-[#0dcaf2]"
                : "bg-slate-50 text-slate-700 border-slate-200"
            )}
          >
            VER HOY
          </button>

          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "py-3 rounded-2xl font-bold text-sm border transition",
              activeFilter === "all"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-700 border-slate-200"
            )}
          >
            VER TODO
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Historial de supervisiones
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {activeFilter === "today" ? "Registros del día" : "Movimientos recientes"}
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

        {filteredItems.length === 0 ? (
          <div className="text-sm text-slate-400 italic text-center py-8">
            {activeFilter === "today"
              ? "No hay supervisiones registradas hoy."
              : "Aún no hay supervisiones registradas."}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((it) => {
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
                        title={`mapa-supervision-history-${it.id}`}
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