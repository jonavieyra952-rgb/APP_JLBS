import React, { useState } from "react";
import { cn } from "../lib/utils";

export type GuardHistoryItem = {
  id: number | string;
  tipo: "IN" | "OUT";
  fecha: string | Date;
  hora?: string | Date;
  servicio: string;
  turno?: string;
  foto_url?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type MapRecord = {
  tipo: "IN" | "OUT";
  lat: number;
  lng: number;
  fechaTexto: string;
  horaTexto: string;
  servicio: string;
};

type Props = {
  items: GuardHistoryItem[];
  loading?: boolean;
  error?: string;
  onBack?: () => void;
  onRefresh?: () => void;
};

function formatDateTime(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    return {
      date: "-",
      time: "-",
    };
  }

  return {
    date: d.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function itHasMap(item: GuardHistoryItem) {
  return item.lat != null && item.lng != null;
}

export default function GuardHistorySimple({
  items,
  loading = false,
  error = "",
  onBack,
  onRefresh,
}: Props) {
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedMapRecord, setSelectedMapRecord] = useState<MapRecord | null>(null);

  const lastThree = [...items].slice(0, 3);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans max-w-md mx-auto relative">
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

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.22em]">
            Consulta
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mt-2">Historial</h1>
          <p className="text-slate-500 mt-2">Últimos 3 registros de entrada y salida.</p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="bg-slate-900 text-white px-6 py-4 rounded-[1.4rem] font-bold text-lg shadow-sm"
          >
            Volver
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Historial
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="text-[10px] font-bold text-[#0dcaf2] uppercase tracking-widest"
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-slate-400 italic text-center py-6">
            Cargando historial...
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 text-sm font-semibold">
            {error}
          </div>
        ) : lastThree.length === 0 ? (
          <div className="text-sm text-slate-400 italic text-center py-6">
            Aún no hay fichajes.
          </div>
        ) : (
          <div className="space-y-3">
            {lastThree.map((item) => {
              const isIn = String(item.tipo || "").toUpperCase() === "IN";
              const dt = formatDateTime(item.hora || item.fecha);
              const itemTurno = String(item.turno || "").trim() || "Sin turno";
              const itemServicio = item.servicio || "Sin servicio";

              return (
                <div
                  key={String(item.id)}
                  className="bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs",
                          isIn
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-slate-900/10 text-slate-900"
                        )}
                      >
                        {isIn ? "IN" : "OUT"}
                      </div>

                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {isIn ? "Entrada" : "Salida"}
                        </div>

                        <div className="mt-1">
                          <div className="text-xs text-slate-500">{dt.date}</div>
                          <div className="text-xs font-semibold text-slate-700">{dt.time}</div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                            {itemTurno}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                            {itemServicio}
                          </span>

                          {item.foto_url && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                              Con foto
                            </span>
                          )}

                          {itHasMap(item) && (
                            <button
                              onClick={() =>
                                openMapModal({
                                  tipo: isIn ? "IN" : "OUT",
                                  lat: Number(item.lat),
                                  lng: Number(item.lng),
                                  fechaTexto: dt.date,
                                  horaTexto: dt.time,
                                  servicio: itemServicio,
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
