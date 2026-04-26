"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

type Row = {
  id: string;
  title: string;
  content: string;
  target: string;
  created_at: string;
};

export default function AnnouncementsPage() {
  const supabase = useSupabaseClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<"all" | "teachers" | "students">("all");
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial list load
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const { error } = await supabase.from("announcements").insert({
      title,
      content,
      target,
      created_by: uid ?? null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Posted");
    setTitle("");
    setContent("");
    void load();
  };

  const remove = async (id: string) => {
    setDeleting(true);
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Announcement deleted");
    void load();
    setDeleteId(null);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Announcements</h1>

      <form onSubmit={submit} className="surface-card max-w-xl space-y-4 p-6">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label className="text-sm text-slate-300">Content</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm text-slate-300">Target</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={target}
            onChange={(e) => setTarget(e.target.value as typeof target)}
          >
            <option value="all">All</option>
            <option value="teachers">Teachers</option>
            <option value="students">Students</option>
          </select>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Posting…" : "Post"}
        </Button>
      </form>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="surface-card flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-semibold">{r.title}</h2>
              <p className="mt-1 text-sm text-slate-300">{r.content}</p>
              <p className="mt-2 text-xs text-slate-500">
                {new Date(r.created_at).toLocaleString()} · {r.target}
              </p>
            </div>
            <Button variant="danger" type="button" onClick={() => setDeleteId(r.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
      <Modal
        open={Boolean(deleteId)}
        title="Delete announcement?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => (deleteId ? void remove(deleteId) : undefined)}
        confirmLabel="Delete"
        loading={deleting}
      >
        <p className="text-slate-300">This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
