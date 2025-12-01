import { Platform } from "../types";

export class AuthError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
