import { Request, Response, NextFunction } from "express";
import { supabase, supabaseAuth } from "./supabase";
import rateLimit from "express-rate-limit";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        user_metadata: Record<string, any>;
      };
    }
  }
}

export async function createAdminUser(email: string, password: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });
  if (error) throw error;
  return data.user;
}

export async function verifyToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  return data.user;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.substring(7);
  try {
    const user = await verifyToken(token);
    req.user = {
      id: user.id,
      email: user.email || "",
      role: user.user_metadata?.role || "customer",
      user_metadata: user.user_metadata || {},
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
}

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
