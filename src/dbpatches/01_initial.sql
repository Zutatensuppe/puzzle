CREATE TABLE categories (
  id SERIAL PRIMARY KEY,

  slug TEXT UNIQUE,
  title TEXT UNIQUE
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,

  created TIMESTAMP NOT NULL,

  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL
);

CREATE TABLE image_x_category (
  image_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL
);

CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  uploader_user_id INTEGER,
  created TIMESTAMP NOT NULL,
  filename TEXT NOT NULL UNIQUE,
  filename_original TEXT NOT NULL,
  title TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  private INTEGER NOT NULL
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  creator_user_id INTEGER,
  image_id INTEGER NOT NULL,
  created TIMESTAMP NOT NULL,
  finished TIMESTAMP,
  data TEXT NOT NULL,
  private INTEGER NOT NULL
);
