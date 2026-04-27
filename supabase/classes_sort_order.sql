-- First delete old wrong classes and reinsert in correct order
DELETE FROM classes;

INSERT INTO classes (name, section) VALUES
  ('Play Group', 'A'),
  ('Montessory', 'A'),
  ('Junior', 'A'),
  ('Senior', 'A'),
  ('Class 1', 'A'),
  ('Class 2', 'A'),
  ('Class 3', 'A'),
  ('Class 4', 'A'),
  ('Class 5', 'A'),
  ('Class 6', 'A'),
  ('Class 7', 'A'),
  ('Class 8', 'A'),
  ('Class 9', 'A'),
  ('Class 10', 'A')
ON CONFLICT (name) DO NOTHING;

-- Add sort_order column to maintain sequence
ALTER TABLE classes ADD COLUMN IF NOT EXISTS sort_order integer;

UPDATE classes SET sort_order = CASE name
  WHEN 'Play Group'  THEN 1
  WHEN 'Montessory'  THEN 2
  WHEN 'Junior'      THEN 3
  WHEN 'Senior'      THEN 4
  WHEN 'Class 1'     THEN 5
  WHEN 'Class 2'     THEN 6
  WHEN 'Class 3'     THEN 7
  WHEN 'Class 4'     THEN 8
  WHEN 'Class 5'     THEN 9
  WHEN 'Class 6'     THEN 10
  WHEN 'Class 7'     THEN 11
  WHEN 'Class 8'     THEN 12
  WHEN 'Class 9'     THEN 13
  WHEN 'Class 10'    THEN 14
END;

