CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,

  created TIMESTAMP NOT NULL,

  email TEXT NOT NULL,
  password TEXT NOT NULL,

  salt TEXT NOT NULL
);

ALTER TABLE users
  DROP COLUMN login,
  DROP COLUMN pass,
  DROP COLUMN salt;
