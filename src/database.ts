import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";
import {
  CharacterCreateData,
  CharacterUpdateData,
  SearchParams,
  DatabaseCharacter,
  CanEditResult,
  DatabaseUser,
  PlazaCharacterResult,
} from "./types";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  idleTimeoutMillis: 30 * 1000,
  connectionTimeoutMillis: 2000,
});

// test db connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client:", err);
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
    console.log("Executed query", { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error("Database query error:", error);
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
    email?: string,
  ) => {
    const result = await query<DatabaseUser>(
      `INSERT INTO users (platform, platform_user_id, username, email)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [platform, platformUserId, username, email],
    );
    return result.rows[0];
  },

  updateLastLogin: async (userId: string) => {
    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [userId]);
  },
};

// character-related database operations
export const characterQueries = {
  // Get user's character
  findByUserId: async (userId: string) => {
    const result = await query<DatabaseCharacter>(
      "SELECT * FROM characters WHERE user_id = $1 AND is_deleted = false",
      [userId],
    );
    return result.rows[0];
  },

  // create new character
  create: async (userId: string, characterData: CharacterCreateData) => {
    const {
      name,
      heightCm,
      weightKg,
      sex,
      country,
      region,
      city,
      characterJson,
    } = characterData;

    const result = await query<DatabaseCharacter>(
      `INSERT INTO characters
       (user_id, name, height_cm, weight_kg, sex,
        country, region, city, character_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        name,
        heightCm,
        weightKg,
        sex,
        country,
        region,
        city,
        JSON.stringify(characterJson),
      ],
    );
    return result.rows[0];
  },

  // update character (with validation)
  update: async (
    characterId: string,
    userId: string,
    updates: CharacterUpdateData,
  ) => {
    const canEdit = await query<CanEditResult>(
      "SELECT can_user_edit_character($1, $2) as can_edit",
      [characterId, userId],
    );

    if (!canEdit.rows[0].can_edit) {
      throw new Error(
        "Cannot edit character: either in freeze period or weekly limit exceeded",
      );
    }

    const oldCharacter = await query<DatabaseCharacter>(
      "SELECT * FROM characters WHERE id = $1 AND user_id = $2",
      [characterId, userId],
    );

    if (oldCharacter.rows.length === 0) {
      throw new Error("Character not found or not owned by user");
    }

    const {
      name,
      heightCm,
      weightKg,
      sex,
      country,
      region,
      city,
      characterJson,
    } = updates;
    const result = await query<DatabaseCharacter>(
      `UPDATE characters
       SET name = $3, height_cm = $4, weight_kg = $5, sex = $6,
           country = $7, region = $8, city = $9,
           character_data = $10, last_edited_at = NOW(), edit_count = edit_count + 1
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        characterId,
        userId,
        name,
        heightCm,
        weightKg,
        sex,
        country,
        region,
        city,
        JSON.stringify(characterJson),
      ],
    );

    // record the edit in history
    await query(`SELECT record_character_edit($1, $2, $3, $4, $5)`, [
      characterId,
      userId,
      "full_update",
      JSON.stringify(oldCharacter.rows[0]),
      JSON.stringify(result.rows[0]),
    ]);

    return result.rows[0];
  },

  // get random characters for plaza
  getRandomCharacters: async (limit: number = 100) => {
    const result = await query<PlazaCharacterResult>(
      "SELECT * FROM get_random_characters($1)",
      [limit],
    );
    return result.rows;
  },

  // search characters by location
  searchByLocation: async (
    country?: string,
    region?: string,
    limit: number = 100,
  ) => {
    let whereClause = "WHERE is_deleted = false";
    const params: SearchParams = [];
    let paramCount = 0;

    if (country) {
      paramCount++;
      whereClause += ` AND country ILIKE $${paramCount}`;
      params.push(`%${country}%`);
    }

    if (region) {
      paramCount++;
      whereClause += ` AND region ILIKE $${paramCount}`;
      params.push(`%${region}%`);
    }

    paramCount++;
    const query_text = `
      SELECT id, name, character_data, country, region, city, sex, created_at, last_edited_at
      FROM characters
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT $${paramCount}
    `;
    params.push(limit);

    const result = await query<PlazaCharacterResult>(query_text, params);
    return result.rows;
  },

  adminDelete: async (characterId: string, adminUserId: string) => {
    await query(
      "UPDATE characters SET is_deleted = true, deleted_at = NOW(), deleted_by = $2 WHERE id = $1",
      [characterId, adminUserId],
    );
  },
};

export default pool;
