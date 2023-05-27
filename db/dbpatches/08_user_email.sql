ALTER TABLE users
  ADD COLUMN email TEXT DEFAULT '';

ALTER TABLE user_identity
  ADD COLUMN provider_email TEXT DEFAULT '';
