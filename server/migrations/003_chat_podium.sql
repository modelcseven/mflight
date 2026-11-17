-- Private chat (1:1 + event crews), member blocking, Car of the Month voting.

CREATE TABLE IF NOT EXISTS conversations (
  id               text PRIMARY KEY,
  kind             text NOT NULL CHECK (kind IN ('direct','crew')),
  direct_key       text UNIQUE,                        -- "<userA>|<userB>" sorted, direct chats only
  event_id         text UNIQUE REFERENCES events(id) ON DELETE CASCADE,  -- crew chats only
  title            text NOT NULL DEFAULT '',
  created_by       text REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz
);
CREATE INDEX IF NOT EXISTS conversations_last_idx ON conversations(last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id  text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','request','left')),
  last_read_at     timestamptz NOT NULL DEFAULT to_timestamp(0),
  joined_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON conversation_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id               text PRIMARY KEY,
  conversation_id  text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        text REFERENCES users(id) ON DELETE SET NULL,
  body             text NOT NULL DEFAULT '',
  attachment       jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS car_votes (
  month      text NOT NULL,                 -- 'YYYY-MM'
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  car_id     text NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, user_id)
);
CREATE INDEX IF NOT EXISTS car_votes_month_idx ON car_votes(month, car_id);

-- Chat messages can be reported (moderators see only the reported message).
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('post','comment','listing','user','car','message'));
