CREATE TABLE twitch_livestreams (
  id SERIAL PRIMARY KEY,
  is_live INTEGER NOT NULL,
  livestream_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  user_thumbnail TEXT NOT NULL,
  language TEXT NOT NULL,
  viewers INTEGER NOT NULL
);

CREATE INDEX twitch_livestreams_is_live_idx ON twitch_livestreams (is_live);

CREATE INDEX twitch_livestreams_livestream_id_idx ON twitch_livestreams (livestream_id);
