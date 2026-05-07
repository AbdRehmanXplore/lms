export type FeeLineItem = {
  feeType: string;
  amount: number;
  month?: string;
  status?: string;
  paymentDate?: string | null;
};

type VoucherLike = {
  fee_type?: string | null;
  amount?: number | null;
  month?: string | null;
  status?: string | null;
  payment_date?: string | null;
  line_items?: unknown;
};

export function normalizeFeeLineItems(voucher: VoucherLike): FeeLineItem[] {
  if (Array.isArray(voucher.line_items) && voucher.line_items.length > 0) {
    return voucher.line_items
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          feeType: String(row.feeType ?? row.fee_type ?? "Tuition"),
          amount: Number(row.amount ?? 0),
          month: typeof row.month === "string" ? row.month : voucher.month ?? undefined,
          status: typeof row.status === "string" ? row.status : voucher.status ?? undefined,
          paymentDate: typeof row.paymentDate === "string" ? row.paymentDate : voucher.payment_date ?? null,
        } satisfies FeeLineItem;
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }

  return [
    {
      feeType: voucher.fee_type ?? "Tuition",
      amount: Number(voucher.amount ?? 0),
      month: voucher.month ?? undefined,
      status: voucher.status ?? undefined,
      paymentDate: voucher.payment_date ?? null,
    },
  ];
}
