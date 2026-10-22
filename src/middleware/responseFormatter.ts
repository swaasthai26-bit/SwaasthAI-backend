import type { NextFunction, Request, Response } from "express";

const IMAGE_FIELD_PATTERN = /(?:image|photo|logo).*url$/i;

function successMessage(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "Data fetched successfully";
    case "POST":
      return "Data inserted successfully";
    case "PUT":
    case "PATCH":
      return "Data updated successfully";
    case "DELETE":
      return "Data deleted successfully";
    default:
      return "Operation completed successfully";
  }
}

function shouldOmitEmptyData(req: Request): boolean {
  return req.method === "POST" && /\/otp\/send\/?$/.test(req.path);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNormalizableObject(
  value: unknown,
): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFormattedResponse(body: unknown): boolean {
  if (!isPlainObject(body)) return false;
  const keys = Object.keys(body);
  return (
    typeof body.status === "boolean" &&
    typeof body.message === "string" &&
    keys.every((key) => key === "status" || key === "message" || key === "data")
  );
}

function payloadWithoutEnvelopeFields(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const isEnvelopeStatus = key === "status" && typeof value === "boolean";
    if (
      !isEnvelopeStatus &&
      key !== "success" &&
      key !== "message" &&
      key !== "code"
    ) {
      payload[key] = value;
    }
  }
  return payload;
}

function formatSuccessBody(
  body: unknown,
  method: string,
  omitEmptyData: boolean,
): Record<string, unknown> {
  if (isFormattedResponse(body)) {
    return normalizeFormattedBody(body as Record<string, unknown>);
  }

  const response: Record<string, unknown> = {
    status: true,
    message: successMessage(method),
  };

  if (body === undefined || body === null || body === "") {
    if (!omitEmptyData) response.data = null;
    return response;
  }

  if (!isPlainObject(body)) {
    response.data = normalizeImageFields(body);
    return response;
  }

  if (typeof body.message === "string" && body.message.trim()) {
    response.message = body.message;
  }

  const payload = payloadWithoutEnvelopeFields(body);
  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length === 1 && payloadKeys[0] === "data") {
    response.data = normalizeImageFields(payload.data);
  } else if (payloadKeys.length > 0) {
    response.data = normalizeImageFields(payload);
  }

  return response;
}

function normalizeFormattedBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (!("data" in body)) return body;
  return {
    ...body,
    data: normalizeImageFields(body.data),
  };
}

function normalizeImageFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeImageFields(item));
  }

  if (hasCustomToJson(value)) {
    return normalizeImageFields(value.toJSON());
  }

  if (!isNormalizableObject(value)) return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue === undefined && IMAGE_FIELD_PATTERN.test(key)) {
      normalized[key] = null;
      continue;
    }
    normalized[key] = normalizeImageFields(fieldValue);
  }

  return normalized;
}

function hasCustomToJson(
  value: unknown,
): value is { toJSON: () => unknown } {
  if (!isPlainObject(value)) return false;
  if (isNormalizableObject(value)) return false;
  return typeof (value as { toJSON?: unknown }).toJSON === "function";
}

export function responseFormatter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const originalJson = res.json.bind(res);
  const omitEmptyData = shouldOmitEmptyData(req);

  res.json = ((body?: unknown) => {
    if (res.headersSent) return res as any;
    if (!res.statusCode || res.statusCode === 200) res.status(200);
    // Don't format error responses (4xx/5xx) — error handler already formatted them
    if (res.statusCode >= 400) return originalJson(body);
    return originalJson(formatSuccessBody(body, req.method, omitEmptyData));
  }) as Response["json"];

  next();
}
