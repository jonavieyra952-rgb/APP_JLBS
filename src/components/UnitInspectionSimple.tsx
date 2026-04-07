import React, { useEffect, useMemo, useState } from "react";
import { Camera, ShieldCheck, TriangleAlert } from "lucide-react";

type Props = {
  token: string;
  apiBase: string;
  onBack?: () => void;
};

const TURNOS = ["Matutino", "Nocturno"];

const SERVICIOS = [
  "Notaria 190",
  "Electro Motor Service",
  "Tubos Tollocan",
  "La Peninsular (Tramo Atarasquillo)",
  "La Peninsular (Tramo Xona)",
];

const GOLPES = ["Sin novedad", "Con detalle"];
const GASOLINA = ["Alto", "Medio", "Bajo"];
const ACEITE = ["Correcto", "Bajo"];
const FRENOS = ["Correcto", "Bajo"];
const LLANTAS = ["Correctas", "Revisar"];

export default function UnitInspectionSimple({
  token,
  apiBase,
  onBack,
}: Props) {
  const [unidad, setUnidad] = useState("");
  const [loadingUnidad, setLoadingUnidad] = useState(true);

  const [turno, setTurno] = useState("Matutino");
  const [servicio, setServicio] = useState("Notaria 190");

  const [golpesEstado, setGolpesEstado] = useState("Sin novedad");
  const [gasolinaNivel, setGasolinaNivel] = useState("Medio");
  const [aceiteEstado, setAceiteEstado] = useState("Correcto");
  const [liquidoFrenosEstado, setLiquidoFrenosEstado] = useState("Correcto");
  const [llantasEstado, setLlantasEstado] = useState("Correctas");

  const [observaciones, setObservaciones] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
    }),
    [token]
  );

  const hayIncidencia = useMemo(() => {
    return (
      golpesEstado === "Con detalle" ||
      gasolinaNivel === "Bajo" ||
      aceiteEstado === "Bajo" ||
      liquidoFrenosEstado === "Bajo" ||
      llantasEstado === "Revisar"
    );
  }, [
    golpesEstado,
    gasolinaNivel,
    aceiteEstado,
    liquidoFrenosEstado,
    llantasEstado,
  ]);

  useEffect(() => {
    if (!foto) {
      setFotoPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(foto);
    setFotoPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [foto]);

  const parseResponse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json().catch(() => ({}));
    }
    const text = await res.text().catch(() => "");
    return { _raw: text };
  };

  useEffect(() => {
    async function loadAssignedUnit() {
      try {
        setLoadingUnidad(true);
        setError("");

        const response = await fetch(
          `${apiBase}/api/unit-inspection/my-assigned-unit`,
          {
            method: "GET",
            headers: authHeaders,
          }
        );

        const data: any = await parseResponse(response);

        if (!response.ok) {
          const detail =
            data?.error ||
            (data?._raw ? "Respuesta no JSON (posible aviso de ngrok)" : "") ||
            `HTTP ${response.status}`;
          throw new Error(detail || "No se pudo cargar la unidad asignada");
        }

        if (!data?.success) {
          throw new Error(data?.error || "No se pudo cargar la unidad asignada");
        }

        if (!data?.unit?.nombre) {
          setUnidad("");
          setError("No tienes una unidad asignada. Contacta al administrador.");
          return;
        }

        setUnidad(data.unit.nombre);
      } catch (err: any) {
        setUnidad("");
        setError(err?.message || "Error al cargar la unidad asignada");
      } finally {
        setLoadingUnidad(false);
      }
    }

    loadAssignedUnit();
  }, [apiBase, authHeaders]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    const obs = observaciones.trim();

    if (!unidad) {
      setError("No tienes una unidad asignada para registrar la inspección.");
      return;
    }

    if (obs.length < 3) {
      setError("Escribe observaciones más claras.");
      return;
    }

    if (hayIncidencia && !foto) {
      setError("Debes adjuntar una foto cuando exista una incidencia.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("turno", turno);
      formData.append("servicio", servicio);
      formData.append("golpes_estado", golpesEstado);
      formData.append("gasolina_nivel", gasolinaNivel);
      formData.append("aceite_estado", aceiteEstado);
      formData.append("liquido_frenos_estado", liquidoFrenosEstado);
      formData.append("llantas_estado", llantasEstado);
      formData.append("observaciones", obs);

      if (foto) {
        formData.append("foto", foto);
      }

      const response = await fetch(`${apiBase}/api/unit-inspection`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      const data: any = await parseResponse(response);

      if (!response.ok) {
        const detail =
          data?.error ||
          (data?._raw ? "Respuesta no JSON (posible aviso de ngrok)" : "") ||
          `HTTP ${response.status}`;
        throw new Error(detail || "No se pudo guardar la inspección");
      }

      if (!data?.success) {
        throw new Error(data?.error || "No se pudo guardar la inspección");
      }

      setMessage("Inspección registrada correctamente.");
      setGolpesEstado("Sin novedad");
      setGasolinaNivel("Medio");
      setAceiteEstado("Correcto");
      setLiquidoFrenosEstado("Correcto");
      setLlantasEstado("Correctas");
      setObservaciones("");
      setFoto(null);
      setFotoPreview("");
    } catch (err: any) {
      setError(err?.message || "Error al guardar inspección");
    } finally {
      setLoading(false);
    }
  }

  function renderSelect(
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: string[]
  ) {
    return (
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          {label}
        </label>

        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans max-w-md mx-auto relative">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Revisión vehicular
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Inspección de unidad
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            Registra el estado de la unidad asignada.
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            type="button"
            className="bg-slate-900 text-white text-sm font-bold px-6 py-4 rounded-2xl shadow-sm"
          >
            Volver
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-cyan-600" />
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Inspección
            </div>
            <div className="text-sm text-slate-700 mt-1">
              Completa la revisión antes de usar la unidad.
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Unidad asignada
              </label>

              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                {loadingUnidad ? "Cargando unidad..." : unidad || "Sin unidad asignada"}
              </div>
            </div>

            {renderSelect("Turno", turno, setTurno, TURNOS)}
            {renderSelect("Servicio", servicio, setServicio, SERVICIOS)}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Checklist de unidad
          </div>

          <div className="grid grid-cols-1 gap-4">
            {renderSelect("Golpes", golpesEstado, setGolpesEstado, GOLPES)}
            {renderSelect("Gasolina", gasolinaNivel, setGasolinaNivel, GASOLINA)}
            {renderSelect("Aceite", aceiteEstado, setAceiteEstado, ACEITE)}
            {renderSelect("Frenos", liquidoFrenosEstado, setLiquidoFrenosEstado, FRENOS)}
            {renderSelect("Llantas", llantasEstado, setLlantasEstado, LLANTAS)}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Observaciones
          </label>

          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={5}
            placeholder="Ejemplo: Unidad en buen estado general, golpe leve en defensa, gasolina baja."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
          />
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Evidencia fotográfica
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-slate-600">
            <Camera className="h-4 w-4" />
            <span className="text-sm font-semibold">
              {foto ? foto.name : "Seleccionar foto"}
            </span>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setFoto(file);
              }}
            />
          </label>

          {fotoPreview && (
            <div className="mt-4">
              <img
                src={fotoPreview}
                alt="Vista previa"
                className="w-full rounded-2xl border border-slate-200 object-cover max-h-72"
              />
            </div>
          )}

          {hayIncidencia && (
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-amber-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-medium leading-5">
                Se detectó una incidencia. La foto es obligatoria para poder guardar la inspección.
              </p>
            </div>
          )}
        </div>

        {error ? (
          <div className="p-3 rounded-xl text-xs font-bold text-center bg-red-500/15 text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="p-3 rounded-xl text-xs font-bold text-center bg-emerald-500/15 text-emerald-700">
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || loadingUnidad || !unidad}
          className="py-4 rounded-2xl font-bold text-sm border transition shadow-sm w-full bg-[#0dcaf2] text-white border-[#0dcaf2] disabled:opacity-60"
        >
          {loading ? "Guardando..." : "REGISTRAR INSPECCIÓN"}
        </button>
      </form>
    </div>
  );
}