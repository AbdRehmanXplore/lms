"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SchoolLogo } from "@/components/shared/SchoolLogo";

const DEFAULT_NAME = "NEW OXFORD GRAMMER SCHOOL";
const MAX_SIZE = 500 * 1024;
const PHOTO_BUCKET = "school_Children_photos";

type SettingsRow = {
  id: string;
  school_name: string | null;
  logo_url: string | null;
};

export default function SettingsPage() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [rowId, setRowId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState(DEFAULT_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("id,school_name,logo_url,updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = data as SettingsRow | null;
      setRowId(row?.id ?? null);
      setSchoolName(row?.school_name?.trim() || DEFAULT_NAME);
      setLogoUrl(row?.logo_url?.trim() || null);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  const uploadLogo = async () => {
    if (!selectedLogo) return logoUrl;
    const filePath = `school/logo/${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(filePath, selectedLogo);
    if (uploadError) throw uploadError;
    const {
      data: { publicUrl },
    } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filePath);
    return publicUrl;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  const onSave = async () => {
    if (selectedLogo && selectedLogo.size > MAX_SIZE) {
      toast.error("Logo must be under 500KB");
      return;
    }

    setSaving(true);
    try {
      const nextLogoUrl = await uploadLogo();
      if (rowId) {
        const { error } = await supabase
          .from("school_settings")
          .update({
            school_name: schoolName.trim() || DEFAULT_NAME,
            logo_url: nextLogoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("school_settings")
          .insert({
            school_name: schoolName.trim() || DEFAULT_NAME,
            logo_url: nextLogoUrl,
          })
          .select("id")
          .single();
        if (error) throw error;
        setRowId((data as { id: string }).id);
      }
      setLogoUrl(nextLogoUrl ?? null);
      setSelectedLogo(null);
      setLogoPreview(null);
      toast.success("School branding saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400">Loading settings…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="surface-card max-w-2xl space-y-4 p-6">
        <h2 className="text-lg font-semibold">School Branding</h2>
        <Input label="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
        <div className="space-y-2 rounded-xl border border-slate-700 p-4">
          <p className="text-sm text-slate-300">School logo</p>
          <div className="flex items-center gap-4">
            <SchoolLogo size={72} logoUrl={logoPreview ?? logoUrl} />
            <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800">
              Choose logo
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_SIZE) {
                    toast.error("Logo must be under 500KB");
                    e.currentTarget.value = "";
                    return;
                  }
                  setSelectedLogo(file);
                  setLogoPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">Max size: 500KB. Upload path: school/logo/{`{timestamp}`}</p>
        </div>
        <Button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving..." : "Save Branding"}
        </Button>
      </div>

      <div className="surface-card max-w-2xl space-y-3 p-6">
        <h2 className="text-lg font-semibold">Session</h2>
        <p className="text-sm text-slate-400">Sign out of the management system. You can also use Log out in the sidebar.</p>
        <Button
          type="button"
          variant="secondary"
          className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          onClick={() => void signOut()}
        >
          <LogOut size={16} />
          Log out
        </Button>
      </div>
    </div>
  );
}
