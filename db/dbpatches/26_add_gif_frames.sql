CREATE TABLE IF NOT EXISTS image_gif_frames (
  id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  filename VARCHAR(255) NOT NULL,
  delay_ms INTEGER NOT NULL DEFAULT 100,
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(image_id, frame_index)
);

CREATE INDEX IF NOT EXISTS idx_image_gif_frames_image_id ON image_gif_frames(image_id);
