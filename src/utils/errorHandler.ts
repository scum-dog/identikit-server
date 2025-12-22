import { log } from "./logger";
import { DatabaseConstraintError, UserFriendlyError } from "../types";

export function isDatabaseConstraintError(
  error: unknown,
): error is DatabaseConstraintError {
  return Boolean(
    error &&
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as Record<string, unknown>).code === "23505" && // unique_violation
    "constraint" in error &&
    typeof (error as Record<string, unknown>).constraint === "string",
  );
}

export function handleDatabaseConstraintError(
  error: DatabaseConstraintError,
): UserFriendlyError {
  const { constraint, detail } = error;

  switch (constraint) {
    case "users_platform_platform_user_id_key":
      return {
        error: "account_exists",
        message:
          "An account with this profile already exists for this platform",
        field: "platform_user_id",
      };

    case "users_platform_username_key":
      return {
        error: "username_taken",
        message:
          "This username is already taken on this platform. Please choose a different username",
        field: "username",
      };

    case "characters_user_id_key":
      return {
        error: "character_exists",
        message:
          "You already have a character uploaded. Only one character per user is allowed",
        field: "user_id",
      };

    case "user_sessions_user_id_key":
      return {
        error: "session_exists",
        message: "You already have an active session. Please log out first",
        field: "user_id",
      };

    default:
      log.warn("Unknown database constraint violation", { constraint, detail });
      return {
        error: "database_constraint",
        message:
          "A database constraint was violated. Please check your input and try again",
      };
  }
}

export async function handleConstraints<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isDatabaseConstraintError(error)) {
      const friendlyError = handleDatabaseConstraintError(error);

      const constraintError = new Error(friendlyError.message) as Error & {
        isConstraintViolation: boolean;
        userFriendlyError: UserFriendlyError;
      };
      constraintError.isConstraintViolation = true;
      constraintError.userFriendlyError = friendlyError;
      throw constraintError;
    }

    throw error;
  }
}

export function getConstraintError(error: unknown): UserFriendlyError | null {
  if (
    error &&
    typeof error === "object" &&
    error !== null &&
    "isConstraintViolation" in error &&
    "userFriendlyError" in error
  ) {
    const constraintError = error as {
      isConstraintViolation: boolean;
      userFriendlyError: UserFriendlyError;
    };
    return constraintError.isConstraintViolation
      ? constraintError.userFriendlyError
      : null;
  }
  return null;
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return {
    success: false,
    error: code,
    message,
    ...(details && { details }),
  };
}
