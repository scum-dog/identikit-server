import { Platform, CreateSessionData, DatabaseUser } from "../../src/types";
import {
  generateMockCharacterData,
  generateMockUser,
} from "../../src/utils/mockData";
import {
  createMockUser,
  MockUserOptions,
  canUserEditCharacter,
  getISOString,
  getDaysBetween,
  isValidUUID,
  isValidDateString,
} from "../../src/utils/testMockData";

export {
  createMockUser,
  MockUserOptions,
  canUserEditCharacter,
  getISOString,
  getDaysBetween,
  isValidUUID,
  isValidDateString,
};

export const mockUser: DatabaseUser = createMockUser({
  id: "123e4567-e89b-12d3-a456-426614174000",
  username: "testuser",
  platform_user_id: "ng_12345",
});

export const mockAdminUser: DatabaseUser = createMockUser({
  id: "123e4567-e89b-12d3-a456-426614174001",
  username: "adminuser",
  platform_user_id: "ng_admin",
  is_admin: true,
});

export const mockSessionData: CreateSessionData = {
  userId: mockUser.id,
  platform: mockUser.platform,
  platformUserId: mockUser.platform_user_id,
  username: mockUser.username,
  isAdmin: mockUser.is_admin,
};

export const invalidCharacterData = {
  metadata: {
    upload_id: "invalid-uuid",
    user_id: "invalid-uuid",
    created_at: "invalid-date",
  },
  character_data: {
    info: {
      name: "",
      sex: "invalid" as any,
      date_of_birth: "invalid-date",
      height_in: 0,
      weight_lb: 1000,
      eye_color: "invalid" as any,
      hair_color: "invalid" as any,
      race: "invalid" as any,
      ethnicity: "invalid" as any,
      location: "",
    },
    static: {
      head: {
        asset_id: "INVALID_FORMAT",
      },
    },
  },
};

export const createTestUser = (overrides: Partial<DatabaseUser> = {}) => {
  const generated = generateMockUser();
  return createMockUser({
    id: generated.id,
    username: generated.username,
    platform: generated.platform as Platform,
    platform_user_id: generated.platform_user_id,
    is_admin: generated.is_admin,
    created_at: new Date(generated.created_at).toISOString(),
    last_login: new Date(generated.last_login).toISOString(),
    ...overrides,
  });
};
