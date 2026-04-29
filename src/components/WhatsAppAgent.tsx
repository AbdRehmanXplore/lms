"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { cn } from "@/lib/utils/cn";

const WHATSAPP_GREEN = "#25D366";

export type WhatsAppAgentOpenOptions = {
  studentIds?: string[];
};

type Ctx = {
  openAgent: (opts?: WhatsAppAgentOpenOptions) => void;
  closeAgent: () => void;
};

const WhatsAppAgentContext = createContext<Ctx | null>(null);

export function useWhatsAppAgent() {
  const v = useContext(WhatsAppAgentContext);
  if (!v) throw new Error("useWhatsAppAgent must be used within WhatsAppAgentProvider");
  return v;
}

/** Safe when widget is not mounted (returns null). */
export function useWhatsAppAgentSafe(): Ctx | null {
  return useContext(WhatsAppAgentContext);
}

type AgentStudent = {
  id: string;
  full_name: string;
  phone: string | null;
  className: string;
  whatsapp_reminders: boolean;
  totalDue: number;
};

function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.173.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const TEMPLATE_CHIPS: { label: string; body: string }[] = [
  {
    label: "Pay fees",
    body: "Dear {name}, this is a reminder to pay your pending school fees. Please visit the office or transfer at your earliest convenience.",
  },
  {
    label: "Overdue",
    body: "Dear {name}, your fee payment is overdue. Kindly settle the balance soon to avoid inconvenience.",
  },
  {
    label: "Contact school",
    body: "Dear {name}, please contact the school office regarding your fee account.",
  },
  {
    label: "Low attendance",
    body: "Dear {name}, we noticed low attendance. Please ensure regular attendance and fee clearance.",
  },
];

