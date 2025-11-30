-- IDENTI-NET DATABASE SCHEMA
CREATE EXTENSION if NOT EXISTS "uuid-ossp";

CREATE EXTENSION if NOT EXISTS "pg_trgm";

-- oauth users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('newgrounds', 'itch', 'google')),
  platform_user_id VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (platform, platform_user_id),
  UNIQUE (platform, username)
);

-- character uploads table
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  character_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_edited_at TIMESTAMP WITH TIME ZONE, -- nullable until first edit
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES users (id),
  UNIQUE (user_id)
);

-- user sessions table
CREATE TABLE user_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id),
  platform VARCHAR(50) NOT NULL,
  platform_user_id VARCHAR(255) NOT NULL,
  platform_session_id VARCHAR(255),
  username VARCHAR(255) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE (user_id)
);

-- oauth state table
CREATE TABLE oauth_states (
  state VARCHAR(200) PRIMARY KEY,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('google', 'itch')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- character indexes
CREATE INDEX idx_characters_user_id ON characters (user_id);

CREATE INDEX idx_characters_created_at ON characters (created_at);

CREATE INDEX idx_characters_random ON characters (id);

CREATE INDEX idx_characters_active ON characters (is_deleted)
WHERE
  is_deleted = FALSE;

CREATE INDEX idx_characters_location ON characters USING gin (
  (character_data -> 'info' ->> 'location') gin_trgm_ops
)
WHERE
  character_data -> 'info' ->> 'location' IS NOT NULL;

CREATE INDEX idx_characters_sex ON characters USING gin (
  (character_data -> 'static' ->> 'sex') gin_trgm_ops
);

CREATE INDEX idx_users_platform ON users (platform, platform_user_id);

CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);

CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);

CREATE INDEX idx_oauth_states_expires_at ON oauth_states (expires_at);

-- business logic
CREATE OR REPLACE FUNCTION can_user_edit_character (character_uuid UUID, user_uuid UUID) returns BOOLEAN AS $$
DECLARE
    char_created_at TIMESTAMP WITH TIME ZONE;
    last_edit_at TIMESTAMP WITH TIME ZONE;
BEGIN

    IF character_uuid IS NULL OR user_uuid IS NULL THEN
        RAISE WARNING 'can_user_edit_character: NULL parameters provided (character_uuid: %, user_uuid: %)', character_uuid, user_uuid;
        RETURN false;
    END IF;

    SELECT created_at, last_edited_at
    INTO char_created_at, last_edit_at
    FROM characters
    WHERE id = character_uuid AND user_id = user_uuid AND is_deleted = false;

    IF char_created_at IS NULL THEN
        RAISE WARNING 'can_user_edit_character: Character % not found or not owned by user %', character_uuid, user_uuid;
        RETURN false;
    END IF;

    IF last_edit_at IS NOT NULL AND last_edit_at > NOW() - INTERVAL '7 days' THEN
        RAISE INFO 'can_user_edit_character: Character % has recent edit at %, weekly limit exceeded', character_uuid, last_edit_at;
        RETURN false;
    END IF;

    RETURN true;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'can_user_edit_character: Unexpected database error occurred';
        RETURN false;
END;
$$ language plpgsql;

CREATE OR REPLACE FUNCTION get_random_characters (limit_count INTEGER DEFAULT 100) returns TABLE (
  id UUID,
  character_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  last_edited_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.character_data,
        c.created_at,
        c.last_edited_at
    FROM characters c
    WHERE c.is_deleted = false
    ORDER BY RANDOM()
    LIMIT limit_count;
END;
$$ language plpgsql;

CREATE OR REPLACE FUNCTION prevent_deleted_character_edit () returns trigger AS $$
BEGIN
    IF OLD IS NULL THEN
        RAISE EXCEPTION 'prevent_deleted_character_edit: OLD record is NULL';
    END IF;

    IF OLD.is_deleted = true THEN
        RAISE EXCEPTION 'Cannot edit deleted character with ID %', OLD.id;
    END IF;

    IF NEW.last_edited_at IS NOT NULL AND NEW.last_edited_at < NEW.created_at THEN
        RAISE EXCEPTION 'Last edited time (%) cannot be before creation time (%) for character %',
                       NEW.last_edited_at, NEW.created_at, NEW.id;
    END IF;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'prevent_deleted_character_edit: Unexpected database error occurred';
END;
$$ language plpgsql;

CREATE TRIGGER check_character_not_deleted before
UPDATE ON characters FOR each ROW
EXECUTE function prevent_deleted_character_edit ();

CREATE OR REPLACE FUNCTION cleanup_expired_sessions () returns INTEGER AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states () returns INTEGER AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM oauth_states WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language plpgsql;
