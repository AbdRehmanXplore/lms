import { AttendanceMarking } from "@/components/attendance/AttendanceMarking";

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mark attendance</h1>
      <AttendanceMarking />
    </div>
  );
}
