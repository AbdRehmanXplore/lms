"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherSchema, type TeacherFormValues } from "@/lib/validations/teacherSchema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { currentSalaryMonthYear } from "@/lib/utils/salaryPeriod";

type ClassOption = { id: string; name: string };

type Props = {
  classes: ClassOption[];
  teacherId?: string;
  defaultValues?: Partial<TeacherFormValues>;
  suggestedEmployeeCode?: string;
};

export function TeacherForm({ classes, teacherId, defaultValues, suggestedEmployeeCode }: Props) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(defaultValues?.profilePhoto ?? "");
  const MAX_SIZE = 500 * 1024;
  const PHOTO_BUCKET = "school_Children_photos";

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      fullName: "",
      employeeCode: suggestedEmployeeCode ?? "TCH-001",
      email: "",
      phone: "",
      cnic: "",
      address: "",
      qualification: "",
      subject: "",
      classAssigned: "",
      salary: 0,
      joiningDate: new Date().toISOString().slice(0, 10),
      status: "active",
      profilePhoto: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (suggestedEmployeeCode && !teacherId) {
      form.setValue("employeeCode", suggestedEmployeeCode);
    }
  }, [suggestedEmployeeCode, teacherId, form]);

  useEffect(() => {
    setPhotoPreview(defaultValues?.profilePhoto ?? "");
    setSelectedPhotoFile(null);
  }, [defaultValues?.profilePhoto]);

  const extractStoragePath = (publicUrl: string) => {
    const marker = `/object/public/${PHOTO_BUCKET}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(publicUrl.slice(index + marker.length));
  };

  const uploadTeacherPhoto = async (currentTeacherId: string, file: File) => {
    const filePath = `teachers/${currentTeacherId}/${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(filePath, file);
    if (uploadError) {
      throw uploadError;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filePath);
    return publicUrl;
  };

  const onSubmit = async (values: TeacherFormValues) => {
    setLoading(true);
    try {
      if (selectedPhotoFile && selectedPhotoFile.size > MAX_SIZE) {
        toast.error("Photo must be under 500KB");
        return;
      }

      const payload = {
        name: values.fullName,
        full_name: values.fullName,
        employee_code: values.employeeCode,
        email: values.email,
        phone: values.phone,
        cnic: values.cnic || null,
        address: values.address || null,
        qualification: values.qualification || null,
        subject: values.subject,
        class_assigned: values.classAssigned || null,
        salary: values.salary,
        joining_date: values.joiningDate,
        status: values.status,
      };

      if (teacherId) {
        let nextPhotoUrl = defaultValues?.profilePhoto?.trim() || null;
        if (selectedPhotoFile) {
          const oldPath = nextPhotoUrl ? extractStoragePath(nextPhotoUrl) : null;
          if (oldPath) {
            const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
            if (removeError) {
              throw removeError;
            }
          }
          nextPhotoUrl = await uploadTeacherPhoto(teacherId, selectedPhotoFile);
        }
        const { error } = await supabase.from("teachers").update({ ...payload, profile_photo: nextPhotoUrl }).eq("id", teacherId);
        if (error) throw error;
        toast.success("Teacher updated");
      } else {
        const { data: inserted, error } = await supabase.from("teachers").insert(payload).select("id").single();
        if (error) throw error;
        const createdTeacherId = inserted.id as string;
        if (selectedPhotoFile) {
          const publicUrl = await uploadTeacherPhoto(createdTeacherId, selectedPhotoFile);
          const { error: updateError } = await supabase.from("teachers").update({ profile_photo: publicUrl }).eq("id", createdTeacherId);
          if (updateError) throw updateError;
        }
        const { month, year } = currentSalaryMonthYear();
        const { error: salaryErr } = await supabase.from("salary_records").upsert(
          {
            teacher_id: createdTeacherId,
            month,
            year,
            amount: values.salary,
            status: "unpaid" as const,
          },
          { onConflict: "teacher_id,month,year" },
        );
        if (salaryErr) {
          console.error(salaryErr);
          toast.error(`Teacher saved, but payroll row failed: ${salaryErr.message}`);
        } else {
          toast.success("Teacher created");
        }
      }
      router.push("/teachers");
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit(onSubmit)(e);
      }}
      className="surface-card mx-auto max-w-2xl space-y-4 p-6"
    >
      <h1 className="text-2xl font-semibold">{teacherId ? "Edit Teacher" : "Add Teacher"}</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Full Name *" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
        <Input label="Employee Code *" {...form.register("employeeCode")} error={form.formState.errors.employeeCode?.message} />
        <Input label="Email *" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="Phone *" {...form.register("phone")} error={form.formState.errors.phone?.message} />
        <Input label="CNIC" {...form.register("cnic")} />
        <Input label="Qualification" {...form.register("qualification")} />
        <Input label="Subject *" {...form.register("subject")} error={form.formState.errors.subject?.message} />
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Class Assigned</label>
          <select
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            {...form.register("classAssigned")}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Salary (PKR) *"
          type="number"
          step="0.01"
          {...form.register("salary", { valueAsNumber: true })}
          error={form.formState.errors.salary?.message}
        />
        <Input label="Joining Date *" type="date" {...form.register("joiningDate")} error={form.formState.errors.joiningDate?.message} />
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Status</label>
          <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2" {...form.register("status")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <Input label="Address" {...form.register("address")} />
      <div className="space-y-3 rounded-xl border border-slate-700 p-4">
        <p className="text-sm font-medium text-slate-200">Teacher Profile Photo</p>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line react-hooks/incompatible-library -- RHF watch() for live initials preview */}
          <ProfilePhoto src={photoPreview} alt="Teacher" name={form.watch("fullName")} size={72} />
          <label className="cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)]">
            Choose photo
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_SIZE) {
                  toast.error("Photo must be under 500KB");
                  e.currentTarget.value = "";
                  return;
                }
                setSelectedPhotoFile(file);
                setPhotoPreview(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">Max size: 500KB. Uploads to Supabase bucket: school_Children_photos</p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
