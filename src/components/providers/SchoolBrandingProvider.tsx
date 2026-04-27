"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";

export type SchoolBranding = {
  schoolName: string;
  logoUrl: string | null;
};

const DEFAULT_NAME = "NEW OXFORD GRAMMER SCHOOL";

const SchoolBrandingContext = createContext<SchoolBranding>({
  schoolName: DEFAULT_NAME,
  logoUrl: null,
});

export function SchoolBrandingProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabaseClient();
  const [branding, setBranding] = useState<SchoolBranding>({
    schoolName: DEFAULT_NAME,
    logoUrl: null,
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("school_name,logo_url,updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setBranding({
        schoolName: data?.school_name?.trim() || DEFAULT_NAME,
        logoUrl: data?.logo_url?.trim() || null,
      });
    };
    void load();
  }, [supabase]);

  const value = useMemo(() => branding, [branding]);

  return <SchoolBrandingContext.Provider value={value}>{children}</SchoolBrandingContext.Provider>;
}

export function useSchoolBranding() {
  return useContext(SchoolBrandingContext);
}

