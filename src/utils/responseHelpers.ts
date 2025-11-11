import { Response } from "express";
import crypto from "crypto";
import { APIResponse, APIError } from "../types";

function generateETag(data: unknown): string {
  const content = JSON.stringify(data);
  return `"${crypto.createHash("md5").update(content).digest("hex")}"`;
}

export function successResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: APIResponse<T>["meta"],
  links?: APIResponse<T>["links"],
  enableETag: boolean = false,
): void {
  const response: APIResponse<T> = { data };

  if (meta) response.meta = meta;
  if (links) response.links = links;

  if (enableETag && statusCode === 200) {
    res.setHeader("ETag", generateETag(response));
  }

  res.status(statusCode).json(response);
}

export function createdResponse<T>(
  res: Response,
  data: T,
  location?: string,
): void {
  if (location) {
    res.setHeader("Location", location);
  }
  successResponse(res, data, 201);
}

export function acceptedResponse<T>(
  res: Response,
  data: T,
  location?: string,
): void {
  if (location) {
    res.setHeader("Location", location);
  }
  successResponse(res, data, 202);
}

export function collectionResponse<T>(
  res: Response,
  items: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  baseUrl: string,
): void {
  const links: APIResponse<T[]>["links"] = {
    self: `${baseUrl}?page=${pagination.page}&limit=${pagination.limit}`,
  };

  if (pagination.page > 1) {
    links.first = `${baseUrl}?page=1&limit=${pagination.limit}`;
    links.prev = `${baseUrl}?page=${pagination.page - 1}&limit=${pagination.limit}`;
  }

  if (pagination.page < pagination.totalPages) {
    links.next = `${baseUrl}?page=${pagination.page + 1}&limit=${pagination.limit}`;
    links.last = `${baseUrl}?page=${pagination.totalPages}&limit=${pagination.limit}`;
  }

  successResponse(res, items, 200, { pagination }, links);
}

export function errorResponse(
  res: Response,
  code: string,
  message: string,
  statusCode: number,
  details?: unknown,
): void {
  const response: APIError = {
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  res.status(statusCode).json(response);
}

export function notFoundResponse(res: Response, resource?: string): void {
  errorResponse(
    res,
    "RESOURCE_NOT_FOUND",
    resource ? `${resource} not found` : "Resource not found",
    404,
  );
}

export function conflictResponse(res: Response, message: string): void {
  errorResponse(res, "RESOURCE_CONFLICT", message, 409);
}

export function badRequestResponse(
  res: Response,
  message: string,
  details?: unknown,
): void {
  errorResponse(res, "BAD_REQUEST", message, 400, details);
}

export function unauthorizedResponse(res: Response, message?: string): void {
  errorResponse(res, "UNAUTHORIZED", message || "Authentication required", 401);
}

export function forbiddenResponse(res: Response, message?: string): void {
  errorResponse(res, "FORBIDDEN", message || "Insufficient permissions", 403);
}

export function internalServerErrorResponse(
  res: Response,
  message?: string,
): void {
  errorResponse(
    res,
    "INTERNAL_SERVER_ERROR",
    message || "Internal server error",
    500,
  );
}
