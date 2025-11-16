import { Response } from "express";
import { APIError } from "../types";

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
