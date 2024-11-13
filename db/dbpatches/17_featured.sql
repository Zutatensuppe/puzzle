ALTER TABLE artist RENAME to featured;

ALTER TABLE featured
  ADD COLUMN "type" TEXT DEFAULT 'artist';

ALTER TABLE artist_x_collection RENAME to featured_x_collection;

ALTER TABLE featured_x_collection RENAME COLUMN artist_id TO featured_id;

CREATE TABLE featured_teaser (
  id SERIAL PRIMARY KEY,
  featured_id INTEGER NOT NULL,
  sort_index INTEGER NOT NULL,
  active INTEGER NOT NULL
);
