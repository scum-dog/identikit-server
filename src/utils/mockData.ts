import { FullCharacter } from "./validation";
import { randomUUID } from "crypto";
import {
  SkinColor,
  EyeColor,
  HairColor,
  Sex,
  MockUser,
  MockCharacter,
} from "../types";

const firstNames = [
  "John",
  "Jacob",
  "Jingleheimer",
  "Schmidt",
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

const sexOptions: Sex[] = ["male", "female", "other"];

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRotation(min: number, max: number): number {
  const steps = Math.floor((max - min) / 5) + 1;
  const randomStep = Math.floor(Math.random() * steps);
  return min + randomStep * 5;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function generateShapeId(): number {
  return randomInt(1, 999);
}

function generateOffset(): number {
  return parseFloat(randomFloat(-1, 1).toFixed(1));
}

function generateAccessories() {
  const accessories: {
    glasses?: { asset_id: number; offset_y: number; scale: number };
    mustache?: { asset_id: number; offset_y: number; scale: number };
    misc?: {
      asset_id: number;
      offset_x?: number;
      offset_y: number;
      scale?: number;
    };
  } = {};

  accessories.glasses = {
    asset_id: generateShapeId(),
    offset_y: generateOffset(),
    scale: parseFloat(randomFloat(0.5, 1.5).toFixed(1)),
  };

  accessories.mustache = {
    asset_id: generateShapeId(),
    offset_y: generateOffset(),
    scale: parseFloat(randomFloat(0.5, 1.5).toFixed(1)),
  };

  accessories.misc = {
    asset_id: generateShapeId(),
    offset_x: generateOffset(),
    offset_y: generateOffset(),
    scale: parseFloat(randomFloat(0.5, 1.5).toFixed(1)),
  };

  return accessories;
}

// mock data generators
export function generateMockCharacterData(): FullCharacter {
  const country = randomChoice(countries);
  const regionList = regions[country as keyof typeof regions] || [];
  const region = regionList.length > 0 ? randomChoice(regionList) : undefined;

  const sex = randomChoice(sexOptions);
  const shouldHaveBeard = sex !== "female";

  return {
    character_data: {
      info: {
        name: randomChoice(firstNames),
        sex: sex,
        date_of_birth: randomDate(new Date(1950, 0, 1), new Date(2005, 11, 31))
          .toISOString()
          .split("T")[0],
        height_in: randomInt(60, 80),
        weight_lb: randomInt(120, 220),
        location: {
          country,
          region,
        },
      },
      static: {
        head: {
          asset_id: generateShapeId(),
          skin_color: randomChoice(skinColors),
        },
        hair: {
          asset_id: generateShapeId(),
          hair_color: randomChoice(hairColors),
        },
        ...(shouldHaveBeard
          ? {
              beard: {
                asset_id: generateShapeId(),
                facial_hair_color: randomChoice(hairColors),
              },
            }
          : {}),
        age_lines: { asset_id: generateShapeId() },
      },
      placeable_movable: {
        eyes: {
          asset_id: generateShapeId(),
          eye_color: randomChoice(eyeColors),
          offset_x: parseFloat(randomFloat(0, 1).toFixed(1)),
          offset_y: generateOffset(),
          scale: parseFloat(randomFloat(0.5, 1.5).toFixed(1)),
          rotation: randomRotation(-35, 35),
        },
        eyebrows: {
          asset_id: generateShapeId(),
          offset_x: parseFloat(randomFloat(0, 1).toFixed(1)),
          offset_y: generateOffset(),
          scale: parseFloat(randomFloat(0.5, 1.5).toFixed(1)),
          rotation: randomRotation(-45, 45),
        },
        nose: {
          asset_id: generateShapeId(),
          offset_y: generateOffset(),
          scale: parseFloat(randomFloat(0.5, 1.5).toFixed(1)),
        },
        lips: {
          asset_id: generateShapeId(),
          offset_y: generateOffset(),
          scale: parseFloat(randomFloat(0.5, 1.5).toFixed(1)),
        },
        ...generateAccessories(),
      },
    },
    metadata: {
      upload_id: randomUUID(),
      user_id: randomUUID(),
      created_at: new Date().toISOString(),
      last_edited_at: null,
      is_edited: false,
      can_edit: true,
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
    },
  };
}

export function generateMockCharacter(userId?: string, uploadId?: string) {
  const creationTime = randomDate(new Date(2023, 0, 1), new Date());
  const hasBeenEdited = Math.random() < 0.3;
  const editTime = hasBeenEdited ? randomDate(creationTime, new Date()) : null;
  const characterData = generateMockCharacterData();

  characterData.metadata.upload_id = uploadId || randomUUID();
  characterData.metadata.user_id = userId || randomUUID();
  characterData.metadata.created_at = creationTime.toISOString();
  characterData.metadata.last_edited_at = editTime?.toISOString() || null;
  characterData.metadata.is_edited = hasBeenEdited;

  return {
    upload_id: characterData.metadata.upload_id,
    user_id: characterData.metadata.user_id,
    created_at: characterData.metadata.created_at,
    last_edited_at: characterData.metadata.last_edited_at,
    character_data: characterData.character_data,
    is_edited: characterData.metadata.is_edited,
    is_deleted: characterData.metadata.is_deleted,
    deleted_at: characterData.metadata.deleted_at,
    deleted_by: characterData.metadata.deleted_by,
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
