import { CharacterData } from "./validation";
import { randomUUID } from "crypto";
import {
  AccessoryType,
  SkinColor,
  EyeColor,
  HairColor,
  MockUser,
  MockCharacter,
  MockEditHistory,
  MockAdminAction,
} from "./types";

const firstNames = [
  "John",
  "Jordan",
  "Casey",
  "Riley",
  "Morgan",
  "Taylor",
  "Avery",
  "Liam",
  "Sage",
  "River",
  "Dakota",
  "Rowan",
  "Phoenix",
  "Skyler",
  "Cameron",
  "Emery",
  "Filippo",
  "Parker",
  "Blake",
  "Finley",
  "Hayden",
  "Reese",
  "Drew",
  "Elliot",
];

const countries = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Japan",
  "Australia",
  "Brazil",
  "Mexico",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "South Korea",
  "New Zealand",
  "Switzerland",
];

const regions = {
  "United States": ["California", "New York", "Texas", "Florida", "Washington"],
  Canada: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba"],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  Germany: ["Bavaria", "North Rhine-Westphalia", "Berlin", "Hamburg"],
  France: [
    "Île-de-France",
    "Provence-Alpes-Côte d'Azur",
    "Normandy",
    "Brittany",
  ],
  Japan: ["Tokyo", "Osaka", "Kyoto", "Hokkaido", "Okinawa"],
  Australia: ["New South Wales", "Victoria", "Queensland", "Western Australia"],
};

const cities = {
  California: ["Los Angeles", "San Francisco", "San Diego", "Oakland"],
  "New York": ["New York City", "Buffalo", "Rochester", "Syracuse"],
  Texas: ["Houston", "Dallas", "Austin", "San Antonio"],
  Ontario: ["Toronto", "Ottawa", "Hamilton", "London"],
  England: ["London", "Manchester", "Birmingham", "Liverpool"],
  Bavaria: ["Munich", "Nuremberg", "Augsburg", "Würzburg"],
  Tokyo: ["Shibuya", "Shinjuku", "Harajuku", "Akihabara"],
};

const skinColors: SkinColor[] = [
  "pale",
  "light",
  "medium",
  "medium-tan",
  "tan",
  "dark",
  "very-dark",
];

const eyeColors: EyeColor[] = [
  "brown",
  "blue",
  "green",
  "hazel",
  "gray",
  "amber",
  "violet",
];

const hairColors: HairColor[] = [
  "black",
  "brown",
  "blonde",
  "red",
  "gray",
  "white",
  "blue",
  "green",
  "purple",
  "pink",
];

const accessoryTypes: (AccessoryType | "none")[] = [
  "glasses",
  "hat",
  "earrings",
  "mustache",
  "beard",
  "piercing",
  "scar",
  "tattoo",
  "makeup",
  "none",
];

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function generateShapeId(prefix: string): string {
  return `${prefix}_${randomInt(1, 999).toString().padStart(3, "0")}`;
}

function generateAssetId(): string {
  return `A_${randomInt(1, 999).toString().padStart(3, "0")}`;
}

function generateOffset(): number {
  return parseFloat(randomFloat(-1, 1).toFixed(1));
}

// mock data generators
export function generateMockCharacterData(): CharacterData {
  const generateAccessory = () => {
    const type = randomChoice(accessoryTypes);
    if (type === "none") {
      return {
        type: "none" as const,
        asset_id: null,
        offset_y: null,
      };
    } else {
      return {
        type: type,
        asset_id: generateAssetId(),
        offset_y: generateOffset(),
      };
    }
  };

  return {
    placeable_movable: {
      lips: {
        shape_id: generateShapeId("L"),
        offset_y: generateOffset(),
      },
      nose: {
        shape_id: generateShapeId("N"),
        offset_y: generateOffset(),
      },
      eyebrows: {
        shape_id: generateShapeId("EB"),
        offset_y: generateOffset(),
      },
      eyes: {
        shape_id: generateShapeId("E"),
        offset_y: generateOffset(),
      },
      accessories: {
        slot_1: generateAccessory(),
        slot_2: generateAccessory(),
        slot_3: generateAccessory(),
      },
    },
    static: {
      hair: {
        style_id: generateShapeId("H"),
      },
      head_shape: {
        shape_id: generateShapeId("HD"),
      },
      skin_color: randomChoice(skinColors),
      eye_color: randomChoice(eyeColors),
      hair_color: randomChoice(hairColors),
      height_cm: randomInt(150, 200),
      weight_kg: randomInt(50, 120),
    },
  };
}

export function generateMockCharacter(userId?: string, uploadId?: string) {
  const country = randomChoice(countries);
  const regionList = regions[country as keyof typeof regions] || [];
  const region = regionList.length > 0 ? randomChoice(regionList) : undefined;
  const cityList =
    region && cities[region as keyof typeof cities]
      ? cities[region as keyof typeof cities]
      : [];
  const city = cityList.length > 0 ? randomChoice(cityList) : undefined;

  const creationTime = randomDate(new Date(2023, 0, 1), new Date());
  const hasBeenEdited = Math.random() < 0.3; // 30% chance of being edited
  const editTime = hasBeenEdited ? randomDate(creationTime, new Date()) : null;
  const characterData = generateMockCharacterData();

  return {
    upload_id: uploadId || randomUUID(),
    user_id: userId || randomUUID(),
    creator_name: randomChoice(firstNames),
    created_at: creationTime.toISOString(),
    last_edited_at: editTime?.toISOString() || creationTime.toISOString(),
    location: {
      country: Math.random() > 0.1 ? country : null,
      region: Math.random() > 0.2 ? region : null,
      city: Math.random() > 0.3 ? city : null,
    },
    character_data: characterData,
    date_of_birth: randomDate(new Date(1970, 0, 1), new Date(2005, 11, 31))
      .toISOString()
      .split("T")[0],
    edit_count: hasBeenEdited ? randomInt(1, 5) : 0,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
  };
}