function WhatsAppPanel({
  supabase,
  onClose,
  pendingPresetRef,
}: {
  supabase: ReturnType<typeof useSupabaseClient>;
  onClose: () => void;
  pendingPresetRef: React.MutableRefObject<string[]>;
}) {
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const [feeDefaulters, setFeeDefaulters] = useState<AgentStudent[]>([]);
  const [loadingFd, setLoadingFd] = useState(false);

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [classStudents, setClassStudents] = useState<AgentStudent[]>([]);
  const [loadingClass, setLoadingClass] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<AgentStudent[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [reminderSaving, setReminderSaving] = useState<string | null>(null);

  const loadFeeDefaulters = useCallback(async () => {
    setLoadingFd(true);
    const { data, error } = await supabase
      .from("fee_vouchers")
      .select("student_id, amount, students(id, full_name, phone, whatsapp_reminders, classes(name))")
      .in("status", ["unpaid", "overdue"]);

    if (error) {
      toast.error(error.message);
      setLoadingFd(false);
      return;
    }

    const agg = new Map<string, AgentStudent>();
    for (const row of data ?? []) {
      const sid = row.student_id as string;
      const raw = row.students as Record<string, unknown> | Record<string, unknown>[] | null;
      const st = Array.isArray(raw) ? raw[0] : raw;
      if (!st?.id) continue;
      const cls = st.classes as { name: string } | { name: string }[] | null;
      const cname = Array.isArray(cls) ? cls[0]?.name : cls?.name;
      const amt = Number(row.amount ?? 0);
      const phone = (st.phone as string | null) ?? null;
      const wr = Boolean(st.whatsapp_reminders ?? false);
      const name = String(st.full_name ?? "");
      const prev = agg.get(sid);
      if (!prev) {
        agg.set(sid, {
          id: sid,
          full_name: name,
          phone,
          className: cname ?? "—",
          whatsapp_reminders: wr,
          totalDue: amt,
        });
      } else {
        prev.totalDue += amt;
      }
    }
    setFeeDefaulters([...agg.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setLoadingFd(false);
  }, [supabase]);

  useEffect(() => {
    void supabase.from("classes").select("id,name").order("sort_order").then(({ data }) => setClasses(data ?? []));
  }, [supabase]);

  useEffect(() => {
    void loadFeeDefaulters();
  }, [loadFeeDefaulters]);

  useEffect(() => {
    const preset = pendingPresetRef.current;
    pendingPresetRef.current = [];
    if (preset.length) {
      setSelected((s) => new Set([...s, ...preset]));
      setTab(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when panel opens to merge preset IDs
  }, []);

  useEffect(() => {
    if (!classId) {
      setClassStudents([]);
      return;
    }
    setLoadingClass(true);
    void (async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, phone, whatsapp_reminders, classes(name)")
        .eq("class_id", classId)
        .eq("status", "active");

      if (error) {
        toast.error(error.message);
        setLoadingClass(false);
        return;
      }

      const rows: AgentStudent[] = (data ?? []).map((st) => {
        const cls = st.classes as { name: string } | { name: string }[] | null;
        const cname = Array.isArray(cls) ? cls[0]?.name : cls?.name;
        return {
          id: st.id,
          full_name: st.full_name,
          phone: st.phone ?? null,
          className: cname ?? "—",
          whatsapp_reminders: Boolean(st.whatsapp_reminders ?? false),
          totalDue: 0,
        };
      });
      setClassStudents(rows.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setLoadingClass(false);
    })();
  }, [classId, supabase]);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(() => {
      setLoadingSearch(true);
      void (async () => {
        const { data, error } = await supabase
          .from("students")
          .select("id, full_name, phone, whatsapp_reminders, classes(name)")
          .eq("status", "active")
          .ilike("full_name", `%${q}%`)
          .limit(25);

        if (error) {
          toast.error(error.message);
          setLoadingSearch(false);
          return;
        }

        const rows: AgentStudent[] = (data ?? []).map((st) => {
          const cls = st.classes as { name: string } | { name: string }[] | null;
          const cname = Array.isArray(cls) ? cls[0]?.name : cls?.name;
          return {
            id: st.id,
            full_name: st.full_name,
            phone: st.phone ?? null,
            className: cname ?? "—",
            whatsapp_reminders: Boolean(st.whatsapp_reminders ?? false),
            totalDue: 0,
          };
        });
        setSearchHits(rows);
        setLoadingSearch(false);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, supabase]);

  const tabStudents = tab === 0 ? feeDefaulters : tab === 1 ? classStudents : searchHits;

  const toggleReminder = async (studentId: string, next: boolean) => {
    setReminderSaving(studentId);
    const { error } = await supabase.from("students").update({ whatsapp_reminders: next }).eq("id", studentId);
    setReminderSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }

    const patch = (list: AgentStudent[]) =>
      list.map((r) => (r.id === studentId ? { ...r, whatsapp_reminders: next } : r));

    setFeeDefaulters(patch);
    setClassStudents(patch);
    setSearchHits(patch);
    toast.success(next ? "Auto reminders enabled" : "Auto reminders disabled");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllVisible = () => {
    if (selected.size === tabStudents.length && tabStudents.length > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(tabStudents.map((s) => s.id)));
  };

  const studentMap = useMemo(() => {
    const m = new Map<string, AgentStudent>();
    for (const s of [...feeDefaulters, ...classStudents, ...searchHits]) {
      if (!m.has(s.id)) m.set(s.id, s);
    }
    return m;
  }, [feeDefaulters, classStudents, searchHits]);

  const sendWebhook = async () => {
    const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL?.trim();
    if (!url || url.includes("your-n8n-webhook-url")) {
      toast.error("Set NEXT_PUBLIC_N8N_WEBHOOK_URL in .env.local");
      return;
    }
    const tpl = message.trim();
    if (!tpl) {
      toast.error("Type a message first");
      return;
    }
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error("Select at least one student");
      return;
    }

    const resolvedMap = new Map(studentMap);
    const missing: string[] = [];
    for (const id of ids) {
      if (!resolvedMap.has(id)) missing.push(id);
    }
    if (missing.length) {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, phone, whatsapp_reminders, classes(name)")
        .in("id", missing);
      for (const st of data ?? []) {
        const cls = st.classes as { name: string } | { name: string }[] | null;
        const cname = Array.isArray(cls) ? cls[0]?.name : cls?.name;
        resolvedMap.set(st.id, {
          id: st.id,
          full_name: st.full_name,
          phone: st.phone ?? null,
          className: cname ?? "—",
          whatsapp_reminders: Boolean(st.whatsapp_reminders ?? false),
          totalDue: 0,
        });
      }
    }

    setSending(true);
    try {
      const recipients = ids.map((id) => {
        const st = resolvedMap.get(id);
        const name = st?.full_name ?? "Student";
        const personalized = tpl.replace(/\{name\}/gi, name);
        return {
          studentId: id,
          fullName: name,
          phone: st?.phone ?? null,
          className: st?.className ?? null,
          message: personalized,
        };
      });

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "school-dashboard",
          template: tpl,
          recipients,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.success("Messages queued successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const formatPkr = (n: number) =>
    `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const maskPhone = (p: string | null) => {
    if (!p || p.length < 6) return p ?? "—";
    return `${p.slice(0, 4)}XXXX${p.slice(-4)}`;
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[1px]" role="presentation" onClick={onClose} />
      <div className="fixed bottom-6 right-6 z-[9999] flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Send WhatsApp Message</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex shrink-0 border-b border-slate-700 px-2 pt-2">
          {(["Fee Defaulters", "By Class", "Individual"] as const).map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(i)}
              className={cn(
                "flex-1 rounded-t-lg px-2 py-2 text-xs font-medium transition sm:text-sm",
                tab === i
                  ? "bg-[var(--bg-surface-2)] text-[var(--text-primary)]"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {tab === 1 && (
            <div className="mb-2">
              <label className="text-xs text-slate-400">Class</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tab === 2 && (
            <input
              type="search"
              placeholder="Search student name…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            />
          )}

          <div className="flex items-center justify-between gap-2 pb-2">
            <button type="button" onClick={selectAllVisible} className="text-xs font-medium text-emerald-400 hover:underline">
              Select all ({tabStudents.length})
            </button>
            {(loadingFd && tab === 0) || (loadingClass && tab === 1) || (loadingSearch && tab === 2 && searchQ.length >= 2) ? (
              <span className="text-xs text-slate-500">Loading…</span>
            ) : null}
          </div>

          <ul className="space-y-2 pb-2">
            {tabStudents.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-500">
                {tab === 2 && searchQ.trim().length < 2 ? "Type at least 2 letters to search." : "No students found."}
              </li>
            )}
            {tabStudents.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/40 px-2 py-2 text-xs sm:text-[13px]"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="mt-1 shrink-0 rounded border-slate-500"
                  />
                  <span className="min-w-0 leading-snug">
                    <span className="font-medium text-[var(--text-primary)]">{s.full_name}</span>
                    <span className="text-slate-400"> — {s.className} — </span>
                    <span className="font-mono text-slate-300">{maskPhone(s.phone)}</span>
                    {tab === 0 && s.totalDue > 0 && (
                      <span className="text-emerald-400"> — {formatPkr(s.totalDue)}</span>
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={reminderSaving === s.id}
                  onClick={() => void toggleReminder(s.id, !s.whatsapp_reminders)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  title="Automatic WhatsApp reminders (Tuesday / Friday)"
                >
                  <span className={cn("h-2 w-2 rounded-full", s.whatsapp_reminders ? "bg-emerald-500" : "bg-red-500")} />
                  {reminderSaving === s.id ? "…" : `Auto MSG: ${s.whatsapp_reminders ? "ON" : "OFF"}`}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-slate-700 bg-[var(--bg-surface-2)] px-3 py-3">
          <textarea
            placeholder="Type message… use {name} for student name"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mb-2 w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-slate-500"
          />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TEMPLATE_CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setMessage(c.body)}
                className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={sending || selected.size === 0}
            onClick={() => void sendWebhook()}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: WHATSAPP_GREEN }}
          >
            {sending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending…
              </>
            ) : (
              `Send to ${selected.size} selected`
            )}
          </button>
        </div>
      </div>
    </>
  );
}

/** Floating WhatsApp widget + slide panel — wrap dashboard layout with this provider. */
export function WhatsAppAgentProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabaseClient();
  const [open, setOpen] = useState(false);
  const pendingPreset = useRef<string[]>([]);

  const openAgent = useCallback((opts?: WhatsAppAgentOpenOptions) => {
    pendingPreset.current = opts?.studentIds ?? [];
    setOpen(true);
  }, []);

  const closeAgent = useCallback(() => {
    setOpen(false);
    pendingPreset.current = [];
  }, []);

  const ctx = useMemo(() => ({ openAgent, closeAgent }), [openAgent, closeAgent]);

  return (
    <WhatsAppAgentContext.Provider value={ctx}>
      {children}
      {!open ? (
        <button
          type="button"
          aria-label="Open WhatsApp messaging"
          onClick={() => openAgent()}
          className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:scale-105 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white/40"
          style={{ backgroundColor: WHATSAPP_GREEN }}
        >
          <WhatsAppLogo className="h-8 w-8 text-white" />
        </button>
      ) : null}
      {open ? <WhatsAppPanel supabase={supabase} onClose={closeAgent} pendingPresetRef={pendingPreset} /> : null}
    </WhatsAppAgentContext.Provider>
  );
}
