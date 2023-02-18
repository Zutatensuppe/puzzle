DROP TABLE leaderboard;

CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE leaderboard_entries (
  leaderboard_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  games_count INTEGER NOT NULL,
  pieces_count INTEGER NOT NULL
);

