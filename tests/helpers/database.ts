import { newDb } from "pg-mem";
import { Pool } from "pg";

let testDb: any;
let testPool: Pool;

export const setupTestDatabase = async (): Promise<Pool> => {
  testDb = newDb();

  testDb.public.registerFunction({
    implementation: () => Math.random(),
    name: "random",
  });

  testDb.public.registerFunction({
    implementation: () => new Date().toISOString(),
    name: "now",
  });

  const testSchema = `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      platform VARCHAR(20) NOT NULL,
      platform_user_id VARCHAR(100) NOT NULL,
      username VARCHAR(100) NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TEXT DEFAULT '2023-01-01 00:00:00',
      last_login TEXT DEFAULT '2023-01-01 00:00:00'
    );

    CREATE TABLE user_sessions (
      session_id VARCHAR(64) PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id),
      platform VARCHAR(50) NOT NULL,
      platform_user_id VARCHAR(255) NOT NULL,
      platform_session_id VARCHAR(255),
      username VARCHAR(255) NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT DEFAULT '2023-01-01 00:00:00',
      expires_at TEXT NOT NULL
    );
  `;

  testDb.public.query(testSchema);

  testPool = {
    query: async (text: string, params?: unknown[]) => {
      return testDb.public.query(text, params);
    },
    end: async () => {},
  } as any;

  return testPool;
};

export const teardownTestDatabase = async (): Promise<void> => {
  if (testPool && typeof testPool.end === "function") {
    try {
      await testPool.end();
    } catch (e) {}
  }
  testDb = null;
  testPool = null as any;
};

export const clearTestDatabase = async (): Promise<void> => {
  if (testDb) {
    testDb.public.query("DELETE FROM user_sessions");
    testDb.public.query("DELETE FROM users");
  }
};

export const getTestPool = (): Pool => {
  if (!testPool) {
    throw new Error(
      "Test database not initialized. Call setupTestDatabase() first.",
    );
  }
  return testPool;
};

export const createTestUser = async (overrides: any = {}) => {
  const userData = {
    id: "test-user-" + Math.floor(Math.random() * 100000),
    platform: "newgrounds",
    platform_user_id: "ng_test_user",
    username: "testuser",
    is_admin: false,
    ...overrides,
  };

  const result = await testPool.query(
    `INSERT INTO users (id, platform, platform_user_id, username, is_admin)
     VALUES ('${userData.id}', '${userData.platform}', '${userData.platform_user_id}', '${userData.username}', ${userData.is_admin})
     RETURNING *`,
  );

  return result.rows[0];
};
