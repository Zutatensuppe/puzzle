ALTER TABLE users
  ADD COLUMN login TEXT DEFAULT '',
  ADD COLUMN pass TEXT DEFAULT '',
  ADD COLUMN salt TEXT DEFAULT '';

CREATE TABLE user_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE user_x_user_group (
  user_id INTEGER NOT NULL,
  user_group_id INTEGER NOT NULL
);

CREATE TABLE tokens (
  user_id INTEGER NOT NULL,
  type TEXT,
  token TEXT
);
