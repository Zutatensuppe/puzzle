ALTER TABLE games
  ADD COLUMN join_password TEXT DEFAULT NULL,
  ADD COLUMN require_account INTEGER DEFAULT 0;