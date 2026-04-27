"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SchoolLogo } from "@/components/shared/SchoolLogo";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState("NEW OXFORD GRAMMER SCHOOL");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("school_settings")
      .select("school_name,logo_url,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setSchoolName(data?.school_name?.trim() || "NEW OXFORD GRAMMER SCHOOL");
        setLogoUrl(data?.logo_url?.trim() || null);
      });
  }, [supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success("Logged in successfully");
    router.refresh();
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6">
      <form onSubmit={onSubmit} className="surface-card w-full max-w-md space-y-4 border border-blue-500/30 p-6">
        <div className="mb-2 flex flex-col items-center text-center">
          <SchoolLogo size={100} logoUrl={logoUrl} />
          <h1 className="mt-3 text-xl font-bold tracking-wide">{schoolName}</h1>
          <p className="text-sm text-slate-400">School Management System</p>
        </div>
        <input
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2 font-medium hover:bg-blue-500 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
