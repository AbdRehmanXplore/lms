/** Current local time as HH:MM:SS for Postgres `time` columns */
export function nowDbTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Postgres time or null → "HH:MM" for `<input type="time">` */
export function dbTimeToInputValue(db: string | null | undefined): string {
  if (!db) return "";
  const s = String(db).slice(0, 8);
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** "HH:MM" from time input → "HH:MM:00" for Supabase */
export function inputTimeToDb(hhmm: string): string | null {
  const t = hhmm.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:00`;
}

/** Display Postgres time in 12-hour AM/PM */
export function formatDbTimeTo12h(db: string | null | undefined): string {
  if (!db) return "—";
  const parts = String(db).split(":");
  const h = Number(parts[0]);
  const min = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return "—";
  const d = new Date(2000, 0, 1, h, min, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Duration between two same-day HH:MM:SS times → "5h 30m" */
export function workDurationLabel(checkIn: string | null | undefined, checkOut: string | null | undefined): string {
  if (!checkIn || !checkOut) return "—";
  const parse = (s: string) => {
    const [h, m, sec] = s.split(":").map((x) => Number(x));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 3600 + m * 60 + (Number.isFinite(sec) ? sec : 0);
  };
  const a = parse(String(checkIn));
  const b = parse(String(checkOut));
  if (a == null || b == null) return "—";
  let diff = b - a;
  if (diff < 0) diff += 24 * 3600;
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
}
