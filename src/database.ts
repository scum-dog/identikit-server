import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";

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

export const query = async (text: string, params?: any[]): Promise<any> => {
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
    const result = await query(
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
    const result = await query(
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
    const result = await query(
      "SELECT * FROM characters WHERE user_id = $1 AND is_deleted = false",
      [userId],
    );
    return result.rows[0];
  },

  // create new character
  create: async (userId: string, characterData: any) => {
    const {
      name,
      dateOfBirth,
      heightCm,
      weightKg,
      eyeColor,
      country,
      region,
      city,
      characterJson,
    } = characterData;

    const result = await query(
      `INSERT INTO characters
       (user_id, name, date_of_birth, height_cm, weight_kg, eye_color,
        country, region, city, character_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        name,
        dateOfBirth,
        heightCm,
        weightKg,
        eyeColor,
        country,
        region,
        city,
        JSON.stringify(characterJson),
      ],
    );
    return result.rows[0];
  },

  // update character (with validation)
  update: async (characterId: string, userId: string, updates: any) => {
    const canEdit = await query(
      "SELECT can_user_edit_character($1, $2) as can_edit",
      [characterId, userId],
    );

    if (!canEdit.rows[0].can_edit) {
      throw new Error(
        "Cannot edit character: either in freeze period or weekly limit exceeded",
      );
    }

    const oldCharacter = await query(
      "SELECT * FROM characters WHERE id = $1 AND user_id = $2",
      [characterId, userId],
    );

    if (oldCharacter.rows.length === 0) {
      throw new Error("Character not found or not owned by user");
    }

    const {
      name,
      dateOfBirth,
      heightCm,
      weightKg,
      eyeColor,
      country,
      region,
      city,
      characterJson,
    } = updates;
    const result = await query(
      `UPDATE characters
       SET name = $3, date_of_birth = $4, height_cm = $5, weight_kg = $6,
           eye_color = $7, country = $8, region = $9, city = $10,
           character_data = $11, last_edited_at = NOW(), edit_count = edit_count + 1
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        characterId,
        userId,
        name,
        dateOfBirth,
        heightCm,
        weightKg,
        eyeColor,
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
    const result = await query("SELECT * FROM get_random_characters($1)", [
      limit,
    ]);
    return result.rows;
  },

  // search characters by location
  searchByLocation: async (
    country?: string,
    region?: string,
    limit: number = 100,
  ) => {
    let whereClause = "WHERE is_deleted = false";
    const params: any[] = [];
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
      SELECT id, name, character_data, country, region, city, created_at, last_edited_at
      FROM characters
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT $${paramCount}
    `;
    params.push(limit);

    const result = await query(query_text, params);
    return result.rows;
  },

  adminDelete: async (
    characterId: string,
    adminUserId: string,
    reason: string,
  ) => {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        "UPDATE characters SET is_deleted = true, deleted_at = NOW(), deleted_by = $2 WHERE id = $1",
        [characterId, adminUserId],
      );

      await client.query(
        `INSERT INTO admin_actions (admin_user_id, target_character_id, action_type, reason)
         VALUES ($1, $2, 'delete_character', $3)`,
        [adminUserId, characterId, reason],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default pool;
