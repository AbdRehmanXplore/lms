export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string; email: string; role: "admin" | "teacher" };
      };
      teachers: { Row: { id: string; employee_code: string; subject: string; status: "active" | "inactive" } };
      students: { Row: { id: string; roll_number: string; full_name: string; father_name: string } };
      fee_vouchers: {
        Row: {
          id: string;
          voucher_number: string;
          amount: number;
          status: "paid" | "unpaid" | "overdue" | "partial";
          amount_paid?: number | null;
          remaining_amount?: number | null;
          is_partial?: boolean | null;
        };
      };
      attendance: { Row: { id: string; student_id: string; status: "present" | "absent" | "late"; date: string } };
      results: { Row: { id: string; student_id: string; class_id: string; exam_type: string; marks_obtained: number } };
    };
    Views: {
      fee_defaulters: {
        Row: { student_id: string; full_name: string; class_name: string; unpaid_months: number; total_unpaid: number };
      };
    };
  };
};
