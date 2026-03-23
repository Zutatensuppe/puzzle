-- Add trusted flag to users
ALTER TABLE users ADD COLUMN trusted INTEGER DEFAULT 0;
-- When set, recomputeTrust will not override the admin's decision
ALTER TABLE users ADD COLUMN trust_manually_set INTEGER DEFAULT 0;

-- Add rejection reason to images
ALTER TABLE images ADD COLUMN reject_reason TEXT DEFAULT '';
