"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";

export function UserMenu() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setFullName(data?.full_name ?? null);
    })();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  const initial = (fullName ?? email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mt-auto border-t border-[var(--border)] pt-4">
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue)]/20 text-sm font-bold text-[var(--accent-blue)]"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{fullName ?? "Admin"}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">{email ?? "Signed in"}</p>
        </div>
      </div>
      <Button variant="ghost" type="button" className="w-full justify-start gap-2" onClick={() => void signOut()}>
        <LogOut size={16} />
        Log out
      </Button>
    </div>
  );
}
