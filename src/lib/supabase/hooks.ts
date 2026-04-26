"use client";

import { useMemo } from "react";
import { createClient } from "./client";

export function useSupabaseClient() {
  return useMemo(() => createClient(), []);
}
