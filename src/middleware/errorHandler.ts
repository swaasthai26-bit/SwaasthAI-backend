import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";
import { ZodError } from "zod";
import { AppError, AuthError, ValidationError } from "../shared/errors";

function firstFieldMessage(fields: unknown): string | undefined {
  if (!fields || typeof fields !== "object") return undefined;
  for (const [field, messages] of Object.entries(fields)) {
    if (Array.isArray(messages) && typeof messages[0] === "string") {
      const msg = messages[0];
      // Skip field prefix if it's a root-level error or message is already a full sentence
      if (field === "_" || /^[A-Z].*\s(must|cannot|should|is required|already)/.test(msg)) {
        return msg;
      }
      return `${field}: ${msg}`;
    }
  }
  return undefined;
}

function validationMessage(details: unknown, fallback: string): string {
  if (!details || typeof details !== "object") return fallback;
  return (
    firstFieldMessage((details as { fields?: unknown }).fields) ?? fallback
  );
}

export const notFoundHandler = (
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  res.status(404).json({
    status: false,
    message: "Route not found",
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      status: false,
      message:
        err instanceof ValidationError
          ? validationMessage(err.details, err.message)
          : err.message,
      ...(err.code && err.code !== "APP_ERROR" ? { code: err.code } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".") || "_";
      if (!fields[path]) fields[path] = [];
      fields[path].push(issue.message);
    }
    const wrapped = new ValidationError("Request validation failed", { fields });
    res.status(400).json({
      status: false,
      message: validationMessage(wrapped.details, wrapped.message),
    });
    return;
  }

  if (err?.name === "CastError") {
    res.status(500).json({
      status: false,
      message: "Invalid identifier format",
    });
    return;
  }

  // MongoDB duplicate key error
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? "field";
    const fieldLabel = field === "phone" ? "Phone number" : field === "email" ? "Email" : field;
    res.status(409).json({
      status: false,
      message: `${fieldLabel} is already registered`,
      code: "DUPLICATE_KEY",
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    status: false,
    message: "Something went wrong. Please try again.",
  });
};
