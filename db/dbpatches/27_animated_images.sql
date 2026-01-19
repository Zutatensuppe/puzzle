-- Stores the extracted frames of an animated image, if any.
-- NULL  -> never checked / never extracted
-- '[]'  -> checked, not an animated image (or extraction failed)
-- [{filename, delay_ms}, ...] -> extracted frames, in order
ALTER TABLE images ADD COLUMN IF NOT EXISTS animated_frames jsonb;
