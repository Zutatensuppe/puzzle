CREATE TABLE user_avatars (
  id SERIAL PRIMARY KEY,
  created TIMESTAMP NOT NULL,
  filename TEXT NOT NULL UNIQUE,
  filename_original TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL
);

CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY,
  avatar_id INTEGER
);
