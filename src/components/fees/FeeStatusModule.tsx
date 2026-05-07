"use client";

import { useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizeFeeLineItems } from "@/lib/utils/feeLineItems";
import { formatCurrency } from "@/lib/utils/formatCurrency";

type StudentRow = {
  id: string;
  full_name: string;
  father_name: string;
  gr_number: string | null;
  section: string | null;
  classes: { name: string } | { name: string }[] | null;
};

type VoucherRow = {
  id: string;
  month: string;
  fee_type: string | null;
  amount: number;
  status: string;
  payment_date: string | null;
  line_items: unknown;
};

type StatusRow = {
  key: string;
  month: string;
  feeType: string;
  amount: number;
  status: string;
  paidDate: string | null;
};

export function FeeStatusModule() {
  const supabase = useSupabaseClient();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const [sectionCode, setSectionCode] = useState("KG");
  const [grNumber, setGrNumber] = useState("");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [printMode, setPrintMode] = useState<"all" | "highlighted">("all");

  const visibleRows = useMemo(
    () => (printMode === "highlighted" ? rows.filter((row) => selectedKeys.includes(row.key)) : rows),
    [printMode, rows, selectedKeys],
  );

  const searchStudent = async () => {
    const lookup = grNumber.trim().toUpperCase();
    if (!lookup) {
      toast.error("Enter a GR number");
      return;
    }
    if (!lookup.startsWith(`${sectionCode}-`)) {
      toast.error("Section code and GR number must match");
      return;
    }

    const { data: studentData } = await supabase
      .from("students")
      .select("id,full_name,father_name,gr_number,section,classes(name)")
      .eq("gr_number", lookup)
      .maybeSingle();

    if (!studentData) {
      toast.error("Student not found");
      setStudent(null);
      setRows([]);
      return;
    }

    const { data: vouchers } = await supabase
      .from("fee_vouchers")
      .select("id,month,fee_type,amount,status,payment_date,line_items")
      .eq("student_id", studentData.id)
      .order("issue_date", { ascending: false });

    const expandedRows: StatusRow[] = [];
    for (const voucher of (vouchers ?? []) as VoucherRow[]) {
      const items = normalizeFeeLineItems(voucher);
      items.forEach((item, index) => {
        expandedRows.push({
          key: `${voucher.id}-${index}`,
          month: item.month ?? voucher.month,
          feeType: item.feeType,
          amount: Number(item.amount),
          status: voucher.status.toUpperCase(),
          paidDate: voucher.payment_date,
        });
      });
    }

    setStudent(studentData as StudentRow);
    setRows(expandedRows);
    setSelectedKeys([]);
  };

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  return (
    <div className="space-y-6">
      <div className="surface-card space-y-4 p-6">
        <div className="grid gap-4 md:grid-cols-[180px_1fr_auto]">
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Section Code</label>
            <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2" value={sectionCode} onChange={(e) => setSectionCode(e.target.value)}>
              <option value="KG">KG</option>
              <option value="PP">PP</option>
              <option value="SS">SS</option>
            </select>
          </div>
          <Input label="GR#" placeholder="KG-001" value={grNumber} onChange={(e) => setGrNumber(e.target.value.toUpperCase())} />
          <div className="flex items-end">
            <Button type="button" onClick={() => void searchStudent()}>
              Search Student
            </Button>
          </div>
        </div>
      </div>

      {student && (
        <div className="surface-card p-4 text-sm">
          <p className="font-semibold text-white">{student.full_name}</p>
          <p className="text-slate-400">
            GR#: <span className="font-mono text-amber-300">{student.gr_number ?? "—"}</span> · Father: {student.father_name} · Class:{" "}
            {Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name ?? "—"} · Section: {student.section ?? "A"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => { setPrintMode("highlighted"); void handlePrint(); }} disabled={selectedKeys.length === 0}>
          Print Highlighted
        </Button>
        <Button type="button" onClick={() => { setPrintMode("all"); void handlePrint(); }} disabled={rows.length === 0}>
          Print All
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-800/90 text-slate-300">
            <tr>
              <th className="p-3">Fee Month</th>
              <th className="p-3">Fee Type</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`cursor-pointer border-t border-slate-700 ${selectedKeys.includes(row.key) ? "bg-yellow-500/40" : ""}`}
                onClick={() => toggleRow(row.key)}
              >
                <td className="p-3">{row.month}</td>
                <td className="p-3">{row.feeType}</td>
                <td className="p-3">{formatCurrency(row.amount)}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">{row.paidDate ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={5}>
                  Search a student by matching section code and GR number.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div ref={printRef} className="print-only bg-white p-6 text-black">
        <div className="mx-auto max-w-2xl border border-black">
          <div className="border-b border-black px-4 py-3 text-center">
            <p className="text-xl font-bold">New Oxford Grammar School</p>
            <p>B-160, Sector 11-A, North Karachi</p>
            <p>03409756551, Campus III</p>
          </div>
          <div className="border-b border-black px-4 py-2 text-center text-lg font-semibold">Student Fee Receipt</div>
          <div className="border-b border-black px-4 py-3 text-sm">
            <p><strong>GR#:</strong> {student?.gr_number ?? "—"}</p>
            <p><strong>Student:</strong> {student?.full_name ?? "—"}</p>
            <p><strong>Father:</strong> {student?.father_name ?? "—"}</p>
            <p><strong>Class:</strong> {Array.isArray(student?.classes) ? student?.classes[0]?.name : student?.classes?.name ?? "—"} · <strong>Section:</strong> {student?.section ?? "A"}</p>
            <p><strong>Receipt Date:</strong> {new Date().toLocaleDateString("en-GB")} <strong className="ml-2">Time:</strong> {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-r border-black px-3 py-2 text-left">Fee Month</th>
                <th className="border-b border-r border-black px-3 py-2 text-left">Fee Type</th>
                <th className="border-b border-black px-3 py-2">Fee Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key}>
                  <td className="border-b border-r border-black px-3 py-2">{row.month}</td>
                  <td className="border-b border-r border-black px-3 py-2">{row.feeType}</td>
                  <td className="border-b border-black px-3 py-2 text-center">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-b border-black px-4 py-2 text-sm font-semibold">
            Grand Total: PKR {visibleRows.reduce((sum, row) => sum + row.amount, 0).toLocaleString()}/-
          </div>
          <div className="px-4 py-3 text-sm">
            <p>Received by School</p>
            <p>Note: Computer generated voucher does not require a signature.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
