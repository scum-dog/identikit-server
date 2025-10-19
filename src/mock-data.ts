import { CharacterData } from "./validation";
import { randomUUID } from "crypto";
import {
  AccessoryType,
  SkinColor,
  EyeColor,
  HairColor,
  Sex,
  MockUser,
  MockCharacter,
  MockEditHistory,
} from "./types";

const firstNames = [
  "John",
  "Jordan",
  "Casey",
  "Riley",
  "Lukas",
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
  "Geoshua",
  "Hayden",
  "Sava",
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

const sexOptions: Sex[] = ["male", "female", "other"];

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
        eye_color: randomChoice(eyeColors),
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
        hair_color: randomChoice(hairColors),
      },
      head_shape: {
        shape_id: generateShapeId("HD"),
        skin_color: randomChoice(skinColors),
      },
      height_cm: randomInt(150, 200),
      weight_kg: randomInt(50, 120),
      sex: randomChoice(sexOptions),
      date_of_birth: randomDate(new Date(1970, 0, 1), new Date(2005, 11, 31))
        .toISOString()
        .split("T")[0],
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
    edit_count: hasBeenEdited ? randomInt(1, 5) : 0,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
  };
}

export function generateMockUser(userId?: string) {
  const platforms = ["newgrounds", "itch", "google"];
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
  const history = [];

  for (let i = 0; i < count; i++) {
    const editedAt = randomDate(new Date(2023, 0, 1), new Date());

    history.push({
      id: randomUUID(),
      character_id: characterId,
      user_id: randomUUID(),
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
      editor_username: `${randomChoice(firstNames)}${randomInt(100, 999)}`,
    });
  }

  return history.sort(
    (a, b) => new Date(b.edited_at).getTime() - new Date(a.edited_at).getTime(),
  );
}

// persistent mock data store
export class MockDataStore {
  private characters: Map<string, MockCharacter> = new Map();
  private users: Map<string, MockUser> = new Map();
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

  deleteCharacter(uploadId: string, adminUserId: string) {
    const character = this.characters.get(uploadId);
    if (character && !character.is_deleted) {
      character.is_deleted = true;
      character.deleted_at = new Date().toISOString();
      character.deleted_by = adminUserId;

      return character;
    }
    return null;
  }
}

export const mockDataStore = new MockDataStore();
