CREATE TABLE user_identity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider_name TEXT NOT NULL,
  provider_id TEXT NOT NULL
);
