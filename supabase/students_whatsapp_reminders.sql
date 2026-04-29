-- WhatsApp reminder opt-in per student (used by fee defaulters + N8N).
alter table students add column if not exists whatsapp_reminders boolean default false;
