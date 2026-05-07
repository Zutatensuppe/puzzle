CREATE TABLE curation_events (
  id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_curation_events_image_topic ON curation_events(image_id, topic);
CREATE INDEX idx_curation_events_topic ON curation_events(topic);

ALTER TABLE image_x_category ADD COLUMN confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE image_x_category ADD CONSTRAINT image_x_category_unique UNIQUE (image_id, category_id);
