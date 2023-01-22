CREATE TABLE artist (
  id SERIAL PRIMARY KEY,
  created TIMESTAMP NOT NULL,
  name TEXT NOT NULL,
  introduction TEXT NOT NULL,
  links JSON NOT NULL
);

CREATE TABLE collection (
  id SERIAL PRIMARY KEY,
  created TIMESTAMP NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE collection_x_image (
  collection_id INTEGER NOT NULL,
  image_id INTEGER NOT NULL,
  sort_index INTEGER NOT NULL
);

CREATE TABLE artist_x_collection (
  artist_id INTEGER NOT NULL,
  collection_id INTEGER NOT NULL,
  sort_index INTEGER NOT NULL
);
