import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { ValidationError } from "../shared/errors";

type Source = "body" | "query" | "params";

function flattenZodError(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (!fieldErrors[path]) fieldErrors[path] = [];
    fieldErrors[path].push(issue.message);
  }
  return fieldErrors;
}

export function validate<S extends ZodTypeAny>(
  schema: S,
  source: Source = "body",
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new ValidationError("Request validation failed", {
          source,
          fields: flattenZodError(result.error),
        }),
      );
      return;
    }
    (req as Request & { validated: Record<string, unknown> }).validated = {
      ...((req as Request & { validated?: Record<string, unknown> })
        .validated ?? {}),
      [source]: result.data,
    };
    next();
  };
}

export function validated<T>(
  req: Request,
  source: Source = "body",
  schema?: ZodTypeAny,
): T {
  if (schema) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new ValidationError("Request validation failed", {
        source,
        fields: flattenZodError(result.error),
      });
    }
    return result.data as T;
  }

  const bag = (req as Request & { validated?: Record<string, unknown> })
    .validated;
  return (bag?.[source] as T) ?? (req[source] as T);
}

export type Infer<S extends ZodTypeAny> = z.infer<S>;
