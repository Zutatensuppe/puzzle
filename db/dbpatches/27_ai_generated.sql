ALTER TABLE images ADD COLUMN ai_generated INTEGER DEFAULT 0;
ALTER TABLE public.user_settings ADD hide_ai_images bool DEFAULT false NOT NULL;
