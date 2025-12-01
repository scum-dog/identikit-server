import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";
import {
  CharacterCreateData,
  CharacterUpdateData,
  SearchParams,
  DatabaseCharacter,
  DatabaseUser,
  PlazaCharacterResult,
} from "./types";
import { log } from "./utils/logger";

dotenv.config({ quiet: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30 * 1000,
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
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    log.debug("Executed query", { text, duration, rows: res.rowCount });
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
  findByPlatformId: async (platform: string, platformUserId: string) => {
    const result = await query<DatabaseUser>(
      "SELECT * FROM users WHERE platform = $1 AND platform_user_id = $2",
      [platform, platformUserId],
    );
    return result.rows[0];
  },

  create: async (
    platform: string,
    platformUserId: string,
    username: string,
  ) => {
    const result = await query<DatabaseUser>(
      `INSERT INTO users (platform, platform_user_id, username)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [platform, platformUserId, username],
    );
    return result.rows[0];
  },

  updateLastLogin: async (userId: string) => {
    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [userId]);
  },
};

export const characterQueries = {
  findByUserId: async (userId: string) => {
    const result = await query<DatabaseCharacter>(
      "SELECT * FROM characters WHERE user_id = $1 AND is_deleted = false",
      [userId],
    );
    return result.rows[0];
  },

  create: async (userId: string, characterData: CharacterCreateData) => {
    const { character_data, characterJson } = characterData;
    const fullCharacterData = character_data || characterJson;

    const result = await query<DatabaseCharacter>(
      `INSERT INTO characters
       (user_id, character_data)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, JSON.stringify(fullCharacterData)],
    );
    return result.rows[0];
  },

  update: async (
    characterId: string,
    userId: string,
    updates: CharacterUpdateData,
  ) => {
    const canEdit = await query<{ can_edit: boolean }>(
      "SELECT can_user_edit_character($1, $2) as can_edit",
      [characterId, userId],
    );

    if (!canEdit.rows[0].can_edit) {
      throw new Error("Cannot edit character: weekly limit exceeded");
    }

    const { characterJson } = updates;
    const result = await query<DatabaseCharacter>(
      `UPDATE characters
       SET character_data = $3, last_edited_at = NOW(), is_edited = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [characterId, userId, JSON.stringify(characterJson)],
    );

    if (result.rows.length === 0) {
      throw new Error("Character not found or not owned by user");
    }

    return result.rows[0];
  },

  getCharactersByAge: async (limit: number = 100, offset: number = 0) => {
    const result = await query<PlazaCharacterResult>(
      "SELECT * FROM get_characters_by_age($1, $2)",
      [limit, offset],
    );
    return result.rows;
  },

  searchByLocation: async (
    country?: string,
    limit: number = 100,
    offset: number = 0,
  ) => {
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

    const result = await query<PlazaCharacterResult>(query_text, params);
    return result.rows;
  },

  getTotalCount: async (country?: string) => {
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

  adminDelete: async (characterId: string, adminUserId: string) => {
    await query(
      "UPDATE characters SET is_deleted = true, deleted_at = NOW(), deleted_by = $2 WHERE id = $1",
      [characterId, adminUserId],
    );
  },
};

export const oauthStateQueries = {
  create: async (state: string, platform: string, expiresAt: Date) => {
    await query(
      "INSERT INTO oauth_states (state, platform, expires_at) VALUES ($1, $2, $3)",
      [state, platform, expiresAt],
    );
  },

  validate: async (state: string, platform: string) => {
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

  delete: async (state: string) => {
    await query("DELETE FROM oauth_states WHERE state = $1", [state]);
  },

  cleanup: async () => {
    const result = await query<{ cleanup_expired_oauth_states: number }>(
      "SELECT cleanup_expired_oauth_states()",
    );
    return result.rows[0].cleanup_expired_oauth_states;
  },
};

export default pool;
