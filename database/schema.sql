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
  can_edit BOOLEAN DEFAULT TRUE,
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
CREATE OR REPLACE FUNCTION get_characters_by_age (
  limit_count INTEGER DEFAULT 100,
  offset_count INTEGER DEFAULT 0
) returns TABLE (
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
    ORDER BY c.created_at ASC
    LIMIT limit_count
    OFFSET offset_count;
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

CREATE OR REPLACE FUNCTION update_can_edit_column () returns trigger AS $$
BEGIN
    IF NEW.last_edited_at IS NOT NULL AND NEW.last_edited_at > NOW() - INTERVAL '7 days' THEN
        NEW.can_edit = FALSE;
    ELSE
        NEW.can_edit = TRUE;
    END IF;

    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER check_character_not_deleted before
UPDATE ON characters FOR each ROW
EXECUTE function prevent_deleted_character_edit ();

CREATE TRIGGER update_can_edit_trigger before insert
OR
UPDATE ON characters FOR each ROW
EXECUTE function update_can_edit_column ();

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

CREATE OR REPLACE FUNCTION jsonb_deep_merge (target JSONB, source JSONB) returns JSONB AS $$
DECLARE
    key TEXT;
    value JSONB;
    result JSONB;
BEGIN
    result := target;

    FOR key, value IN SELECT * FROM jsonb_each(source) LOOP
        IF target ? key AND jsonb_typeof(target -> key) = 'object' AND jsonb_typeof(value) = 'object' THEN
            result := jsonb_set(result, ARRAY[key], jsonb_deep_merge(target -> key, value));
        ELSE
            result := jsonb_set(result, ARRAY[key], value);
        END IF;
    END LOOP;

    RETURN result;
END;
$$ language plpgsql;

CREATE OR REPLACE FUNCTION update_character_data (
  p_character_id UUID,
  p_user_id UUID,
  p_partial_data JSONB
) returns void AS $$
DECLARE
    current_character_data JSONB;
    can_edit_flag BOOLEAN;
BEGIN
    SELECT character_data, can_edit INTO current_character_data, can_edit_flag
    FROM characters
    WHERE id = p_character_id AND user_id = p_user_id AND is_deleted = false;

    IF current_character_data IS NULL THEN
        RAISE EXCEPTION 'Character not found or not owned by user';
    END IF;

    IF NOT can_edit_flag THEN
        RAISE EXCEPTION 'Cannot edit character: weekly limit exceeded';
    END IF;

    UPDATE characters
    SET character_data = jsonb_deep_merge(current_character_data, p_partial_data),
        last_edited_at = NOW()
    WHERE id = p_character_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Character update failed';
    END IF;
END;
$$ language plpgsql;
