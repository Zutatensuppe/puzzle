CREATE TABLE user_x_game (
  user_id INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  pieces_count INTEGER NOT NULL
);

CREATE TABLE leaderboard (
  rank INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  games_count INTEGER NOT NULL,
  pieces_count INTEGER NOT NULL
);

ALTER TABLE games
  ADD COLUMN pieces_count INTEGER NOT NULL DEFAULT 0;
