import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Clock3,
  MapPinned,
  CircleAlert,
  FileText,
  Activity,
  ArrowUpRight,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "./lib/utils";
import TimeClockSimple from "./components/TimeClockSimple";
import SupervisorReportSimple from "./components/SupervisorReportSimple";
import SupervisorHistorySimple from "./components/SupervisorHistorySimple";
import SupervisorGuardHistorySimple from "./components/SupervisorGuardHistorySimple";
import UnitInspectionSimple from "./components/UnitInspectionSimple";
import logoJLBS from "./assets/logo-jlbs.jpeg";

type Shift = "Matutino" | "Nocturno";
type UserRole = "guard" | "supervisor" | "admin";
type Screen =
  | "welcome"
  | "auth"
  | "verify"
  | "dashboard"
  | "timeclock"
  | "guard-history"
  | "unit-inspection"
  | "supervisor"
  | "supervisor-history"
  | "supervisor-guards-history"
  | "admin";

type AdminUserRow = {
  id: number;
  nombre: string;
  email: string;
  turno: Shift;
  role: UserRole;
  activo: number;
  verificado: number;
};

type SupervisorHistoryItem = {
  id: number;
  servicio_id: number;
  servicio_nombre: string;
  tipo: "IN" | "OUT";
  turno: Shift;
  novedades: string | null;
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
  fecha: string;
  hora: string;
};

