-- Migration: Add key_contacts table
-- Adds the Key Contact designation for client users at company and site level.

CREATE TABLE IF NOT EXISTS key_contacts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT key_contacts_user_entity_unique UNIQUE (user_id, entity_type, entity_id)
);

-- Enforce: entity_type must be 'company' or 'site'
ALTER TABLE key_contacts
  ADD CONSTRAINT key_contacts_entity_type_check
  CHECK (entity_type IN ('company', 'site'));
