CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,

  created TIMESTAMP NOT NULL,

  title TEXT NOT NULL,
  message TEXT NOT NULL
);
