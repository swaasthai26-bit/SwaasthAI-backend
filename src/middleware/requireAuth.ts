import type { NextFunction, Request, Response } from "express";
import { AuthError, ForbiddenError } from "../shared/errors";
import { verifyAccessToken, type AccessTokenClaims } from "../modules/auth/jwt";
import type { UserRole } from "../modules/users/user.interface";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: UserRole };
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    next(new AuthError("Missing or malformed Authorization header", "AUTH_REQUIRED"));
    return;
  }
  const token = header.slice("bearer ".length).trim();
  if (!token) {
    next(new AuthError("Missing access token", "AUTH_REQUIRED"));
    return;
  }
  try {
    const claims: AccessTokenClaims = verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth: silently populates req.user if a valid Bearer token is present.
 * Never fails — unauthenticated requests proceed without req.user.
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const header = req.header("authorization") ?? req.header("Authorization");
    if (header && header.toLowerCase().startsWith("bearer ")) {
      const token = header.slice("bearer ".length).trim();
      if (token) {
        const claims: AccessTokenClaims = verifyAccessToken(token);
        req.user = { id: claims.sub, role: claims.role };
      }
    }
  } catch {
    // Invalid token — just ignore, treat as unauthenticated
  }
  next();
}

export function requireRole(...allowed: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthError("Authentication required", "AUTH_REQUIRED"));
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }
    next();
  };
}
