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
} from "../types";

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
  "black",
  "maroon",
];

const hairColors: HairColor[] = [
  "bald",
  "black",
  "blonde",
  "blue",
  "brown",
  "gray",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "sandy",
  "white",
];

const accessoryTypes: (AccessoryType | "none")[] = [
  "glasses",
  "mustache",
  "misc",
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
  const prefixes = ["A", "B", "C", "EA", "EB", "EY", "H", "L", "N"];
  const prefix = randomChoice(prefixes);
  return `${prefix}_${randomInt(1, 999).toString().padStart(3, "0")}`;
}

function generateOffset(): number {
  return parseFloat(randomFloat(-1, 1).toFixed(1));
}

// mock data generators
export function generateMockCharacterData(): CharacterData {
  const generateAccessory = () => {
    const type = randomChoice(accessoryTypes);
    if (type === "none") {
      return undefined;
    } else if (type === "misc") {
      return {
        type: "misc" as const,
        asset_id: generateAssetId(),
        offset_x: generateOffset(),
        offset_y: generateOffset(),
        scale: 1.0,
      };
    } else if (type === "glasses") {
      return {
        type: "glasses" as const,
        asset_id:
          "G_" +
          Math.floor(Math.random() * 900 + 100)
            .toString()
            .padStart(3, "0"),
        offset_y: generateOffset(),
        scale: 1.0,
      };
    } else if (type === "mustache") {
      return {
        type: "mustache" as const,
        asset_id:
          "M_" +
          Math.floor(Math.random() * 900 + 100)
            .toString()
            .padStart(3, "0"),
        offset_y: generateOffset(),
        scale: 1.0,
      };
    }
  };

  return {
    metadata: {
      upload_id: randomUUID(),
      user_id: randomUUID(),
      created_at: new Date().toISOString(),
      last_edited_at: null,
      is_edited: false,
      canEdit: true,
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      location: {
        country: randomChoice(countries),
        region: randomChoice(
          regions[randomChoice(countries) as keyof typeof regions] || [],
        ),
        city: randomChoice(
          cities[randomChoice(Object.keys(cities)) as keyof typeof cities] ||
            [],
        ),
      },
    },
    character_data: {
      static: {
        name: randomChoice(firstNames),
        sex: randomChoice(sexOptions),
        date_of_birth: "1990-01-01",
        height_in: randomInt(60, 80),
        weight_lb: randomInt(120, 220),
        head_shape: {
          shape_id: generateShapeId("H"),
          skin_color: randomChoice(skinColors),
        },
        hair: {
          style_id: generateShapeId("H"),
          hair_color: randomChoice(hairColors),
        },
        beard: {
          shape_id: generateShapeId("B"),
          facial_hair_color: randomChoice(hairColors),
        },
        mustache: {
          shape_id: generateShapeId("M"),
          facial_hair_color: randomChoice(hairColors),
        },
        chin: {
          shape_id: generateShapeId("C"),
        },
      },
      placeable_movable: {
        ears: {
          shape_id: generateShapeId("EA"),
          scale: 1.0,
        },
        eyes: {
          shape_id: generateShapeId("EY"),
          eye_color: randomChoice(eyeColors),
          offset_y: generateOffset(),
          scale: 1.0,
          rotation: 0,
          distance: 0.0,
        },
        eyebrows: {
          shape_id: generateShapeId("EB"),
          offset_y: generateOffset(),
          scale: 1.0,
          rotation: 0,
          distance: 0.0,
        },
        nose: {
          shape_id: generateShapeId("N"),
          offset_y: generateOffset(),
          scale: 1.0,
        },
        lips: {
          shape_id: generateShapeId("L"),
          offset_y: generateOffset(),
          scale: 1.0,
        },
        age_lines: {
          shape_id: generateShapeId("A"),
        },
        accessories: {
          slot_1: generateAccessory(),
          slot_2: generateAccessory(),
          slot_3: generateAccessory(),
        },
      },
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
    created_at: creationTime.toISOString(),
    last_edited_at: editTime?.toISOString() || creationTime.toISOString(),
    location: {
      country: country,
      region: Math.random() > 0.2 ? region || null : null,
      city: Math.random() > 0.3 ? city || null : null,
    },
    character_data: characterData,
    is_edited: hasBeenEdited,
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
    created_at: randomDate(new Date(2022, 0, 1), new Date()).toISOString(),
    last_login: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
    is_admin: false,
  };
}

// persistent mock data store
export class MockDataStore {
  private characters: Map<string, MockCharacter> = new Map();
  private users: Map<string, MockUser> = new Map();

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // generate 50 mock characters
    for (let i = 0; i < 50; i++) {
      const character = generateMockCharacter();
      this.characters.set(character.upload_id, character);
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

  addCharacter(character: MockCharacter) {
    this.characters.set(character.upload_id, character);
  }

  updateCharacter(uploadId: string, updates: Partial<MockCharacter>) {
    const character = this.characters.get(uploadId);
    if (character) {
      const updatedCharacter = {
        ...character,
        ...updates,
        last_edited_at: new Date().toISOString(),
        is_edited: true,
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
