-- Club positions (set by super admins) and WhatsApp-style group chats.

ALTER TABLE users ADD COLUMN IF NOT EXISTS club_position text;

-- Group chats: name, description and photo; members have a role (admin/member) and can mute.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('direct','crew','group'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS image text;

ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE conversation_members DROP CONSTRAINT IF EXISTS conversation_members_role_check;
ALTER TABLE conversation_members ADD CONSTRAINT conversation_members_role_check CHECK (role IN ('admin','member'));
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

-- Replies and system notices ("Alex added Sophie").
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to text REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text','system'));
