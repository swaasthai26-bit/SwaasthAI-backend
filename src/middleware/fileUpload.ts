import fs from "fs/promises";
import path from "path";
import type { Request, RequestHandler } from "express";
import { AppError, ValidationError } from "../shared/errors";

const { formidable } = require("formidable");

type FileLike = {
  filepath: string;
  originalFilename?: string;
  mimetype?: string;
  size?: number;
};

type UploadOptions = {
  fileField: string;
  targetField: string;
  multiple?: boolean;
  minFiles?: number;
  maxFiles?: number;
  minFilesMessage?: string;
  optionalIfAbsent?: boolean;
  asPhotoObjects?: boolean;
  jsonFields?: string[];
  numberFields?: string[];
  booleanFields?: string[];
  getBaseName: (req: Request) => Promise<string> | string;
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const PUBLIC_BASE_URL_ENV_KEYS = ["PUBLIC_BASE_URL", "APP_BASE_URL", "BASE_URL"];

export function multipartImageUpload(options: UploadOptions): RequestHandler {
  return async (req, _res, next) => {
    if (!req.is("multipart/form-data")) {
      // If optionalIfAbsent is true, allow requests without form-data
      if (options.optionalIfAbsent) {
        next();
        return;
      }
      // Otherwise, require minFiles if specified
      if ((options.minFiles ?? 0) > 0) {
        next(
          new AppError(
            500,
            "UPLOAD_REQUIRED",
            options.minFilesMessage ??
              `Upload at least ${options.minFiles} image`,
          ),
        );
        return;
      }
      next();
      return;
    }

    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const { fields, files, attemptedFileFields } = await parseMultipart(req);
      req.body = normalizeFields(fields, options);

      const uploadedFiles = getFiles(files, options.fileField);

      // Only validate minFiles if:
      // 1. File field is present in the request, OR
      // 2. optionalIfAbsent is not set (default behavior: required)
      const fieldWasAttempted =
        options.fileField in files || attemptedFileFields.has(options.fileField);
      const shouldValidateMinFiles =
        !options.optionalIfAbsent || fieldWasAttempted;

      if (
        shouldValidateMinFiles &&
        (options.minFiles ?? 0) > 0 &&
        uploadedFiles.length < options.minFiles!
      ) {
        throw new AppError(
          500,
          "UPLOAD_REQUIRED",
          options.minFilesMessage ??
            `Upload at least ${options.minFiles} image`,
        );
      }
      if (options.maxFiles && uploadedFiles.length > options.maxFiles) {
        throw new AppError(
          500,
          "UPLOAD_LIMIT_EXCEEDED",
          `You can upload maximum ${options.maxFiles} image${options.maxFiles === 1 ? "" : "s"}`,
        );
      }
      if (uploadedFiles.length > 0) {
        if (!options.multiple && uploadedFiles.length > 1) {
          throw new ValidationError(
            `Only one ${options.fileField} file is allowed`,
          );
        }

        const baseName = sanitizeName(await options.getBaseName(req));
        const urls = await Promise.all(
          uploadedFiles.map((file, index) =>
            saveImage(
              req,
              file,
              baseName,
              options.multiple ? index + 1 : undefined,
            ),
          ),
        );

        req.body[options.targetField] = options.asPhotoObjects
          ? urls.map((url, index) => ({ url, order: index }))
          : options.multiple
            ? urls
            : urls[0];
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function parseMultipart(
  req: Request,
): Promise<{ fields: any; files: any; attemptedFileFields: Set<string> }> {
  const attemptedFileFields = new Set<string>();
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.on("fileBegin", (name: string) => {
      attemptedFileFields.add(name);
    });

    form.parse(req, (error: Error | null, fields: any, files: any) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files, attemptedFileFields });
    });
  });
}

function normalizeFields(
  fields: any,
  options: UploadOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined) continue;
    body[key] = normalizeFieldValue(String(raw), key, options);
  }
  return body;
}

function normalizeFieldValue(
  value: string,
  key: string,
  options: UploadOptions,
): unknown {
  if (options.jsonFields?.includes(key)) {
    return JSON.parse(value);
  }
  if (options.numberFields?.includes(key)) {
    return Number(value);
  }
  if (options.booleanFields?.includes(key)) {
    return value === "true";
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function getFiles(files: any, field: string): FileLike[] {
  const value = files[field];
  if (!value) return [];
  const fileList = Array.isArray(value) ? value : [value];
  return fileList.filter(hasSelectedFile);
}

function hasSelectedFile(file: FileLike): boolean {
  return Boolean(
    file.filepath &&
      file.originalFilename &&
      file.originalFilename.trim().length > 0,
  );
}

async function saveImage(
  req: Request,
  file: FileLike,
  baseName: string,
  index?: number,
): Promise<string> {
  if (!file.mimetype?.startsWith("image/")) {
    throw new ValidationError("Only image files are allowed");
  }

  const ext = path.extname(file.originalFilename ?? "").toLowerCase() || ".jpg";
  const timestamp = formatTimestamp(new Date());
  const filename = `${baseName}-${timestamp}${index ? `-${index}` : ""}${ext}`;
  const destination = path.join(UPLOAD_DIR, filename);

  try {
    // Try atomic rename first (same drive)
    await fs.rename(file.filepath, destination);
  } catch (error: any) {
    // If rename fails with EXDEV (cross-device), use copy + delete
    if (error.code === "EXDEV") {
      await fs.copyFile(file.filepath, destination);
      await fs.unlink(file.filepath);
    } else {
      throw error;
    }
  }

  return `${getPublicBaseUrl(req)}/uploads/${filename}`;
}

function getPublicBaseUrl(req: Request): string {
  const configuredBaseUrl = PUBLIC_BASE_URL_ENV_KEYS.map((key) =>
    process.env[key]?.trim(),
  ).find(Boolean);

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const forwardedProto = firstHeaderValue(req.get("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(req.get("x-forwarded-host"));
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return `${req.protocol}://${req.get("host")}`;
}

function firstHeaderValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim();
}

function sanitizeName(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "image";
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}
