import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Filter,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Navigation,
  Copy,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Browser } from "@capacitor/browser";
import { AppLauncher } from "@capacitor/app-launcher";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "../lib/utils";

type Shift = "Matutino" | "Nocturno";

type GuardPunchItem = {
  id: number;
  user_id: number;
  guardia_nombre: string;
  guardia_email: string;
  tipo: "IN" | "OUT";
  turno: Shift;
  lugar_trabajo: string;
  jornada: string;
  fecha: string;
  hora: string;
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
};

type Props = {
  apiUrl: string;
  token: string;
  onBack: () => void;
};

type EvidenceModalState = {
  guardia: string;
  servicio: string;
  tipo: "IN" | "OUT";
  hora: string;
  imageUrl: string | null;
  loading: boolean;
  error: string;
} | null;

type LocationModalState = {
  lat: number;
  lng: number;
  guardia: string;
  servicio: string;
} | null;

const customMarker = L.divIcon({
  className: "custom-leaflet-marker",
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #0f172a;
      border: 4px solid white;
      border-radius: 9999px;
      box-shadow: 0 4px 12px rgba(15,23,42,0.25);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function formatDateTime(value: any) {
  const d = value ? new Date(value) : null;
  if (!d || isNaN(d.getTime())) {
    return {
      date: "-",
      time: "-",
      dateKey: "",
    };
  }

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

function actionLabel(tipo: "IN" | "OUT") {
  return tipo === "IN" ? "Entrada" : "Salida";
}

export default function SupervisorGuardHistorySimple({
  apiUrl,
  token,
  onBack,
}: Props) {
  const [items, setItems] = useState<GuardPunchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [guardFilter, setGuardFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState<"" | Shift>("");
  const [typeFilter, setTypeFilter] = useState<"" | "IN" | "OUT">("");
  const [dateFilter, setDateFilter] = useState("");

  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceModalState>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationModalState>(null);

  const [evidenceZoom, setEvidenceZoom] = useState(1);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [openingMaps, setOpeningMaps] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "200");

      if (dateFilter) params.set("fecha", dateFilter);
      if (shiftFilter) params.set("turno", shiftFilter);
      if (serviceFilter.trim()) params.set("servicio", serviceFilter.trim());

      const res = await fetch(
        `${apiUrl}/api/supervision/guards/history?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cargar el historial.");
      }

      setItems(data.items || []);
    } catch (err: any) {
      console.error("[SUPERVISOR GUARD HISTORY ERROR]", err);
      setItems([]);
      setError(err?.message || "Error al cargar el historial de guardias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (selectedEvidence?.imageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedEvidence.imageUrl);
      }
    };
  }, [selectedEvidence]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchGuard = guardFilter.trim()
        ? it.guardia_nombre.toLowerCase().includes(guardFilter.trim().toLowerCase())
        : true;

      const matchService = serviceFilter.trim()
        ? it.lugar_trabajo.toLowerCase().includes(serviceFilter.trim().toLowerCase())
        : true;

      const matchShift = shiftFilter ? it.turno === shiftFilter : true;
      const matchType = typeFilter ? it.tipo === typeFilter : true;

      return matchGuard && matchService && matchShift && matchType;
    });
  }, [items, guardFilter, serviceFilter, shiftFilter, typeFilter]);

  const summaryCards = useMemo(() => {
    const entradas = filteredItems.filter((it) => it.tipo === "IN").length;
    const salidas = filteredItems.filter((it) => it.tipo === "OUT").length;
    const conEvidencia = filteredItems.filter((it) => !!it.foto_url).length;
    const conUbicacion = filteredItems.filter((it) => it.lat !== null && it.lng !== null).length;

    return { entradas, salidas, conEvidencia, conUbicacion };
  }, [filteredItems]);

  const closeEvidenceModal = () => {
    if (selectedEvidence?.imageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(selectedEvidence.imageUrl);
    }
    setSelectedEvidence(null);
    setEvidenceZoom(1);
  };

  const openEvidenceModal = async (it: GuardPunchItem, timeLabel: string) => {
    if (!it.foto_url) return;

    closeEvidenceModal();

    setSelectedEvidence({
      guardia: it.guardia_nombre,
      servicio: it.lugar_trabajo,
      tipo: it.tipo,
      hora: timeLabel,
      imageUrl: null,
      loading: true,
      error: "",
    });

    try {
      const imageRes = await fetch(`${apiUrl}${it.foto_url}`, {
        method: "GET",
        headers: {
          "ngrok-skip-browser-warning": "true",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!imageRes.ok) {
        throw new Error(`No se pudo cargar la imagen (${imageRes.status})`);
      }

      const blob = await imageRes.blob();
      const objectUrl = URL.createObjectURL(blob);

      setSelectedEvidence({
        guardia: it.guardia_nombre,
        servicio: it.lugar_trabajo,
        tipo: it.tipo,
        hora: timeLabel,
        imageUrl: objectUrl,
        loading: false,
        error: "",
      });
      setEvidenceZoom(1);
    } catch (err: any) {
      console.error("[EVIDENCE LOAD ERROR]", err);
      setSelectedEvidence({
        guardia: it.guardia_nombre,
        servicio: it.lugar_trabajo,
        tipo: it.tipo,
        hora: timeLabel,
        imageUrl: null,
        loading: false,
        error: err?.message || "No se pudo cargar la evidencia.",
      });
    }
  };

  const openLocationModal = (it: GuardPunchItem) => {
    if (it.lat === null || it.lng === null) return;
    setCopiedCoords(false);
    setSelectedLocation({
      lat: it.lat,
      lng: it.lng,
      guardia: it.guardia_nombre,
      servicio: it.lugar_trabajo,
    });
  };

  const copyCoordinates = async () => {
    if (!selectedLocation) return;
    const text = `${selectedLocation.lat}, ${selectedLocation.lng}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 1500);
    } catch (err) {
      console.error("[COPY COORDS ERROR]", err);
    }
  };

  const openGoogleMapsApp = async () => {
    if (!selectedLocation || openingMaps) return;

    const { lat, lng } = selectedLocation;
    const googleMapsScheme = `geo:${lat},${lng}?q=${lat},${lng}`;
    const googleMapsWeb = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    setOpeningMaps(true);

    try {
      const canOpen = await AppLauncher.canOpenUrl({ url: googleMapsScheme });

      if (canOpen.value) {
        await AppLauncher.openUrl({ url: googleMapsScheme });
      } else {
        await Browser.open({ url: googleMapsWeb });
      }
    } catch (err) {
      console.error("[OPEN MAPS ERROR]", err);
      try {
        await Browser.open({ url: googleMapsWeb });
      } catch (browserErr) {
        console.error("[BROWSER FALLBACK ERROR]", browserErr);
      }
    } finally {
      setOpeningMaps(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans max-w-md mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-11 h-11 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-400">
            Supervisor
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 mt-1">
            Historial de guardias
          </h1>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={fetchHistory}
          disabled={loading}
          className={cn(
            "px-4 py-3 rounded-2xl text-xs font-extrabold border inline-flex items-center gap-2",
            loading
              ? "bg-slate-100 text-slate-400 border-slate-200"
              : "bg-white text-[#0dcaf2] border-cyan-200"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Actualizar
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 text-white rounded-[2rem] p-5 shadow-sm border border-slate-800 mb-5 overflow-hidden relative"
      >
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              Monitoreo operativo
            </div>
            <div className="text-lg font-extrabold text-white mt-2">
              Entradas y salidas de guardias
            </div>
            <div className="text-xs text-slate-300 mt-2 leading-relaxed">
              Consulta movimientos, evidencias y ubicaciones registradas por el personal.
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-cyan-300 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 relative z-10">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Entradas</div>
            <div className="text-2xl font-extrabold text-white mt-2">{summaryCards.entradas}</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Salidas</div>
            <div className="text-2xl font-extrabold text-white mt-2">{summaryCards.salidas}</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Evidencias</div>
            <div className="text-2xl font-extrabold text-white mt-2">{summaryCards.conEvidencia}</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Ubicaciones</div>
            <div className="text-2xl font-extrabold text-white mt-2">{summaryCards.conUbicacion}</div>
          </div>
        </div>

        <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-cyan-400/10 blur-2xl" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 mb-5"
      >
        <div className="flex items-center gap-2 text-slate-400 mb-4">
          <Filter className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Filtros
          </span>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={guardFilter}
              onChange={(e) => setGuardFilter(e.target.value)}
              placeholder="Buscar por guardia"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              placeholder="Buscar por servicio"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as "" | Shift)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
            >
              <option value="">Todos los turnos</option>
              <option value="Matutino">Matutino</option>
              <option value="Nocturno">Nocturno</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "" | "IN" | "OUT")}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
            >
              <option value="">Todas las acciones</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
            </select>
          </div>

          <div className="relative">
            <CalendarDays className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={fetchHistory}
              disabled={loading}
              className={cn(
                "py-3 rounded-2xl font-extrabold text-xs",
                loading
                  ? "bg-slate-100 text-slate-400"
                  : "bg-[#0dcaf2] text-white"
              )}
            >
              {loading ? "CARGANDO..." : "APLICAR"}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setGuardFilter("");
                setServiceFilter("");
                setShiftFilter("");
                setTypeFilter("");
                setDateFilter("");
              }}
              className="py-3 rounded-2xl font-extrabold text-xs bg-slate-100 text-slate-700"
            >
              LIMPIAR
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="mb-4 px-1 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Registros encontrados:{" "}
          <span className="font-extrabold text-slate-900">{filteredItems.length}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 text-red-700 p-4 text-sm font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 text-sm text-slate-500">
          Cargando historial...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 text-sm text-slate-400">
          No se encontraron registros con esos filtros.
        </div>
      ) : (
        <div className="space-y-4 pb-6">
          {filteredItems.map((it, index) => {
            const dt = formatDateTime(it.hora || it.fecha);
            const isEntrada = it.tipo === "IN";

            return (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-extrabold text-slate-900 truncate">
                      {it.guardia_nombre}
                    </div>

                    <div className="text-sm text-slate-500 mt-1 truncate">
                      {it.lugar_trabajo}
                    </div>

                    <div className="text-xs text-slate-500 mt-3">{dt.date}</div>
                    <div className="text-lg font-extrabold text-slate-900 mt-1">
                      {dt.time}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "px-4 py-3 rounded-[1.25rem] text-sm font-extrabold shrink-0 min-w-[96px] text-center",
                      isEntrada
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    )}
                  >
                    {actionLabel(it.tipo)}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "text-[11px] font-extrabold uppercase tracking-widest px-3 py-2 rounded-xl border",
                      isEntrada
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : "text-slate-700 bg-slate-100 border-slate-200"
                    )}
                  >
                    {actionLabel(it.tipo)}
                  </span>

                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    {it.turno}
                  </span>

                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    {it.jornada}
                  </span>
                </div>

                {(it.foto_url || (it.lat !== null && it.lng !== null)) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {it.foto_url && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => openEvidenceModal(it, dt.time)}
                        className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-cyan-600 bg-cyan-50 px-3 py-2 rounded-xl border border-cyan-200"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Ver evidencia
                      </motion.button>
                    )}

                    {it.lat !== null && it.lng !== null && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => openLocationModal(it)}
                        className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-violet-700 bg-violet-50 px-3 py-2 rounded-xl border border-violet-200"
                      >
                        <MapPin className="w-4 h-4" />
                        Ver ubicación
                      </motion.button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedEvidence && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
                <button
                  onClick={closeEvidenceModal}
                  className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="min-w-0 flex-1 text-center">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    Evidencia
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">
                    {selectedEvidence.guardia}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {selectedEvidence.servicio} • {actionLabel(selectedEvidence.tipo)} • {selectedEvidence.hora}
                  </div>
                </div>

                <button
                  onClick={closeEvidenceModal}
                  className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-4 pt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => setEvidenceZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                  className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setEvidenceZoom(1)}
                  className="px-4 h-10 rounded-2xl bg-slate-100 text-slate-700 text-xs font-extrabold inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>

                <button
                  onClick={() => setEvidenceZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-100 min-h-[220px] max-h-[60vh] overflow-auto flex items-center justify-center mt-3">
                {selectedEvidence.loading ? (
                  <div className="text-sm font-semibold text-slate-500 py-10">
                    Cargando evidencia...
                  </div>
                ) : selectedEvidence.error ? (
                  <div className="px-6 py-8 text-center">
                    <div className="text-sm font-bold text-red-600">{selectedEvidence.error}</div>
                    <div className="text-xs text-slate-500 mt-2">
                      Verifica que la imagen exista y que el backend pueda servir `/uploads/fichajes/...`
                    </div>
                  </div>
                ) : selectedEvidence.imageUrl ? (
                  <motion.img
                    key={selectedEvidence.imageUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={selectedEvidence.imageUrl}
                    alt="Evidencia"
                    style={{ transform: `scale(${evidenceZoom})`, transformOrigin: "center center" }}
                    className="w-full h-auto object-contain transition-transform duration-200"
                  />
                ) : (
                  <div className="text-sm font-semibold text-slate-500 py-10">
                    Sin imagen disponible.
                  </div>
                )}
              </div>

              <div className="p-4">
                <button
                  onClick={closeEvidenceModal}
                  className="w-full py-3 rounded-2xl bg-slate-900 text-white text-sm font-extrabold"
                >
                  CERRAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="min-w-0 flex-1 text-center">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    Ubicación
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">
                    {selectedLocation.guardia}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {selectedLocation.servicio}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLocation(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100">
                  <div className="h-[240px] w-full">
                    <MapContainer
                      center={[selectedLocation.lat, selectedLocation.lng]}
                      zoom={18}
                      scrollWheelZoom={false}
                      style={{ height: "240px", width: "100%" }}
                    >
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker
                        position={[selectedLocation.lat, selectedLocation.lng]}
                        icon={customMarker}
                      />
                    </MapContainer>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-slate-50 border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
                      <Navigation className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        Coordenadas
                      </div>
                      <div className="text-base font-extrabold text-slate-900 mt-1 break-all">
                        {selectedLocation.lat}, {selectedLocation.lng}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={copyCoordinates}
                      className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-extrabold inline-flex items-center justify-center gap-2"
                    >
                      {copiedCoords ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCoords ? "Copiado" : "Copiar coordenadas"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={openGoogleMapsApp}
                  disabled={openingMaps}
                  className={cn(
                    "w-full py-4 rounded-2xl text-sm font-extrabold inline-flex items-center justify-center gap-2",
                    openingMaps ? "bg-slate-500 text-white" : "bg-slate-900 text-white"
                  )}
                >
                  <MapPin className="w-4 h-4" />
                  {openingMaps ? "ABRIENDO..." : "ABRIR UBICACIÓN"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}