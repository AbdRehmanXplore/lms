"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";

type Defaulter = {
  student_id: string;
  full_name: string;
  roll_number: string;
  class_name: string;
  unpaid_months: number;
  total_unpaid: number;
};

export function useFeeDefaulters() {
  const supabase = useSupabaseClient();
  const [data, setData] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: rows, error } = await supabase.from("fee_defaulters").select("*");
      if (error) {
        setData([]);
        setLoading(false);
        return;
      }
      setData((rows ?? []) as Defaulter[]);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  return { data, loading };
}