type SupervisorGuardPunchItem = {
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

type GuardHistoryItem = {
  id: number | string;
  tipo: "IN" | "OUT";
  turno: Shift;
  lugar_trabajo: string;
  jornada: string;
  fecha: string;
  hora: string;
};

const isAdminWebRoute =
  typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

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

function formatOnlyTime(value: Date) {
  return value.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buen día";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function supervisorSummaryTodayLabel(tipo?: string) {
  return String(tipo || "").toUpperCase() === "IN" ? "Entrada" : "Salida";
}

function supervisorSummaryTodayValue(value?: string) {
  return value || "";
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(isAdminWebRoute ? "admin" : "welcome");

  const [guardName, setGuardName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shift, setShift] = useState<Shift | null>(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | "">("");

  const API_URL = "https://bottomless-mattie-glucosidic.ngrok-free.dev";

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };

  const [authToken, setAuthToken] = useState<string>("");

  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [supervisorItems, setSupervisorItems] = useState<SupervisorHistoryItem[]>([]);
  const [supervisorSummaryLoading, setSupervisorSummaryLoading] = useState(false);
  const [supervisorGuardPunches, setSupervisorGuardPunches] = useState<SupervisorGuardPunchItem[]>([]);
  const [supervisorGuardPunchesLoading, setSupervisorGuardPunchesLoading] = useState(false);
  const [dashboardNow, setDashboardNow] = useState(new Date());
  const [supervisorHistoryFilter, setSupervisorHistoryFilter] = useState<"all" | "today">("all");

  const [guardHistoryItems, setGuardHistoryItems] = useState<GuardHistoryItem[]>([]);
  const [guardHistoryLoading, setGuardHistoryLoading] = useState(false);
  const [guardHistoryError, setGuardHistoryError] = useState("");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [adminProfile, setAdminProfile] = useState<{
    nombre: string;
    email: string;
    role: UserRole;
  } | null>(null);

  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [dbType, setDbType] = useState<string>("Desconocido");

  const [newUserNombre, setNewUserNombre] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserTurno, setNewUserTurno] = useState<Shift>("Matutino");
  const [newUserRole, setNewUserRole] = useState<UserRole>("guard");
  const [creatingAdminUser, setCreatingAdminUser] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setDashboardNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const saveLocalUser = (user: any) => {
    const users = JSON.parse(localStorage.getItem("jlbs_users") || "[]");
    users.push(user);
    localStorage.setItem("jlbs_users", JSON.stringify(users));
  };

  const getLocalUsers = () => JSON.parse(localStorage.getItem("jlbs_users") || "[]");

  const goToAppHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const parseResponse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json().catch(() => ({}));
    }
    const text = await res.text().catch(() => "");
    return { _raw: text };
  };

  const fetchSupervisorSummary = async () => {
    if (!authToken || userRole !== "supervisor") return;

    setSupervisorSummaryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/supervision/history?limit=100`, {
        method: "GET",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cargar el resumen de supervisión.");
      }

      setSupervisorItems(data.items || []);
    } catch (err) {
      console.error("[SUPERVISOR SUMMARY ERROR]", err);
      setSupervisorItems([]);
    } finally {
      setSupervisorSummaryLoading(false);
    }
  };

  const fetchGuardPunchesForSupervisor = async () => {
    if (!authToken || userRole !== "supervisor") return;

    setSupervisorGuardPunchesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/supervision/guards/history?limit=20`, {
        method: "GET",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cargar el historial de guardias.");
      }

      setSupervisorGuardPunches(data.items || []);
    } catch (err) {
      console.error("[SUPERVISOR GUARD PUNCHES ERROR]", err);
      setSupervisorGuardPunches([]);
    } finally {
      setSupervisorGuardPunchesLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && screen === "dashboard" && userRole === "supervisor") {
      fetchSupervisorSummary();
      fetchGuardPunchesForSupervisor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, screen, userRole, authToken]);

  const normalizeGuardHistoryItem = (item: any, index: number): GuardHistoryItem => {
    const rawTipo = String(item?.tipo || item?.type || "IN").toUpperCase();
    return {
      id: item?.id ?? `${rawTipo}-${item?.fecha || item?.hora || index}`,
      tipo: rawTipo === "OUT" ? "OUT" : "IN",
      turno: (item?.turno || shift || "Matutino") as Shift,
      lugar_trabajo:
        item?.lugar_trabajo ||
        item?.servicio_nombre ||
        item?.servicio ||
        item?.lugar ||
        "Servicio no disponible",
      jornada: item?.jornada || "Sin jornada",
      fecha: item?.fecha || item?.created_at || item?.hora || new Date().toISOString(),
      hora: item?.hora || item?.fecha || item?.created_at || new Date().toISOString(),
    };
  };

  const fetchGuardHistory = async () => {
    if (!authToken || userRole !== "guard") return;

    setGuardHistoryLoading(true);
    setGuardHistoryError("");

    try {
      const res = await fetch(`${API_URL}/api/timeclock/history?limit=3`, {
        method: "GET",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data: any = await parseResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cargar el historial.");
      }

      const rawItems = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.history)
        ? data.history
        : Array.isArray(data.records)
        ? data.records
        : [];

      const normalized = rawItems
        .map((item: any, index: number) => normalizeGuardHistoryItem(item, index))
        .sort((a: GuardHistoryItem, b: GuardHistoryItem) => {
          const ta = new Date(b.hora || b.fecha).getTime();
          const tb = new Date(a.hora || a.fecha).getTime();
          return ta - tb;
        })
        .slice(0, 3);

      setGuardHistoryItems(normalized);
    } catch (err: any) {
      console.error("[GUARD HISTORY ERROR]", err);
      setGuardHistoryItems([]);
      setGuardHistoryError(err?.message || "No se pudo cargar el historial.");
    } finally {
      setGuardHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && userRole === "guard" && (screen === "dashboard" || screen === "guard-history")) {
      fetchGuardHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, screen, userRole, authToken]);

  const fetchAdminUsers = async () => {
    if (!adminToken) return;

    setIsAdminLoading(true);
    setAdminError("");

    try {
      const healthRes = await fetch(`${API_URL}/api/health`, {
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const healthData = await healthRes.json().catch(() => ({}));
      setDbType(healthData.db_type || "MySQL");

      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error al obtener usuarios (${response.status})`);
      }

      setAdminUsers(data.users || []);
    } catch (err: any) {
      setAdminError(err?.message || "No se pudo cargar la lista de usuarios.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  useEffect(() => {
    if (screen === "admin" && adminToken) {
      fetchAdminUsers();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [adminToken, screen]);

  const handleAdminLogin = async () => {
    setAdminLoginLoading(true);
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error del servidor (${response.status})`);
      }

      const role = (data.user?.role || "guard") as UserRole;

      if (role !== "admin") {
        throw new Error("Esta cuenta no tiene permisos de administrador.");
      }

      setAdminToken(data.token || "");
      setAdminProfile({
        nombre: data.user?.nombre || "Administrador",
        email: data.user?.email || adminEmail,
        role,
      });
      setAdminSuccess("Acceso de administrador correcto.");
    } catch (err: any) {
      setAdminError(err?.message || "No se pudo iniciar sesión como administrador.");
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken("");
    setAdminProfile(null);
    setAdminEmail("");
    setAdminPassword("");
    setAdminUsers([]);
    setAdminError("");
    setAdminSuccess("");
  };

  const handleCreateAdminUser = async () => {
    setCreatingAdminUser(true);
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombre: newUserNombre,
          email: newUserEmail,
          password: newUserPassword,
          turno: newUserTurno,
          role: newUserRole,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error al crear usuario (${response.status})`);
      }

      setAdminSuccess("Usuario creado correctamente.");
      setNewUserNombre("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserTurno("Matutino");
      setNewUserRole("guard");

      await fetchAdminUsers();
    } catch (err: any) {
      setAdminError(err?.message || "No se pudo crear el usuario.");
    } finally {
      setCreatingAdminUser(false);
    }
  };

  const handleChangeUserRole = async (userId: number, role: UserRole) => {
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ role }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error al actualizar rol (${response.status})`);
      }

      setAdminSuccess("Rol actualizado correctamente.");
      await fetchAdminUsers();
    } catch (err: any) {
      setAdminError(err?.message || "No se pudo actualizar el rol.");
    }
  };

  const handleToggleUserStatus = async (userId: number, activo: number) => {
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ activo: activo ? 0 : 1 }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error al actualizar estado (${response.status})`);
      }

      setAdminSuccess(activo ? "Usuario desactivado." : "Usuario activado.");
      await fetchAdminUsers();
    } catch (err: any) {
      setAdminError(err?.message || "No se pudo actualizar el estado.");
    }
  };

  const handleAuth = async () => {
    setIsLoading(true);
    setError("");

    if (isDemoMode) {
      setTimeout(() => {
        if (isRegistering) {
          saveLocalUser({
            nombre: guardName,
            email,
            password,
            turno: shift,
            role: "guard",
            id: Date.now(),
          });
          setIsRegistering(false);
          setError("Registro exitoso (Modo Local). Inicia sesión.");
        } else {
          const locals = getLocalUsers();
          const user = locals.find(
            (u: any) => (u.nombre === guardName || u.email === guardName) && u.password === password
          );

          if (user) {
            setGuardName(user.nombre);
            setIsLoggedIn(true);
            setAuthToken("DEMO_TOKEN");
            setUserRole((user.role as UserRole) || "guard");
            setShift((user.turno as Shift) || "Matutino");
            setScreen("dashboard");
          } else {
            setError("Credenciales locales no encontradas.");
          }
        }
        setIsLoading(false);
      }, 800);
      return;
    }

    try {
      if (isRegistering) {
        const response = await fetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({
            nombre: guardName,
            email,
            password,
            turno: shift,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Error del servidor (${response.status})`);
        }

        setVerifyEmail((data.user?.email || email || "").toLowerCase());
        setVerifyCode("");
        setIsRegistering(false);
        setScreen("verify");
        setError("Te enviamos un código. Ingresa el código para verificar tu cuenta.");
      } else {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({
            email: guardName,
            password,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          if (data?.needs_verification) {
            setVerifyEmail(String(guardName).trim().toLowerCase());
            setVerifyCode("");
            setScreen("verify");
            setError("Tu cuenta no está verificada. Ingresa el código que llegó a tu correo.");
            return;
          }
          throw new Error(data.error || `Error del servidor (${response.status})`);
        }

        setGuardName(data.user?.nombre || guardName);
        setIsLoggedIn(true);
        setAuthToken(data.token || "");
        setUserRole((data.user?.role as UserRole) || "guard");
        setShift((data.user?.turno as Shift) || "Matutino");
        setScreen("dashboard");
      }
    } catch (err: any) {
      console.error(err);
      setIsDemoMode(true);
      setError(err?.message || "Error de conexión. Se activó MODO DEMO para que puedas probar la interfaz.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifyLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          email: verifyEmail,
          code: verifyCode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error (${response.status})`);
      }

      setError("¡Cuenta verificada! Ahora inicia sesión.");
      setScreen("auth");
      setIsRegistering(false);

      setGuardName(verifyEmail);
      setPassword("");
      setShift(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error al verificar el código.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/resend-code`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ email: verifyEmail }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error (${response.status})`);
      }

      setError("Código reenviado. Revisa tu correo (y spam/promociones).");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error al reenviar el código.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthToken("");
    setGuardName("");
    setEmail("");
    setPassword("");
    setShift(null);
    setUserRole("");
    setSupervisorItems([]);
    setSupervisorGuardPunches([]);
    setGuardHistoryItems([]);
    setGuardHistoryError("");
    setError("");
    setIsDemoMode(false);
    setSupervisorHistoryFilter("all");
    setScreen("auth");
  };

  const supervisorTodaySummary = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayKey = `${yyyy}-${mm}-${dd}`;

    const todayItems = supervisorItems.filter((it) => {
      const dt = formatDateTime(it.hora || it.fecha);
      return dt.dateKey === todayKey;
    });

    const openMap = new Map<string, SupervisorHistoryItem>();

    [...todayItems]
      .sort((a, b) => {
        const ta = new Date(a.hora || a.fecha).getTime();
        const tb = new Date(b.hora || b.fecha).getTime();
        return ta - tb;
      })
      .forEach((it) => {
        const key = String(it.servicio_id);
        const tipo = String(it.tipo || "").toUpperCase();

        if (tipo === "IN") {
          openMap.set(key, it);
        } else if (tipo === "OUT") {
          openMap.delete(key);
        }
      });

    const lastItem =
      supervisorItems.length > 0
        ? [...supervisorItems].sort((a, b) => {
            const ta = new Date(a.hora || a.fecha).getTime();
            const tb = new Date(b.hora || b.fecha).getTime();
            return tb - ta;
          })[0]
        : null;

    const lastOpen = Array.from(openMap.values()).sort((a, b) => {
      const ta = new Date(a.hora || a.fecha).getTime();
      const tb = new Date(b.hora || b.fecha).getTime();
      return tb - ta;
    })[0];

    return {
      todayCount: todayItems.length,
      lastItem,
      openEntry: lastOpen || null,
      hasOpenEntry: !!lastOpen,
    };
  }, [supervisorItems]);

  if (screen === "admin" || isAdminWebRoute) {
    if (!adminToken || !adminProfile) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 font-sans">
          <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl border border-slate-100 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Panel Admin Web</h1>
              <p className="text-slate-500 mt-2">Inicia sesión con una cuenta de administrador.</p>
            </div>

            {adminError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-semibold p-3">
                {adminError}
              </div>
            )}

            {adminSuccess && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold p-3">
                {adminSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Correo administrador
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>

              <button
                onClick={handleAdminLogin}
                disabled={adminLoginLoading || !adminEmail || !adminPassword}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-sm",
                  adminLoginLoading || !adminEmail || !adminPassword
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-900 text-white"
                )}
              >
                {adminLoginLoading ? "INGRESANDO..." : "ENTRAR AL PANEL"}
              </button>

              <button
                onClick={goToAppHome}
                className="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm"
              >
                IR A LA APP
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-8 font-sans">
        <div className="max-w-7xl mx-auto w-full space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Panel de Administración</h1>
              <p className="text-slate-500">
                Bienvenido, {adminProfile.nombre}. Gestiona guardias, supervisores y administradores.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={fetchAdminUsers}
                disabled={isAdminLoading}
                className="bg-[#0dcaf2] text-white px-5 py-3 rounded-xl font-bold text-sm"
              >
                {isAdminLoading ? "Cargando..." : "ACTUALIZAR"}
              </button>

              <button
                onClick={handleAdminLogout}
                className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-sm"
              >
                CERRAR SESIÓN
              </button>

              <button
                onClick={goToAppHome}
                className="bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold text-sm"
              >
                IR A LA APP
              </button>
            </div>
          </div>

          {(adminError || adminSuccess) && (
            <div
              className={cn(
                "rounded-2xl border p-4 text-sm font-semibold",
                adminError
                  ? "bg-red-50 border-red-100 text-red-700"
                  : "bg-emerald-50 border-emerald-100 text-emerald-700"
              )}
            >
              {adminError || adminSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
            <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100 h-fit">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ClipboardList className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Crear usuario</h2>
                  <p className="text-sm text-slate-500">Crea guardias, supervisores o administradores.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newUserNombre}
                    onChange={(e) => setNewUserNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Correo
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Turno
                  </label>
                  <select
                    value={newUserTurno}
                    onChange={(e) => setNewUserTurno(e.target.value as Shift)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                  >
                    <option value="Matutino">Matutino</option>
                    <option value="Nocturno">Nocturno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Rol
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                  >
                    <option value="guard">Guardia</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateAdminUser}
                  disabled={
                    creatingAdminUser ||
                    !newUserNombre ||
                    !newUserEmail ||
                    !newUserPassword ||
                    !newUserTurno ||
                    !newUserRole
                  }
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-sm",
                    creatingAdminUser ||
                      !newUserNombre ||
                      !newUserEmail ||
                      !newUserPassword ||
                      !newUserTurno ||
                      !newUserRole
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-slate-900 text-white"
                  )}
                >
                  {creatingAdminUser ? "CREANDO..." : "CREAR USUARIO"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-slate-800">Usuarios registrados</h2>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      dbType === "MySQL"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    DB: {dbType}
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  Total: <span className="font-bold text-slate-700">{adminUsers.length}</span>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest">
                      <th className="p-4 font-bold">ID</th>
                      <th className="p-4 font-bold">Nombre</th>
                      <th className="p-4 font-bold">Email</th>
                      <th className="p-4 font-bold">Turno</th>
                      <th className="p-4 font-bold">Rol</th>
                      <th className="p-4 font-bold">Estado</th>
                      <th className="p-4 font-bold">Verificado</th>
                      <th className="p-4 font-bold">Acciones</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-50">
                    {adminUsers.length > 0 ? (
                      adminUsers.map((u) => (
                        <tr key={u.id} className="text-sm text-slate-600 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-mono text-xs">{u.id}</td>
                          <td className="p-4 font-bold text-slate-900">{u.nombre}</td>
                          <td className="p-4">{u.email}</td>
                          <td className="p-4">{u.turno}</td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                                u.role === "admin"
                                  ? "bg-violet-100 text-violet-700"
                                  : u.role === "supervisor"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                              )}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                                u.activo === 1
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              )}
                            >
                              {u.activo === 1 ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                                u.verificado === 1
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              )}
                            >
                              {u.verificado === 1 ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {u.role !== "guard" && (
                                <button
                                  onClick={() => handleChangeUserRole(u.id, "guard")}
                                  className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold"
                                >
                                  Hacer guardia
                                </button>
                              )}

                              {u.role !== "supervisor" && (
                                <button
                                  onClick={() => handleChangeUserRole(u.id, "supervisor")}
                                  className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold"
                                >
                                  Hacer supervisor
                                </button>
                              )}

                              {u.role !== "admin" && (
                                <button
                                  onClick={() => handleChangeUserRole(u.id, "admin")}
                                  className="px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-[11px] font-bold"
                                >
                                  Hacer admin
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleUserStatus(u.id, u.activo)}
                                className={cn(
                                  "px-3 py-2 rounded-lg text-[11px] font-bold",
                                  u.activo === 1
                                    ? "bg-red-50 text-red-700"
                                    : "bg-slate-100 text-slate-700"
                                )}
                              >
                                {u.activo === 1 ? "Desactivar" : "Activar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-400 italic">
                          No hay usuarios registrados o todavía no se cargó la lista.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 text-xs text-slate-400">
                API actual: <span className="text-slate-700 font-mono">{API_URL}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "welcome") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans max-w-md mx-auto relative overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              'url("https://i.pinimg.com/736x/4d/4a/bf/4d4abf59ac807862f99ea81f37799b08.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center space-y-12 z-10"
        >
          <div className="relative">
            <div className="w-48 h-48 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl p-4 border border-white/20">
              <img
                src="/logo.png"
                alt="JLBS Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement!.innerHTML =
                    '<div class="text-slate-900 font-bold text-4xl">JLBS</div>';
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              JLBS SERVICIOS <br />
              <span className="text-white font-medium text-xl uppercase tracking-widest">SA DE CV</span>
            </h1>
            <p className="text-slate-300 text-sm max-w-[240px] mx-auto leading-relaxed font-medium">
              Plataforma de gestión de seguridad y servicios de campo.
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setScreen("auth")}
            className="group relative flex items-center gap-3 bg-white text-slate-900 px-10 py-5 rounded-full font-bold text-lg shadow-2xl hover:bg-[#0dcaf2]/10 transition-all"
          >
            EMPEZAR
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (screen === "auth" && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col p-8 font-sans max-w-md mx-auto relative overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=1080")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[3px]" />
        </div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mt-8 space-y-6 z-10">
          <div className="space-y-4">
            {isDemoMode && (
              <div className="bg-amber-500/20 text-amber-400 p-2 rounded-lg text-[10px] font-bold text-center uppercase tracking-widest border border-amber-500/30">
                ⚠️ Modo Demo (Sin Conexión)
              </div>
            )}

            <h2 className="text-4xl font-bold text-white tracking-tight">{isRegistering ? "Registro" : "Acceso"}</h2>

            <p className="text-[#0dcaf2] font-medium tracking-wide">
              {isRegistering ? "Crea tu cuenta para empezar." : "Identifícate para iniciar tu turno."}
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 rounded-xl text-xs font-bold text-center",
                  error.includes("exitoso") || error.includes("verificada") || error.includes("reenviado")
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                )}
              >
                {error}
              </motion.div>
            )}

            <div className="text-[10px] text-white/40">
              API: <span className="text-white/60">{API_URL}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">
                {isRegistering ? "Nombre Completo" : "Correo (para iniciar sesión)"}
              </label>
              <input
                type="text"
                value={guardName}
                onChange={(e) => setGuardName(e.target.value)}
                placeholder={isRegistering ? "Ej. Juan Pérez" : "correo@ejemplo.com"}
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-lg text-white shadow-xl backdrop-blur-md focus:ring-2 focus:ring-[#0dcaf2] transition-all outline-none placeholder:text-white/20"
              />
            </div>

            {isRegistering && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-lg text-white shadow-xl backdrop-blur-md focus:ring-2 focus:ring-[#0dcaf2] transition-all outline-none placeholder:text-white/20"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-lg text-white shadow-xl backdrop-blur-md focus:ring-2 focus:ring-[#0dcaf2] transition-all outline-none placeholder:text-white/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Turno</label>
              <div className="grid grid-cols-2 gap-3">
                {(["Matutino", "Nocturno"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setShift(t)}
                    className={cn(
                      "py-3 rounded-2xl font-bold transition-all border-2 backdrop-blur-md",
                      shift === t
                        ? "bg-white border-white text-slate-900 shadow-xl"
                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={isLoading || !guardName || !shift || !password || (isRegistering && !email)}
            onClick={handleAuth}
            className={cn(
              "w-full py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all flex items-center justify-center gap-2 mt-2",
              !isLoading && guardName && shift && password && (!isRegistering || email)
                ? "bg-[#0dcaf2] text-white shadow-[#0dcaf2]/20"
                : "bg-white/10 text-white/20 cursor-not-allowed shadow-none"
            )}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRegistering ? "REGISTRARSE" : "ENTRAR AL TURNO"}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </motion.button>

          <div className="flex flex-col items-center gap-4 pt-2">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
                setIsDemoMode(false);
              }}
              className="text-[#0dcaf2] text-sm font-bold uppercase tracking-widest hover:underline"
            >
              {isRegistering ? "¿Ya tienes cuenta? Inicia Sesión" : "¿No tienes cuenta? Regístrate"}
            </button>

            <button
              onClick={() => setScreen("welcome")}
              className="text-white/40 text-[10px] font-bold uppercase tracking-widest"
            >
              Volver al inicio
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (screen === "verify") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col p-8 font-sans max-w-md mx-auto relative overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=1080")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[3px]" />
        </div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mt-8 space-y-6 z-10">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-white tracking-tight">Verificar cuenta</h2>
            <p className="text-[#0dcaf2] font-medium tracking-wide text-sm">Te enviamos un código de 6 dígitos a tu correo.</p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 rounded-xl text-xs font-bold text-center",
                  error.includes("verificada") || error.includes("reenviado")
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                )}
              >
                {error}
              </motion.div>
            )}

            <div className="text-[10px] text-white/40">
              Correo: <span className="text-white/60">{verifyEmail || "(sin correo)"}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">
                Código (6 dígitos)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-lg text-white shadow-xl backdrop-blur-md focus:ring-2 focus:ring-[#0dcaf2] transition-all outline-none placeholder:text-white/20 tracking-[0.4em] text-center"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={verifyLoading || verifyCode.length !== 6 || !verifyEmail}
              onClick={handleVerify}
              className={cn(
                "w-full py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all flex items-center justify-center gap-2 mt-2",
                !verifyLoading && verifyCode.length === 6 && verifyEmail
                  ? "bg-[#0dcaf2] text-white shadow-[#0dcaf2]/20"
                  : "bg-white/10 text-white/20 cursor-not-allowed shadow-none"
              )}
            >
              {verifyLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  VERIFICAR
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </motion.button>

            <button
              onClick={handleResendCode}
              disabled={resendLoading || !verifyEmail}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-sm border transition",
                resendLoading || !verifyEmail
                  ? "bg-white/10 text-white/20 border-white/10 cursor-not-allowed"
                  : "bg-white/5 text-white/70 border-white/15 hover:border-white/30"
              )}
            >
              {resendLoading ? "Reenviando..." : "REENVIAR CÓDIGO"}
            </button>

            <button
              onClick={() => {
                setScreen("auth");
                setError("");
              }}
              className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-2"
            >
              Volver al login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoggedIn && screen === "timeclock") {
    return (
      <TimeClockSimple
        apiUrl={API_URL}
        token={authToken}
        shift={(shift || "Matutino") as Shift}
        onBack={() => setScreen("dashboard")}
      />
    );
  }

  if (isLoggedIn && screen === "guard-history") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans max-w-md mx-auto">
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.22em]">Consulta</div>
            <h1 className="text-4xl font-extrabold text-slate-900 mt-2">Historial</h1>
            <p className="text-slate-500 mt-2">Últimos 3 registros de entrada y salida.</p>
          </div>
          <button
            onClick={() => {
              setScreen("dashboard");
              fetchGuardHistory();
            }}
            className="bg-slate-900 text-white px-6 py-4 rounded-[1.4rem] font-bold text-lg shadow-sm"
          >
            Volver
          </button>
        </div>

        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vista segura</div>
            <div className="text-xl font-extrabold text-slate-900 mt-2">Solo lectura</div>
            <div className="text-sm text-slate-500 mt-1">Aquí solo se muestran los movimientos recientes del guardia.</div>
          </div>
          <button
            onClick={fetchGuardHistory}
            className="px-5 py-4 rounded-[1.4rem] bg-cyan-50 text-[#0dcaf2] border border-cyan-100 font-extrabold text-lg"
          >
            ACTUALIZAR
          </button>
        </div>

        <div className="space-y-4 pb-6">
          {guardHistoryLoading ? (
            <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 text-slate-500 font-medium">
              Cargando historial...
            </div>
          ) : guardHistoryError ? (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-[2rem] p-5 text-sm font-semibold">
              {guardHistoryError}
            </div>
          ) : guardHistoryItems.length > 0 ? (
            guardHistoryItems.map((item) => {
              const dt = formatDateTime(item.hora || item.fecha);
              const isOut = item.tipo === "OUT";

              return (
                <div key={String(item.id)} className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-[92px] h-[92px] rounded-[1.5rem] flex items-center justify-center text-2xl font-extrabold shrink-0",
                        isOut ? "bg-slate-100 text-slate-700" : "bg-cyan-50 text-[#0dcaf2]"
                      )}
                    >
                      {isOut ? "OUT" : "IN"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {isOut ? "Salida" : "Entrada"}
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-2">
                        {isOut ? "Registro de salida" : "Registro de entrada"}
                      </div>
                      <div className="text-slate-500 mt-4 text-xl">{dt.date}</div>
                      <div className="text-4xl font-extrabold text-slate-900 mt-1">{dt.time}</div>

                      <div className="flex flex-wrap gap-3 mt-5">
                        <span className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          {item.turno}
                        </span>
                        <span className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          {item.lugar_trabajo}
                        </span>
                        <span className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          {item.jornada}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sin registros</div>
              <div className="text-xl font-extrabold text-slate-900 mt-2">Aún no hay movimientos disponibles</div>
              <div className="text-sm text-slate-500 mt-2">
                Cuando registres entradas o salidas en control horario, aquí verás los últimos 3 movimientos.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoggedIn && screen === "unit-inspection") {
    return (
      <UnitInspectionSimple
        apiBase={API_URL}
        token={authToken}
        onBack={() => setScreen("dashboard")}
      />
    );
  }

  if (isLoggedIn && screen === "supervisor") {
    return (
      <SupervisorReportSimple
        apiUrl={API_URL}
        token={authToken}
        shift={(shift || "Matutino") as Shift}
        onBack={() => {
          setScreen("dashboard");
          fetchSupervisorSummary();
          fetchGuardPunchesForSupervisor();
        }}
      />
    );
  }

  if (isLoggedIn && screen === "supervisor-history") {
    return (
      <SupervisorHistorySimple
        apiUrl={API_URL}
        token={authToken}
        shift={(shift || "Matutino") as Shift}
        initialFilter={supervisorHistoryFilter}
        onBack={() => {
          setSupervisorHistoryFilter("all");
          setScreen("dashboard");
          fetchSupervisorSummary();
          fetchGuardPunchesForSupervisor();
        }}
      />
    );
  }

  if (isLoggedIn && screen === "supervisor-guards-history") {
    return (
      <SupervisorGuardHistorySimple
        apiUrl={API_URL}
        token={authToken}
        onBack={() => {
          setScreen("dashboard");
          fetchGuardPunchesForSupervisor();
        }}
      />
    );
  }

  if (isLoggedIn && screen === "dashboard") {
    const isSupervisor = userRole === "supervisor";
    const isGuard = userRole === "guard";
    const greeting = getGreeting();

    return (
      <div
        className={cn(
          "min-h-screen bg-slate-50 flex flex-col p-6 font-sans max-w-md mx-auto relative",
          isSupervisor && supervisorTodaySummary.hasOpenEntry ? "pb-36" : "pb-6"
        )}
      >
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.22em]">
              {greeting} {isDemoMode && <span className="text-amber-500">(Modo Demo)</span>}
            </p>

            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{guardName}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {isSupervisor
                  ? "Panel de supervisión y seguimiento operativo"
                  : userRole === "admin"
                  ? "Acceso administrativo"
                  : "Control operativo de turno"}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100">
              <div className="w-2 h-2 rounded-full bg-[#0dcaf2]" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0dcaf2]">
                {userRole === "supervisor"
                  ? "Supervisor"
                  : userRole === "admin"
                  ? "Administrador"
                  : "Guardia"}
              </span>
            </div>
          </div>

          <div className="w-16 h-16 rounded-3xl bg-white shadow-md flex items-center justify-center overflow-hidden border border-slate-100">
            <img
              src={logoJLBS}
              alt="JLBS"
              className="w-12 h-12 object-contain scale-110"
            />
          </div>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-[0_20px_60px_rgba(15,23,42,0.18)] mb-5 relative overflow-hidden border border-slate-800">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Turno Activo</p>
                <h3 className="text-2xl font-bold">{shift}</h3>
              </div>

              {isSupervisor && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Hora actual</p>
                  <p className="text-sm font-bold text-white mt-1">{formatOnlyTime(dashboardNow)}</p>
                </div>
              )}
            </div>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-2 text-[#0dcaf2] text-[11px] font-extrabold uppercase tracking-widest">
              <div className="w-2 h-2 bg-[#0dcaf2] rounded-full animate-pulse" />
              En servicio
            </div>

            {isSupervisor && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Rol</div>
                  <div className="text-sm font-bold text-white mt-1">Supervisor</div>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Estado</div>
                  <div
                    className={cn(
                      "text-sm font-bold mt-1",
                      supervisorTodaySummary.hasOpenEntry ? "text-amber-300" : "text-emerald-300"
                    )}
                  >
                    {supervisorSummaryLoading
                      ? "Cargando..."
                      : supervisorTodaySummary.hasOpenEntry
                      ? "Salida pendiente"
                      : "Sin pendientes"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Shield className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white/5 rotate-12" />
        </div>

        {isSupervisor && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <button
                onClick={() => {
                  setSupervisorHistoryFilter("today");
                  setScreen("supervisor-history");
                }}
                className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 text-left transition active:scale-[0.99] hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Activity className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Hoy</span>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-slate-600" />
                  </div>
                </div>

                <div className="mt-4 text-3xl font-extrabold text-slate-900 leading-none">
                  {supervisorSummaryLoading ? "..." : supervisorTodaySummary.todayCount}
                </div>

                <div className="text-xs text-slate-500 mt-2">Toca para ver registros del día</div>
              </button>

              <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock3 className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Estado</span>
                  </div>

                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center",
                      supervisorTodaySummary.hasOpenEntry
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
                    supervisorTodaySummary.hasOpenEntry ? "text-amber-700" : "text-emerald-700"
                  )}
                >
                  {supervisorSummaryLoading
                    ? "Cargando..."
                    : supervisorTodaySummary.hasOpenEntry
                    ? "Pendiente de salida"
                    : "Sin pendientes"}
                </div>

                <div className="text-xs text-slate-500 mt-2">
                  {supervisorTodaySummary.hasOpenEntry
                    ? "Hay una supervisión abierta"
                    : "Todo al corriente"}
                </div>
              </div>
            </div>

            {supervisorTodaySummary.hasOpenEntry && supervisorTodaySummary.openEntry && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <CircleAlert className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                    <div className="text-sm font-extrabold text-amber-900">Supervisión abierta</div>
                    <div className="text-xs text-amber-800 mt-1">
                      Servicio:{" "}
                      <span className="font-bold">
                        {supervisorTodaySummary.openEntry.servicio_nombre}
                      </span>
                    </div>
                    <div className="text-xs text-amber-800 mt-1">
                      Entrada:{" "}
                      <span className="font-bold">
                        {formatDateTime(supervisorTodaySummary.openEntry.hora).time}
                      </span>
                    </div>

                    <button
                      onClick={() => setScreen("supervisor")}
                      className="mt-3 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-2"
                    >
                      REGISTRAR SALIDA AHORA
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 mb-5">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <MapPinned className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Última actividad</span>
              </div>

              <div className="text-base font-extrabold text-slate-900 leading-tight">
                {supervisorSummaryLoading
                  ? "Cargando..."
                  : supervisorTodaySummary.lastItem?.servicio_nombre || "Sin actividad registrada"}
              </div>

              <div className="text-xs text-slate-500 mt-1">
                {supervisorSummaryLoading
                  ? "Obteniendo último movimiento..."
                  : supervisorTodaySummary.lastItem
                  ? `${String(supervisorSummaryTodayLabel(supervisorTodaySummary.lastItem.tipo))} • ${
                      formatDateTime(
                        supervisorSummaryTodayValue(supervisorTodaySummary.lastItem?.hora)
                      ).time
                    }`
                  : "Todavía no hay supervisiones registradas"}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4 mb-5">
          {isGuard && (
            <>
              <button
                onClick={() => setScreen("timeclock")}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opción</div>
                <div className="text-lg font-bold text-slate-900 mt-1">Control horario</div>
                <div className="text-xs text-slate-500 mt-1">Fichaje de entrada/salida</div>
              </button>

              <button
                onClick={() => setScreen("guard-history")}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opción</div>
                <div className="text-lg font-bold text-slate-900 mt-1">Historial</div>
                <div className="text-xs text-slate-500 mt-1">Últimos registros</div>
              </button>

              <button
                onClick={() => setScreen("unit-inspection")}
                className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition col-span-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase tracking-widest border border-amber-100">
                    Unidad
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulo</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">Inspección de unidad</div>
                  <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Revisión vehicular, incidencias, niveles y observaciones.
                  </div>
                </div>
              </button>
            </>
          )}

          {isSupervisor && (
            <>
              <button
                onClick={() => setScreen("supervisor")}
                className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition group hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#0dcaf2]/10 text-[#0dcaf2] flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-cyan-50 text-[#0dcaf2] text-[10px] font-extrabold uppercase tracking-widest border border-cyan-100">
                    Acción
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulo</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">Supervisión</div>
                  <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Registrar entrada, salida, novedades y evidencia del servicio.
                  </div>
                </div>
              </button>

              <button
                onClick={() => setScreen("supervisor-guards-history")}
                className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition group hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Eye className="w-5 h-5" />
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest border border-emerald-100">
                    Consulta
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consulta</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">Guardias</div>
                  <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Revisa entradas, salidas, evidencias y ubicaciones del personal.
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSupervisorHistoryFilter("all");
                  setScreen("supervisor-history");
                }}
                className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition group hover:shadow-md col-span-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase tracking-widest border border-slate-200">
                    Consulta
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulo</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">Historial</div>
                  <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Revisa supervisiones, evidencias y movimientos recientes.
                  </div>
                </div>
              </button>
            </>
          )}

          {!isGuard && !isSupervisor && (
            <button
              onClick={() => alert("Rol sin menú asignado todavía")}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition col-span-2"
            >
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opción</div>
              <div className="text-lg font-bold text-slate-900 mt-1">Panel disponible pronto</div>
              <div className="text-xs text-slate-500 mt-1">Estamos preparando el acceso para este rol</div>
            </button>
          )}
        </div>

        <div className={cn("mt-auto", isSupervisor && supervisorTodaySummary.hasOpenEntry ? "pt-8" : "pt-6")}>
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Sesión activa
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {guardName}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {userRole === "supervisor"
                    ? "Supervisor en turno"
                    : userRole === "admin"
                    ? "Administrador en turno"
                    : "Guardia en turno"}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-3 rounded-2xl bg-red-50 text-red-600 font-extrabold text-xs border border-red-100 active:scale-[0.99] transition"
              >
                SALIR
              </button>
            </div>
          </div>
        </div>

        {isSupervisor && supervisorTodaySummary.hasOpenEntry && supervisorTodaySummary.openEntry && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50">
            <div className="rounded-[1.75rem] bg-slate-900 text-white shadow-[0_18px_50px_rgba(15,23,42,0.35)] border border-slate-800 px-4 py-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center shrink-0">
                  <CircleAlert className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                    Acción pendiente
                  </div>

                  <div className="text-sm font-extrabold text-white mt-1 truncate">
                    Cerrar supervisión en {supervisorTodaySummary.openEntry.servicio_nombre}
                  </div>

                  <div className="text-xs text-slate-300 mt-1">
                    Entrada registrada a las{" "}
                    <span className="font-bold text-white">
                      {formatDateTime(supervisorTodaySummary.openEntry.hora).time}
                    </span>
                  </div>

                  <button
                    onClick={() => setScreen("supervisor")}
                    className="mt-3 w-full py-3.5 rounded-2xl bg-[#0dcaf2] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                  >
                    IR A REGISTRAR SALIDA
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div className="min-h-screen bg-slate-50" />;
}