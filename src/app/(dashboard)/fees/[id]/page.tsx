"use client";

import { useParams } from "next/navigation";
import { VoucherDetail } from "@/components/fees/VoucherDetail";

export default function FeeVoucherPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    return <p className="text-slate-400">Invalid voucher.</p>;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Voucher</h1>
      <VoucherDetail id={id} />
    </div>
  );
}
