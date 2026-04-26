-- Delete old classes and insert new ones
delete from classes;

insert into classes (name, section) values
  ('Play Group', 'A'),
  ('Junior', 'A'),
  ('Montessory', 'A'),
  ('Class 1', 'A'),
  ('Class 2', 'A'),
  ('Class 3', 'A'),
  ('Class 4', 'A'),
  ('Class 5', 'A'),
  ('Class 6', 'A'),
  ('Class 7', 'A'),
  ('Class 8', 'A'),
  ('Class 9', 'A'),
  ('Class 10', 'A');

insert into subjects (class_id, name, max_marks, passing_marks)
select c.id, s.name, 100, 40
from classes c
cross join (
  values
    ('English'),
    ('Urdu'),
    ('Math'),
    ('Science'),
    ('Social Studies'),
    ('Islamiat'),
    ('Sindhi')
) as s(name)
on conflict do nothing;
