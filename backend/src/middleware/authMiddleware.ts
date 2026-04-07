import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "cambia_esto";

export type AuthRequest = Request & {
  user?: { id: number; email: string; role: string };
};

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    const payload = jwt.verify(token, JWT_SECRET) as any;

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role || "guard",
    };

    next();
  } catch (_err) {
    return res.status(401).json({ success: false, error: "Token inválido" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const currentRole = req.user?.role || "";

    if (!currentRole || !roles.includes(currentRole)) {
      return res.status(403).json({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
    }

    next();
  };
}