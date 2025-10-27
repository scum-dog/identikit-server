import { randomUUID } from "crypto";
import { Platform, DatabaseUser } from "../types";

export interface MockUserOptions {
  id?: string;
  username?: string;
  platform?: Platform;
  platform_user_id?: string;
  is_admin?: boolean;
  created_at?: string;
  last_login?: string;
}

export function createMockUser(options: MockUserOptions = {}): DatabaseUser {
  return {
    id: options.id || randomUUID(),
    platform: options.platform || "newgrounds",
    platform_user_id: options.platform_user_id || "ng_12345",
    username: options.username || "testuser",
    is_admin: options.is_admin || false,
    created_at: options.created_at || new Date("2024-01-01").toISOString(),
    last_login: options.last_login || new Date().toISOString(),
  };
}

export const mockRouteUser = createMockUser({
  username: "TestUser123",
});

export const mockRouteAdmin = createMockUser({
  username: "AdminUser",
  is_admin: true,
});

export function canUserEditCharacter(
  createdAt: string,
  lastEditedAt: string | null,
): boolean {
  const creationDate = new Date(createdAt);
  const lastEditDate = lastEditedAt ? new Date(lastEditedAt) : creationDate;
  const now = new Date();

  const daysSinceCreation =
    (now.getTime() - creationDate.getTime()) / (1000 * 3600 * 24);

  const daysSinceLastEdit =
    (now.getTime() - lastEditDate.getTime()) / (1000 * 3600 * 24);

  if (daysSinceCreation < 30) {
    return false;
  }

  if (daysSinceLastEdit < 7) {
    return false;
  }

  return true;
}

export function getISOString(date?: Date): string {
  return (date || new Date()).toISOString();
}

export function getDaysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.abs((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidDateString(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.toISOString() === dateStr;
}
