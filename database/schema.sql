-- IDENTIKIT PLAZA DATABASE SCHEMA

-- enable uuid extension for generating unique ids
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- users table for oauth authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('newgrounds', 'itch')),
    platform_user_id VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- ensure one account per platform per user
    UNIQUE(platform, platform_user_id)
);

-- character uploads table
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- basic character info
    name VARCHAR(100) NOT NULL,
    height_cm INTEGER CHECK (height_cm > 0 AND height_cm < 300),
    weight_kg INTEGER CHECK (weight_kg > 0 AND weight_kg < 500),
    sex VARCHAR(10) NOT NULL DEFAULT 'other' CHECK (sex IN ('male', 'female', 'other')),

    -- location data
    country VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),

    -- character appearance data (json)
    character_data JSONB NOT NULL,

    -- timestamps and versioning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edit_count INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),

    -- ensure one character per user (unless deleted)
    UNIQUE(user_id) WHERE is_deleted = false
);

-- edit history table for tracking changes
CREATE TABLE character_edits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- what changed
    field_changed VARCHAR(50), -- 'character_data', 'name', 'location', etc.
    old_value JSONB,
    new_value JSONB,

    -- when and why
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- user sessions for authentication
CREATE TABLE user_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    platform VARCHAR(50) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- indexes for performance
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_created_at ON characters(created_at);
CREATE INDEX idx_characters_random ON characters(id); -- For random selection
CREATE INDEX idx_characters_active ON characters(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_characters_location_country ON characters(country) WHERE country IS NOT NULL;
CREATE INDEX idx_characters_location_region ON characters(region) WHERE region IS NOT NULL;
CREATE INDEX idx_characters_sex ON characters(sex);

CREATE INDEX idx_character_edits_character_id ON character_edits(character_id);
CREATE INDEX idx_character_edits_edited_at ON character_edits(edited_at);

CREATE INDEX idx_users_platform ON users(platform, platform_user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- functions for business logic

-- function to check if user can edit character (30-day freeze + weekly limit)
CREATE OR REPLACE FUNCTION can_user_edit_character(character_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    char_created_at TIMESTAMP WITH TIME ZONE;
    last_edit_at TIMESTAMP WITH TIME ZONE;
    recent_edits INTEGER;
BEGIN
    -- get character creation and last edit time
    SELECT created_at, last_edited_at
    INTO char_created_at, last_edit_at
    FROM characters
    WHERE id = character_uuid AND user_id = user_uuid AND is_deleted = false;

    -- character doesn't exist or doesn't belong to user
    IF char_created_at IS NULL THEN
        RETURN false;
    END IF;

    -- check 30-day freeze period
    IF char_created_at + INTERVAL '30 days' > NOW() THEN
        RETURN false;
    END IF;

    -- check weekly edit limit (1 edit per week after freeze period)
    SELECT COUNT(*)
    INTO recent_edits
    FROM character_edits
    WHERE character_id = character_uuid
      AND edited_at > NOW() - INTERVAL '7 days';

    -- allow edit if no recent edits
    RETURN recent_edits = 0;
END;
$$ LANGUAGE plpgsql;

-- function to get random characters for plaza
CREATE OR REPLACE FUNCTION get_random_characters(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    character_data JSONB,
    country VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    sex VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE,
    last_edited_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.character_data,
        c.country,
        c.region,
        c.city,
        c.sex,
        c.created_at,
        c.last_edited_at
    FROM characters c
    WHERE c.is_deleted = false
    ORDER BY RANDOM()
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- function to record character edit
CREATE OR REPLACE FUNCTION record_character_edit(
    char_id UUID,
    user_id UUID,
    field_name VARCHAR(50),
    old_val JSONB,
    new_val JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO character_edits (character_id, user_id, field_changed, old_value, new_value)
    VALUES (char_id, user_id, field_name, old_val, new_val);

    -- update character edit count and timestamp
    UPDATE characters
    SET
        last_edited_at = NOW(),
        edit_count = edit_count + 1
    WHERE id = char_id;
END;
$$ LANGUAGE plpgsql;

-- triggers to maintain data integrity

-- trigger to prevent editing deleted characters
CREATE OR REPLACE FUNCTION prevent_deleted_character_edit()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_deleted = true THEN
        RAISE EXCEPTION 'Cannot edit deleted character';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_character_not_deleted
    BEFORE UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION prevent_deleted_character_edit();

-- sample data for development/testing
INSERT INTO users (platform, platform_user_id, username, email, is_admin) VALUES
('newgrounds', 'dev_user_1', 'testuser1', 'test1@example.com', false),
('newgrounds', 'dev_user_2', 'testuser2', 'test2@example.com', false),
('newgrounds', 'admin_user', 'admin', 'admin@scumdog.com', true);

-- sample character data following the specification
INSERT INTO characters (user_id, name, height_cm, weight_kg, sex, country, region, city, character_data) VALUES
(
    (SELECT id FROM users WHERE username = 'testuser1'),
    'Test Character',
    182,
    78,
    'other',
    'USA',
    'California',
    'San Francisco',
    '{
        "placeable_movable": {
            "lips": {
                "shape_id": "L_003",
                "offset_y": 0.2
            },
            "nose": {
                "shape_id": "N_012",
                "offset_y": 0.1
            },
            "eyebrows": {
                "shape_id": "EB_007",
                "offset_y": 0.4
            },
            "eyes": {
                "shape_id": "E_010",
                "offset_y": 0.3,
                "eye_color": "green"
            },
            "accessories": {
                "slot_1": {
                    "type": "glasses",
                    "asset_id": "A_002",
                    "offset_y": 0.3
                },
                "slot_2": {
                    "type": "mustache",
                    "asset_id": "A_117",
                    "offset_y": 0.2
                },
                "slot_3": {
                    "type": "none",
                    "asset_id": null,
                    "offset_y": null
                }
            }
        },
        "static": {
            "hair": {
                "style_id": "H_021",
                "hair_color": "brown"
            },
            "head_shape": {
                "shape_id": "HD_004",
                "skin_color": "medium-tan"
            },
            "height_cm": 182,
            "weight_kg": 78,
            "sex": "other",
            "date_of_birth": "1990-05-15"
        }
    }'::jsonb
);