export function generateMockUser(userId?: string) {
  const platforms = ["newgrounds", "itch"];
  const platform = randomChoice(platforms);

  return {
    id: userId || randomUUID(),
    username: `${randomChoice(firstNames)}${randomInt(100, 999)}`,
    platform,
    platform_user_id: randomInt(10000, 999999).toString(),
    email: `user${randomInt(100, 999)}@example.com`,
    created_at: randomDate(new Date(2022, 0, 1), new Date()).toISOString(),
    last_login: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
    is_admin: false,
  };
}

export function generateMockEditHistory(
  characterId: string,
  count: number = 5,
) {
  const editTypes = ["user_edit", "admin_edit", "system_edit"];
  const history = [];

  for (let i = 0; i < count; i++) {
    const editType = randomChoice(editTypes);
    const editedAt = randomDate(new Date(2023, 0, 1), new Date());

    history.push({
      id: randomUUID(),
      character_id: characterId,
      user_id: editType === "system_edit" ? null : randomUUID(),
      edit_type: editType,
      changes: {
        fields_changed: randomChoice([
          ["creator_name"],
          ["character_data"],
          ["creator_name", "character_data"],
          ["location"],
        ]),
        old_values: {},
        new_values: {},
      },
      edited_at: editedAt.toISOString(),
      editor_username:
        editType === "system_edit"
          ? null
          : `${randomChoice(firstNames)}${randomInt(100, 999)}`,
    });
  }

  return history.sort(
    (a, b) => new Date(b.edited_at).getTime() - new Date(a.edited_at).getTime(),
  );
}

export function generateMockAdminAction() {
  const actions = [
    "delete_character",
    "restore_character",
    "ban_user",
    "unban_user",
  ];
  const action = randomChoice(actions);
  const createdAt = randomDate(new Date(2023, 0, 1), new Date());

  return {
    id: randomUUID(),
    admin_user_id: randomUUID(),
    action_type: action,
    target_character_id: action.includes("character") ? randomUUID() : null,
    target_user_id: action.includes("user") ? randomUUID() : null,
    reason: randomChoice([
      "Inappropriate content",
      "Violates community guidelines",
      "Legal request",
    ]),
    metadata: {
      ip_address: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
      user_agent: "Mock Admin Interface",
    },
    created_at: createdAt.toISOString(),
    admin_username: `Admin${randomInt(1, 10)}`,
    target_character_name: action.includes("character")
      ? randomChoice(firstNames)
      : null,
    target_username: action.includes("user")
      ? `${randomChoice(firstNames)}${randomInt(100, 999)}`
      : null,
  };
}

// persistent mock data store
export class MockDataStore {
  private characters: Map<string, MockCharacter> = new Map();
  private users: Map<string, MockUser> = new Map();
  private adminActions: MockAdminAction[] = [];
  private editHistories: Map<string, MockEditHistory[]> = new Map();

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // generate 50 mock characters
    for (let i = 0; i < 50; i++) {
      const character = generateMockCharacter();
      this.characters.set(character.upload_id, character);

      // generate mock edit history for each character
      const history = generateMockEditHistory(
        character.upload_id,
        randomInt(1, 8),
      );
      this.editHistories.set(character.upload_id, history);
    }

    // generate 30 mock users
    for (let i = 0; i < 30; i++) {
      const user = generateMockUser();
      this.users.set(user.id, user);
    }

    // generate 25 admin actions
    for (let i = 0; i < 25; i++) {
      this.adminActions.push(generateMockAdminAction());
    }

    // sort admin actions by newest first
    this.adminActions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  getCharacters() {
    return Array.from(this.characters.values());
  }

  getCharacter(id: string) {
    return this.characters.get(id);
  }

  getUsers() {
    return Array.from(this.users.values());
  }

  getUser(id: string) {
    return this.users.get(id);
  }

  getAdminActions() {
    return [...this.adminActions];
  }

  getEditHistory(characterId: string) {
    return this.editHistories.get(characterId) || [];
  }

  addCharacter(character: MockCharacter) {
    this.characters.set(character.upload_id, character);
    this.editHistories.set(character.upload_id, []);
  }

  updateCharacter(uploadId: string, updates: Partial<MockCharacter>) {
    const character = this.characters.get(uploadId);
    if (character) {
      const updatedCharacter = {
        ...character,
        ...updates,
        last_edited_at: new Date().toISOString(),
        edit_count: character.edit_count + 1,
      };
      this.characters.set(uploadId, updatedCharacter);
      return updatedCharacter;
    }
    return null;
  }

  deleteCharacter(uploadId: string, adminUserId: string, reason: string) {
    const character = this.characters.get(uploadId);
    if (character && !character.is_deleted) {
      character.is_deleted = true;
      character.deleted_at = new Date().toISOString();
      character.deleted_by = adminUserId;

      // log to mock admin actins
      const adminAction = {
        id: randomUUID(),
        admin_user_id: adminUserId,
        action_type: "delete_character",
        target_character_id: uploadId,
        target_user_id: character.user_id,
        reason,
        metadata: {
          ip_address: "127.0.0.1",
          user_agent: "Mock Admin Interface",
        },
        created_at: new Date().toISOString(),
        admin_username: "MockAdmin",
        target_character_name: character.creator_name,
        target_username: null,
      };

      this.adminActions.unshift(adminAction);
      return character;
    }
    return null;
  }
}

export const mockDataStore = new MockDataStore();
