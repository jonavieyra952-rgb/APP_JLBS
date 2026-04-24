import React, { useEffect, useMemo, useState } from "react";
import { Camera, ShieldCheck, TriangleAlert, X } from "lucide-react";
import CameraPunchModal from "./CameraPunchModal";

type Props = {
  token: string;
  apiBase: string;
  onBack?: () => void;
};

type EvidencePhoto = {
  id: string;
  blob: Blob;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
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
const LUCES = ["Correctas", "Revisar"];
const PARABRISAS = ["Correcto", "Revisar"];
const ESPEJOS = ["Correctos", "Revisar"];
const LIMPIEZA = ["Buena", "Regular", "Mala"];
const NIVEL_AGUA = ["Correcto", "Bajo"];

function makePhotoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [lucesEstado, setLucesEstado] = useState("Correctas");
  const [parabrisasEstado, setParabrisasEstado] = useState("Correcto");
  const [espejosEstado, setEspejosEstado] = useState("Correctos");
  const [limpiezaEstado, setLimpiezaEstado] = useState("Buena");
  const [nivelAguaEstado, setNivelAguaEstado] = useState("Correcto");

  const [observaciones, setObservaciones] = useState("");
  const [fotos, setFotos] = useState<EvidencePhoto[]>([]);
  const [openCameraModal, setOpenCameraModal] = useState(false);

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
      llantasEstado === "Revisar" ||
      lucesEstado === "Revisar" ||
      parabrisasEstado === "Revisar" ||
      espejosEstado === "Revisar" ||
      limpiezaEstado === "Mala" ||
      nivelAguaEstado === "Bajo"
    );
  }, [
    golpesEstado,
    gasolinaNivel,
    aceiteEstado,
    liquidoFrenosEstado,
    llantasEstado,
    lucesEstado,
    parabrisasEstado,
    espejosEstado,
    limpiezaEstado,
    nivelAguaEstado,
  ]);

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

  useEffect(() => {
    return () => {
      fotos.forEach((foto) => {
        URL.revokeObjectURL(foto.previewUrl);
      });
    };
  }, [fotos]);

  function removeFoto(id: string) {
    setFotos((prev) => {
      const target = prev.find((foto) => foto.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((foto) => foto.id !== id);
    });
  }

  function resetForm() {
    setGolpesEstado("Sin novedad");
    setGasolinaNivel("Medio");
    setAceiteEstado("Correcto");
    setLiquidoFrenosEstado("Correcto");
    setLlantasEstado("Correctas");
    setLucesEstado("Correctas");
    setParabrisasEstado("Correcto");
    setEspejosEstado("Correctos");
    setLimpiezaEstado("Buena");
    setNivelAguaEstado("Correcto");
    setObservaciones("");

    setFotos((prev) => {
      prev.forEach((foto) => URL.revokeObjectURL(foto.previewUrl));
      return [];
    });
  }

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

    if (hayIncidencia && fotos.length === 0) {
      setError("Debes adjuntar al menos una foto cuando exista una incidencia.");
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
      formData.append("luces_estado", lucesEstado);
      formData.append("parabrisas_estado", parabrisasEstado);
      formData.append("espejos_estado", espejosEstado);
      formData.append("limpieza_estado", limpiezaEstado);
      formData.append("nivel_agua_estado", nivelAguaEstado);
      formData.append("observaciones", obs);

      fotos.forEach((foto, index) => {
        formData.append("fotos", foto.blob, `inspeccion-${Date.now()}-${index + 1}.jpg`);
      });

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
      resetForm();
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
            {renderSelect("Nivel de luces", lucesEstado, setLucesEstado, LUCES)}
            {renderSelect("Parabrisas", parabrisasEstado, setParabrisasEstado, PARABRISAS)}
            {renderSelect("Espejos", espejosEstado, setEspejosEstado, ESPEJOS)}
            {renderSelect("Limpieza", limpiezaEstado, setLimpiezaEstado, LIMPIEZA)}
            {renderSelect("Nivel de agua", nivelAguaEstado, setNivelAguaEstado, NIVEL_AGUA)}
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
            placeholder="Ejemplo: Unidad en buen estado general, golpe leve en defensa, limpieza regular, nivel de agua bajo."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
          />
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Evidencia fotográfica
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
              if (fotos.length >= 6) {
                setError("Solo puedes agregar hasta 6 fotos.");
                return;
              }
              setOpenCameraModal(true);
            }}
            className="w-full flex items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-slate-700"
          >
            <Camera className="h-4 w-4" />
            <span className="text-sm font-semibold">
              {fotos.length > 0
                ? `Agregar otra foto (${fotos.length}/6)`
                : "Tomar foto o elegir de galería"}
            </span>
          </button>

          {fotos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {fotos.map((foto, index) => (
                <div
                  key={foto.id}
                  className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50"
                >
                  <img
                    src={foto.previewUrl}
                    alt={`Vista previa ${index + 1}`}
                    className="w-full h-40 object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removeFoto(foto.id)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="absolute left-2 bottom-2 rounded-lg bg-slate-900/75 text-white text-[10px] font-bold px-2 py-1">
                    Foto {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 text-[11px] text-slate-500">
            Puedes subir hasta 6 fotos. La cámara y la galería agregan el texto de evidencia sobre la imagen.
          </div>

          {hayIncidencia && (
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-amber-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-medium leading-5">
                Se detectó una incidencia. Debes adjuntar al menos una foto para poder guardar la inspección.
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

      <CameraPunchModal
        open={openCameraModal}
        title="Evidencia de inspección"
        subtitle="La foto incluirá hora, ubicación, servicio, unidad y turno."
        headerLabel="INSPECCIÓN"
        servicio={servicio}
        shift={turno}
        unidad={unidad}
        onClose={() => setOpenCameraModal(false)}
        onConfirm={({ blob, lat, lng }) => {
          if (fotos.length >= 6) {
            setError("Solo puedes agregar hasta 6 fotos.");
            setOpenCameraModal(false);
            return;
          }

          const previewUrl = URL.createObjectURL(blob);

          setFotos((prev) => [
            ...prev,
            {
              id: makePhotoId(),
              blob,
              previewUrl,
              lat,
              lng,
            },
          ]);

          setOpenCameraModal(false);
          setError("");
        }}
      />
    </div>
  );
}