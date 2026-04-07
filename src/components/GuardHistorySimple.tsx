import React from "react";
import { Clock3, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";

export type GuardHistoryItem = {
  id: number | string;
  tipo: "IN" | "OUT";
  fecha: string | Date;
  servicio: string;
  jornada: string;
  turno?: string;
};

type Props = {
  items: GuardHistoryItem[];
  onBack?: () => void;
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

export default function GuardHistorySimple({ items, onBack }: Props) {
  const lastThree = [...items].slice(0, 3);

  return (
    <div className="min-h-screen bg-[#f4f6f8] px-5 pb-10 pt-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
              Consulta
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
              Historial
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Últimos movimientos registrados del guardia.
            </p>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="rounded-2xl bg-[#0c1833] px-6 py-4 text-lg font-semibold text-white shadow-sm transition active:scale-[0.98]"
            >
              Volver
            </button>
          )}
        </div>

        <div className="mb-5 rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50">
              <ShieldCheck className="h-6 w-6 text-cyan-500" />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                Vista segura
              </p>
              <p className="text-sm text-slate-600">
                Solo lectura. No se muestran fotos ni ubicación.
              </p>
            </div>
          </div>
        </div>

        {lastThree.length === 0 ? (
          <div className="rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
              Sin registros
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              Aún no hay movimientos
            </h2>
            <p className="mt-2 text-base leading-relaxed text-slate-500">
              Cuando el guardia registre una entrada o salida, aparecerá aquí el
              historial reciente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {lastThree.map((item) => {
              const { date, time } = formatDateTime(item.fecha);
              const isEntrada = item.tipo === "IN";

              return (
                <div
                  key={item.id}
                  className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold",
                        isEntrada
                          ? "bg-cyan-50 text-cyan-600"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {isEntrada ? "IN" : "OUT"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                        {isEntrada ? "Entrada" : "Salida"}
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-slate-900">
                        {isEntrada
                          ? "Registro de entrada"
                          : "Registro de salida"}
                      </h3>

                      <div className="mt-3 flex items-center gap-2 text-slate-500">
                        <Clock3 className="h-4 w-4" />
                        <span className="text-sm">
                          {date} · {time}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.turno ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {item.turno}
                          </span>
                        ) : null}

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {item.servicio}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {item.jornada}
                        </span>
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