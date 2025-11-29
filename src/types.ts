import { Request } from "express";
import { ParsedQs } from "qs";

export interface DatabaseQueryResult<T = unknown> {
  rows: T[];
  rowCount?: number;
}

export interface CharacterCreateData {
  character_data: object;
  characterJson?: object;
}

export interface CharacterUpdateData {
  character_data?: object;
  characterJson?: object;
}

export interface DatabaseCharacter {
  id: string;
  user_id: string;
  character_data: string | CharacterDataStructure;
  created_at: string;
  last_edited_at: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface CharacterMetadata {
  upload_id: string;
  user_id: string;
  created_at: string;
  last_edited_at: string | null;
  is_edited: boolean;
  can_edit: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface CharacterPersonalInfo {
  name: string;
  sex: Sex;
  date_of_birth: string;
  height_in: number;
  weight_lb: number;
  eye_color: EyeColor;
  hair_color: HairColor;
  race: Race[];
  ethnicity: Ethnicity;
  location: string;
}

export interface CharacterStatic {
  head: {
    asset_id: number;
  };
  hair: {
    asset_id: number;
  };
  beard?: {
    asset_id: number;
  };
  age_lines?: {
    asset_id: number;
  };
}

export interface CharacterPlaceableMovable {
  eyes: {
    asset_id: number;
    offset_x: number;
    offset_y: number;
    scale: number;
    rotation: number;
  };
  eyebrows: {
    asset_id: number;
    offset_x: number;
    offset_y: number;
    scale: number;
    rotation: number;
  };
  nose: {
    asset_id: number;
    offset_y: number;
    scale: number;
  };
  lips: {
    asset_id: number;
    offset_y: number;
    scale: number;
  };
  glasses?: {
    asset_id: number;
    offset_y: number;
    scale: number;
  };
  mustache?: {
    asset_id: number;
    offset_y: number;
    scale: number;
  };
  misc?: {
    asset_id: number;
    offset_x?: number;
    offset_y: number;
    scale?: number;
  };
}

export interface CharacterDataStructure {
  info: CharacterPersonalInfo;
  static: CharacterStatic;
  placeable_movable: CharacterPlaceableMovable;
}

export interface FullCharacterData {
  character_data: CharacterDataStructure;
  metadata: CharacterMetadata;
}

export interface PlazaQueryRequest {
  validatedQuery?: {
    country?: string;
    limit?: number;
  };
}

export interface PlazaCharacterData {
  id: string;
  created_at: string;
  last_edited_at: string | null;
  character_data: string | CharacterDataStructure;
}

export type Race = "ai_an" | "asian" | "black" | "nh_pi" | "white" | "other";

export type Ethnicity = "hispanic_latino" | "not_hispanic_latino";

export type EyeColor =
  | "black"
  | "blue"
  | "brown"
  | "gray"
  | "green"
  | "hazel"
  | "maroon"
  | "pink";

export type HairColor =
  | "bald"
  | "black"
  | "blond"
  | "brown"
  | "gray"
  | "red"
  | "sandy"
  | "white";

export type Sex = "male" | "female" | "other";

export interface QueryValidationRequest extends Request {
  query: ParsedQs;
}

export interface PlazaValidationRequest extends Request {
  validatedQuery: unknown;
}

export type SearchParams = (string | number)[];

export interface PlatformUser {
  id: string;
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

export type Platform = "newgrounds" | "itch" | "google";

export interface OAuthProvider<T extends PlatformUser> {
  platform: Platform;
  generateAuthUrl(pollId?: string): Promise<AuthUrlResult>;
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

export interface DatabaseUser {
  id: string;
  platform: Platform;
  platform_user_id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  last_login: string;
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

export interface GoogleAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface GoogleUserInfoResponse {
  id: string;
  email: string;
}

export interface ItchAuthResponse {
  user: {
    id: number;
    username: string;
  };
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
      user?: PlatformUser;
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
  user?: {
    id: number;
    name: string;
  };
  expired: boolean;
  remember: boolean;
  passport_url?: string;
}

export interface NewgroundsAuthRequest {
  session_id: string;
}

export interface CharacterInfo {
  id: string;
  created_at: string;
  last_edited_at: string;
  is_edited: boolean;
}

export interface PlazaCharacterResult {
  id: string;
  character_data: string | object;
  created_at: string;
  last_edited_at: string | null;
}

export interface AdminCharacter {
  id: string;
  user_id: string;
  character_data: string | CharacterDataStructure;
  created_at: string;
  last_edited_at: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  platform: string;
  platform_user_id: string;
  created_at: string;
  last_login: string;
  is_admin: boolean;
}

export interface AdminCharacterWithUser extends AdminCharacter {
  username: string;
  platform: string;
  platform_user_id: string;
  user_created_at?: string;
  last_login?: string;
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
  scope: "openid email";
  response_type: "code";
  state: string;
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export interface CharacterProcessingJobData {
  userId: string;
  characterId?: string;
  action: "create" | "update" | "delete";
  characterData?: object;
  metadata?: {
    adminUserId?: string;
    reason?: string;
    userAgent?: string;
    ipAddress?: string;
    timestamp?: Date;
  };
}

export interface QueueJob {
  id: string;
  data: CharacterProcessingJobData;
  priority: JobPriority;
}

export interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
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
