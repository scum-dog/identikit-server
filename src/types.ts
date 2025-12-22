import { Country } from "./utils/constants";

export interface DatabaseQueryResult<T = unknown> {
  rows: T[];
  rowCount?: number;
}

export interface UserContext {
  user_id: string;
  username: string;
  platform: Platform;
}

export interface AssetTransform {
  asset_id: number;
  offset_x?: number;
  offset_y?: number;
  scale?: number;
  rotation?: number;
}

// CHARACTERS
export type Sex = "male" | "female" | "other";

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

export interface CharacterInfo {
  name: string;
  sex: Sex;
  date_of_birth: string;
  height_in: number;
  weight_lb: number;
  eye_color: EyeColor;
  hair_color: HairColor;
  race: Race[];
  ethnicity: Ethnicity;
  location: Country;
}

export interface CharacterStatic {
  head: { asset_id: number };
  hair: { asset_id: number };
  beard?: { asset_id: number };
  age_lines?: { asset_id: number };
}

export interface CharacterPlaceableMovable {
  eyes: Required<AssetTransform>;
  eyebrows: Required<AssetTransform>;
  nose: Pick<AssetTransform, "asset_id" | "offset_y" | "scale">;
  lips: Pick<AssetTransform, "asset_id" | "offset_y" | "scale">;
  glasses?: Pick<AssetTransform, "asset_id" | "offset_y" | "scale">;
  mustache?: Pick<AssetTransform, "asset_id" | "offset_y" | "scale">;
  misc?: AssetTransform & { offset_y: number };
}

export interface CharacterData {
  info: CharacterInfo;
  static: CharacterStatic;
  placeable_movable: CharacterPlaceableMovable;
}

export interface CharacterMetadata {
  id: string;
  user_id: string;
  created_at: string;
  last_edited_at: string | null;
  can_edit: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface CharacterBasicInfo {
  id: string;
  created_at: string;
  last_edited_at: string | null;
}

export interface Character extends CharacterMetadata {
  character_data: CharacterData;
}

export interface CharacterWithUser extends Character {
  username: string;
  platform: Platform;
  platform_user_id: string;
  user_created_at?: string;
  last_login?: string;
}

export interface PlazaQueryRequest {
  validatedQuery?: {
    country?: string;
    limit?: number;
    offset?: number;
  };
}

// AUTHENTICATION
export type Platform = "newgrounds" | "itch" | "google";

export interface PlatformUser {
  id: string;
  username: string;
  platform?: Platform;
  is_admin?: boolean;
}

interface BaseUser {
  id: string;
  platform: Platform;
  platform_user_id: string;
  username: string;
  is_admin: boolean;
}

export interface AuthUrlResult {
  authUrl: string;
  state: string;
  codeVerifier?: string;
  expiresAt: Date;
}

interface OAuthStateData {
  platform: Platform;
  codeVerifier?: string;
  redirectUri?: string;
}

export interface CallbackValidation {
  isValid: boolean;
  stateData?: OAuthStateData;
  error?: string;
}

export interface AuthenticatedUser<T extends PlatformUser> {
  sessionId: string;
  user: T;
}

export interface OAuthProvider<T extends PlatformUser> {
  platform: Platform;
  generateAuthUrl(pollId?: string): Promise<AuthUrlResult>;
  authenticateWithCode(
    code: string,
    state?: string,
    codeVerifier?: string,
  ): Promise<AuthenticatedUser<T>>;
  validateSession(sessionId: string): Promise<T | null>;
}

export interface User extends BaseUser {
  created_at: Date;
  last_login: Date;
}

export interface DatabaseSession extends User {
  session_id: string;
  user_id: string;
  platform_session_id?: string;
  created_at: Date;
  expires_at: Date;
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

export type CreateSessionData = Omit<
  SessionData,
  "id" | "createdAt" | "expiresAt"
>;

export interface GoogleOAuthParams extends Record<string, string> {
  client_id: string;
  redirect_uri: string;
  scope: "openid email";
  response_type: "code";
  state: string;
}

export interface GoogleOAuthResponse {
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

export interface ItchOAuthParams extends Record<string, string> {
  client_id: string;
  redirect_uri: string;
  scope: "profile:me";
  response_type: "token";
  state: string;
}

export interface ItchOAuthResponse {
  user: {
    id: number;
    username: string;
  };
}

export interface NewgroundsAuthRequest {
  session_id: string;
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

// REQUEST/RESPONSE
export type SearchParams = (string | number)[];

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
  characterData?: CharacterData;
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

export interface QueueResponse {
  message: string;
  jobId: string;
  status: string;
}

export interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ERROR HANDLING
export interface DatabaseConstraintError {
  code: string;
  constraint: string;
  detail: string;
  table: string;
}

export interface GenericError {
  error: string;
}

export interface UserFriendlyError extends GenericError {
  message: string;
  field?: string;
}

// ROUTE INTERFACES
export interface PlazaCharacter extends Pick<
  Character,
  "id" | "created_at" | "last_edited_at" | "character_data"
> {
  location: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlazaResponse {
  characters: PlazaCharacter[];
  count: number;
  total: number;
  filters: { country?: string };
}

export interface CharacterPageQuery {
  page?: string;
  limit?: string;
  showDeleted?: string;
}

export interface CharacterPageResponse {
  characters: CharacterWithUser[];
  pagination: Pagination;
}

export interface DeleteCharacterResponse extends QueueResponse {
  success: boolean;
  deletedCharacter: {
    id: string;
  };
  reason: string;
}

export interface AdminUsersQuery {
  page?: string;
  limit?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        platform: Platform;
        platformUserId: string;
        isAdmin: boolean;
      };
    }
  }
}
