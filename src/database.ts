import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";
import {
  SearchParams,
  Character,
  User,
  CharacterData,
  Platform,
} from "./types";
import { log } from "./utils/logger";
import { THIRTY_SECONDS } from "./utils/constants";

dotenv.config({ quiet: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: THIRTY_SECONDS,
  connectionTimeoutMillis: 2000,
});

pool.on("connect", () => {
  log.info("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  log.error("Unexpected error on idle client:", { error: err });
  process.exit(-1);
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> => {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    log.error("Database query error:", { error });
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  return client;
};

export const userQueries = {
  findByPlatformId: async (
    platform: Platform,
    platformUserId: string,
  ): Promise<User | undefined> => {
    const result = await query<User>(
      "SELECT * FROM users WHERE platform = $1 AND platform_user_id = $2",
      [platform, platformUserId],
    );
    return result.rows[0];
  },

  create: async (
    platform: Platform,
    platformUserId: string,
    username: string,
  ): Promise<User> => {
    const result = await query<User>(
      `INSERT INTO users (platform, platform_user_id, username)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [platform, platformUserId, username],
    );
    return result.rows[0];
  },

  updateLastLogin: async (userId: string): Promise<void> => {
    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [userId]);
  },
};

export const characterQueries = {
  findByUserId: async (userId: string): Promise<Character | undefined> => {
    const result = await query<Character>(
      "SELECT * FROM characters WHERE user_id = $1 AND is_deleted = false",
      [userId],
    );
    return result.rows[0];
  },

  create: async (
    userId: string,
    characterData: CharacterData,
  ): Promise<Character> => {
    const result = await query<Character>(
      `INSERT INTO characters
       (user_id, character_data)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, characterData],
    );
    return result.rows[0];
  },

  update: async (
    characterId: string,
    userId: string,
    characterData: CharacterData,
  ): Promise<Character> => {
    const canEdit = await query<{ can_edit: boolean }>(
      "SELECT can_user_edit_character($1, $2) as can_edit",
      [characterId, userId],
    );

    if (!canEdit.rows[0].can_edit) {
      throw new Error("Cannot edit character: weekly limit exceeded");
    }

    const result = await query<Character>(
      `UPDATE characters
       SET character_data = $3, last_edited_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [characterId, userId, characterData],
    );

    if (result.rows.length === 0) {
      throw new Error("Character not found or not owned by user");
    }

    return result.rows[0];
  },

  getCharactersByAge: async (
    limit: number = 100,
    offset: number = 0,
  ): Promise<Character[]> => {
    const result = await query<Character>(
      "SELECT * FROM get_characters_by_age($1, $2)",
      [limit, offset],
    );
    return result.rows;
  },

  searchByLocation: async (
    country?: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<Character[]> => {
    let whereClause = "WHERE is_deleted = false";
    const params: SearchParams = [];
    let paramCount = 0;

    if (country) {
      paramCount++;
      whereClause += ` AND character_data -> 'info' ->> 'location' ILIKE $${paramCount}`;
      params.push(`%${country}%`);
    }

    paramCount++;
    const query_text = `
      SELECT id, character_data, created_at, last_edited_at
      FROM characters
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await query<Character>(query_text, params);
    return result.rows;
  },

  getTotalCount: async (country?: string): Promise<number> => {
    let whereClause = "WHERE is_deleted = false";
    const params: SearchParams = [];
    let paramCount = 0;

    if (country) {
      paramCount++;
      whereClause += ` AND character_data -> 'info' ->> 'location' ILIKE $${paramCount}`;
      params.push(`%${country}%`);
    }

    const query_text = `
      SELECT COUNT(*) as total_count
      FROM characters
      ${whereClause}
    `;

    const result = await query<{ total_count: string }>(query_text, params);
    return parseInt(result.rows[0].total_count, 10);
  },

  adminDelete: async (
    characterId: string,
    adminUserId: string,
  ): Promise<void> => {
    await query(
      "UPDATE characters SET is_deleted = true, deleted_at = NOW(), deleted_by = $2 WHERE id = $1",
      [characterId, adminUserId],
    );
  },
};

export const oauthStateQueries = {
  create: async (
    state: string,
    platform: Platform,
    expiresAt: Date,
  ): Promise<void> => {
    await query(
      "INSERT INTO oauth_states (state, platform, expires_at) VALUES ($1, $2, $3)",
      [state, platform, expiresAt],
    );
  },

  validate: async (
    state: string,
    platform: Platform,
  ): Promise<{ state: string; expires_at: Date } | null> => {
    const result = await query<{ state: string; expires_at: Date }>(
      "SELECT state, expires_at FROM oauth_states WHERE state = $1 AND platform = $2",
      [state, platform],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const stateData = result.rows[0];
    const now = new Date();

    if (now > stateData.expires_at) {
      await query("DELETE FROM oauth_states WHERE state = $1", [state]);
      return null;
    }

    return stateData;
  },

  delete: async (state: string): Promise<void> => {
    await query("DELETE FROM oauth_states WHERE state = $1", [state]);
  },

  cleanup: async (): Promise<number> => {
    const result = await query<{ cleanup_expired_oauth_states: number }>(
      "SELECT cleanup_expired_oauth_states()",
    );
    return result.rows[0].cleanup_expired_oauth_states;
  },
};

export default pool;
