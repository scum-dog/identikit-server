import { randomUUID } from "crypto";
import { Race, EyeColor, HairColor, Sex, Ethnicity } from "../types";
import { COUNTRIES, Country } from "./constants";
import { FullCharacter } from "./validation";

const characterNames = [
  "Filippo Meozzi",
  "Liam Stone",
  "John Q. Herman",
  "George H. W. Bush",
  "J.K. Dobbins",
  "Mary-Kate Olsen",
  "Jean-Claude Van Damme",
  "O'Malley",
  "D'Angelo Russell",
  "Alexandra Marie-Claire",
  "Thomas J. Anderson",
  "Catherine St. James",
  "Michael O'Connor",
  "Sarah-Jane Williams",
  "Robert E. Lee",
  "Elizabeth Mary-Ann",
  "William T. Sherman",
  "Margaret Rose-Marie",
  "Jonathan P. Smith",
  "Katherine Anne-Marie",
  "Benjamin F. Franklin",
  "Victoria Rose-Anne",
  "Theodore R. Roosevelt",
  "Isabella Marie-Grace",
  "Alexander Hamilton-James",
  "Charlotte Rose-Marie",
];

const races: Race[] = ["ai_an", "asian", "black", "nh_pi", "other", "white"];
const ethnicities: Ethnicity[] = ["hispanic_latino", "not_hispanic_latino"];
const eyeColors: EyeColor[] = [
  "black",
  "blue",
  "brown",
  "gray",
  "green",
  "hazel",
  "maroon",
  "pink",
];
const hairColors: HairColor[] = [
  "bald",
  "black",
  "blond",
  "brown",
  "gray",
  "red",
  "sandy",
  "white",
];
const sexOptions: Sex[] = ["male", "female", "other"];

function randomChoice<T>(array: readonly T[]): T {
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

function generateRandomRaces(): Race[] {
  const firstRace = randomChoice(races);
  const remainingRaces = races.filter((race) => race !== firstRace);
  const secondRace = randomChoice(remainingRaces);

  return [firstRace, secondRace].sort((a, b) => {
    if (a === "other") return 1;
    if (b === "other") return -1;
    return a.localeCompare(b);
  });
}

function generateShapeId(): number {
  return randomInt(0, 999);
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

function generateHairData(): { hairColor: HairColor; hairAssetId: number } {
  const hairColor = randomChoice(hairColors);
  const hairAssetId = hairColor === "bald" ? 0 : randomInt(1, 999);
  return { hairColor, hairAssetId };
}

export function generateMockCharacterData(): FullCharacter {
  const country: Country = randomChoice(COUNTRIES);
  const sex = randomChoice(sexOptions);
  const shouldHaveBeard = sex !== "female";
  const { hairColor, hairAssetId } = generateHairData();

  return {
    character_data: {
      info: {
        name: randomChoice(characterNames),
        sex: sex,
        date_of_birth: randomDate(new Date(1950, 0, 1), new Date(2011, 11, 31))
          .toISOString()
          .split("T")[0],
        height_in: randomInt(48, 96),
        weight_lb: randomInt(120, 220),
        eye_color: randomChoice(eyeColors),
        hair_color: hairColor,
        race: generateRandomRaces(),
        ethnicity: randomChoice(ethnicities),
        location: country,
      },
      static: {
        head: {
          asset_id: generateShapeId(),
        },
        hair: {
          asset_id: hairAssetId,
        },
        ...(shouldHaveBeard
          ? {
              beard: {
                asset_id: generateShapeId(),
              },
            }
          : {}),
        age_lines: { asset_id: generateShapeId() },
      },
      placeable_movable: {
        eyes: {
          asset_id: generateShapeId(),
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
