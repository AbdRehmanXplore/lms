-- Add explicit `name` column to teachers table (while keeping existing `full_name`)
ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS name text;

-- Backfill existing rows from full_name
UPDATE teachers
SET name = full_name
WHERE name IS NULL AND full_name IS NOT NULL;

-- Keep name/full_name in sync for future writes
CREATE OR REPLACE FUNCTION sync_teacher_name_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NULL AND NEW.full_name IS NOT NULL THEN
    NEW.name := NEW.full_name;
  ELSIF NEW.full_name IS NULL AND NEW.name IS NOT NULL THEN
    NEW.full_name := NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_teacher_name_columns ON teachers;
CREATE TRIGGER trg_sync_teacher_name_columns
BEFORE INSERT OR UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION sync_teacher_name_columns();

