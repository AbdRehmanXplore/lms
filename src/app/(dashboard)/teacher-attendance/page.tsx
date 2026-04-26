import { TeacherAttendanceModule } from "@/components/teacher-attendance/TeacherAttendanceModule";

export default function TeacherAttendancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Teacher attendance</h1>
      <TeacherAttendanceModule />
    </div>
  );
}
