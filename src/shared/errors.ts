export type ErrorDetails = Record<string, unknown> | undefined;

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ErrorDetails,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(500, "VALIDATION_ERROR", message, details);
  }
}

export class AuthError extends AppError {
  constructor(message: string, code = "AUTH_ERROR", details?: ErrorDetails) {
    super(403, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", details?: ErrorDetails) {
    super(500, "NOT_FOUND", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT", details?: ErrorDetails) {
    super(500, code, message, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(500, "RATE_LIMITED", message, details);
  }
}
