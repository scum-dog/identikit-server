import { Request } from "express";
import { ParsedQs } from "qs";

export interface DatabaseQueryResult<T = unknown> {
  rows: T[];
  rowCount?: number;
}

export interface CharacterCreateData {
  name: string;
  heightCm?: number;
  weightKg?: number;
  sex?: string;
  country?: string;
  region?: string;
  city?: string;
  characterJson: object;
}

export interface CharacterUpdateData {
  name?: string;
  heightCm?: number;
  weightKg?: number;
  sex?: string;
  country?: string;
  region?: string;
  city?: string;
  characterJson?: object;
}

export interface DatabaseCharacter {
  id: string;
  user_id: string;
  name: string;
  height_cm: number;
  weight_kg: number;
  sex: string;
  country: string;
  region: string;
  city: string;
  character_data: string | object;
  created_at: string;
  last_edited_at: string;
  edit_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface CanEditResult {
  can_edit: boolean;
}

export interface CharacterRouteUpdates {
  name?: string;
  country?: string;
  region?: string;
  city?: string;
  characterJson?: object;
  heightCm?: number;
  weightKg?: number;
  sex?: string;
}

export interface PlazaQueryRequest {
  validatedQuery?: {
    country?: string;
    region?: string;
    limit?: number;
  };
}

export interface PlazaCharacterData {
  id: string;
  name: string;
  created_at: string;
  last_edited_at: string;
  country: string;
  region: string;
  city: string;
  sex: string;
  character_data: string | object;
}

export interface MockCharacterRouteUpdates {
  creator_name?: string;
  location?: {
    country: string | null;
    region: string | null | undefined;
    city: string | null | undefined;
  };
  character_data?: object;
}

export type AccessoryType =
  | "glasses"
  | "hat"
  | "earrings"
  | "mustache"
  | "beard"
  | "piercing"
  | "scar"
  | "tattoo"
  | "makeup";

export type SkinColor =
  | "pale"
  | "light"
  | "medium"
  | "medium-tan"
  | "tan"
  | "dark"
  | "very-dark";

export type EyeColor =
  | "brown"
  | "blue"
  | "green"
  | "hazel"
  | "gray"
  | "amber"
  | "violet";

export type HairColor =
  | "black"
  | "brown"
  | "blonde"
  | "red"
  | "gray"
  | "white"
  | "blue"
  | "green"
  | "purple"
  | "pink";

export type Sex = "male" | "female" | "other";

export interface MockUser {
  id: string;
  username: string;
  platform: string;
  platform_user_id: string;
  email: string;
  created_at: string;
  last_login: string;
  is_admin: boolean;
}

export interface MockCharacter {
  id?: string; // alias for upload_id
  upload_id: string;
  user_id: string;
  creator_name: string;
  created_at: string;
  creation_time?: string; // alias for created_at
  last_edited_at: string;
  edit_time?: string; // alias for last_edited_at
  location: {
    country: string | null;
    region: string | null | undefined;
    city: string | null | undefined;
  };
  country?: string | null; // alias for location.country
  character_data: object;
  edit_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface MockEditHistory {
  id: string;
  character_id: string;
  user_id: string | null;
  changes: {
    fields_changed: string[];
    old_values: object;
    new_values: object;
  };
  edited_at: string;
  editor_username: string | null;
}

export interface QueryValidationRequest extends Request {
  query: ParsedQs;
}

export interface PlazaValidationRequest extends Request {
  validatedQuery: unknown;
}

export type SearchParams = (string | number)[];

export interface PlatformUser {
  id: number | string;
  username: string;
  platform?: string;
  is_admin?: boolean;
  [key: string]: unknown;
}

export interface AuthResult {
  user: {
    id: string;
    username: string;
    platform: string;
    isAdmin: boolean;
  };
  sessionId: string;
  tokenType: "Bearer";
  message: string;
}

export interface AuthUrlResult {
  authUrl: string;
  state: string;
  codeVerifier?: string; // for PKCE (google)
  expiresAt: Date;
}

export interface CallbackValidation {
  isValid: boolean;
  stateData?: {
    platform: Platform;
    codeVerifier?: string;
    redirectUri?: string;
  };
  error?: string;
}

export type Platform = "newgrounds" | "itchio" | "google";

export interface OAuthProvider<T extends PlatformUser> {
  platform: Platform;
  generateAuthUrl(): AuthUrlResult;
  authenticateWithCode(
    code: string,
    state?: string,
    codeVerifier?: string,
  ): Promise<{ sessionId: string; user: T }>;
  validateSession(sessionId: string): Promise<T | null>;
}

export interface SessionData {
  id: string;
  userId: string;
  platform: Platform;
  platformUserId: string;
  platformSessionId?: string;
  username: string;
  isAdmin: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateSessionData {
  userId: string;
  platform: Platform;
  platformUserId: string;
  platformSessionId?: string;
  username: string;
  isAdmin: boolean;
}

export interface GoogleUser extends PlatformUser {
  id: string;
  username: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

export interface GoogleAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface GoogleUserInfoResponse {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  locale?: string;
}

export interface ItchUser extends PlatformUser {
  id: number;
  username: string;
  display_name?: string;
  cover_url?: string;
  url: string;
}

export interface ItchAuthResponse {
  user: ItchUser;
}

export interface NewgroundsUser extends PlatformUser {
  id: number;
  name: string;
  supporter: boolean;
}

export interface NewgroundsGatewayRequest {
  app_id: string;
  session_id?: string;
  execute: {
    component: string;
    parameters?: Record<string, unknown>;
  };
}

export interface NewgroundsGatewayResponse {
  success: boolean;
  result?: {
    component?: string;
    data?: {
      success?: boolean;
      session?: NewgroundsSession;
      user?: NewgroundsUser;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface NewgroundsSession {
  id: string;
  user?: NewgroundsUser;
  expired: boolean;
  remember: boolean;
  passport_url?: string;
}

export interface NewgroundsAuthRequest {
  session_id: string;
}

export interface CharacterInfo {
  id: string;
  name: string;
  created_at: string;
  last_edited_at: string;
  edit_count: number;
}

export interface PlazaCharacterResult {
  id: string;
  name: string;
  character_data: string | object;
  country: string;
  region: string;
  city: string;
  sex: string;
  created_at: string;
  last_edited_at: string;
}

export interface AdminCharacterListResult {
  id: string;
  name: string;
  country: string;
  region: string;
  city: string;
  created_at: string;
  last_edited_at: string;
  edit_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  username: string;
  platform: string;
  platform_user_id: string;
}

export interface AdminCharacterDetailResult {
  id: string;
  user_id: string;
  name: string;
  height_cm: number;
  weight_kg: number;
  country: string;
  region: string;
  city: string;
  character_data: string | object;
  created_at: string;
  last_edited_at: string;
  edit_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  username: string;
  platform: string;
  platform_user_id: string;
  email: string;
  user_created_at: string;
  last_login: string;
}

export interface AdminEditHistoryResult {
  id: string;
  character_id: string;
  user_id: string | null;
  changes: object;
  edited_at: string;
  editor_username: string | null;
}

export interface AdminCharacterSimpleResult {
  id: string;
  name: string;
  user_id: string;
  is_deleted: boolean;
}

export interface AdminUserListResult {
  id: string;
  username: string;
  platform: string;
  platform_user_id: string;
  created_at: string;
  last_login: string;
  is_admin: boolean;
  character_count: number;
}

export interface DatabaseUser {
  id: string;
  platform: string;
  platform_user_id: string;
  username: string;
  email: string;
  created_at: string;
  last_login: string;
  is_admin: boolean;
}

export interface DatabaseSession {
  session_id: string;
  user_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_session_id?: string;
  username: string;
  is_admin: boolean;
  created_at: Date;
  expires_at: Date;
}

export interface ItchOAuthParams extends Record<string, string> {
  client_id: string;
  scope: "profile:me";
  redirect_uri: string;
  response_type: "token";
  state: string;
}

export interface GoogleOAuthParams extends Record<string, string> {
  client_id: string;
  redirect_uri: string;
  scope: "openid email profile";
  response_type: "code";
  state: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        platform: string;
        platformUserId: string;
        isAdmin: boolean;
      };
    }
  }
}
