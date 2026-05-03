"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studentSchema, type StudentFormValues } from "@/lib/validations/studentSchema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";

type ClassOption = { id: string; name: string };

type Props = {
  classes: ClassOption[];
  studentId?: string;
  defaultValues?: Partial<StudentFormValues>;
  suggestedRoll?: string;
  /** Permanent ID — display only, never editable */
  studentUid?: string | null;
};

export function StudentForm({ classes, studentId, defaultValues, suggestedRoll, studentUid }: Props) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(defaultValues?.profilePhoto ?? "");
  const MAX_SIZE = 500 * 1024;
  const PHOTO_BUCKET = "school_Children_photos";

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      rollNumber: suggestedRoll ?? "",
      fullName: "",
      fatherName: "",
      motherName: "",
      dateOfBirth: "",
      gender: "Male",
      classId: "",
      address: "",
      phone: "",
      email: "",
      admissionDate: new Date().toISOString().slice(0, 10),
      profilePhoto: "",
      status: "active",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (suggestedRoll && !studentId) {
      form.setValue("rollNumber", suggestedRoll);
    }
  }, [suggestedRoll, studentId, form]);

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

  const uploadStudentPhoto = async (currentStudentId: string, file: File) => {
    const filePath = `students/${currentStudentId}/${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(filePath, file);
    if (uploadError) {
      throw uploadError;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filePath);
    return publicUrl;
  };

  const getNextStudentUid = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("student_uid")
      .ilike("student_uid", "nogs-%");
    if (error) {
      throw error;
    }

    const maxSeq = (data ?? []).reduce((max, row) => {
      const uid = row.student_uid?.toLowerCase() ?? "";
      const match = /^nogs-(\d+)$/.exec(uid);
      if (!match) return max;
      const n = Number(match[1]);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);

    const next = maxSeq + 1;
    return `nogs-${String(next).padStart(2, "0")}`;
  };

  const onSubmit = async (values: StudentFormValues) => {
    setLoading(true);
    try {
      if (selectedPhotoFile && selectedPhotoFile.size > MAX_SIZE) {
        toast.error("Photo must be under 500KB");
        return;
      }

      const payload = {
        roll_number: values.rollNumber,
        full_name: values.fullName,
        father_name: values.fatherName,
        mother_name: values.motherName || null,
        date_of_birth: values.dateOfBirth,
        gender: values.gender,
        class_id: values.classId,
        address: values.address,
        phone: values.phone,
        email: values.email || null,
        admission_date: values.admissionDate,
        status: values.status,
      };

      if (studentId) {
        let nextPhotoUrl = defaultValues?.profilePhoto?.trim() || null;
        if (selectedPhotoFile) {
          const oldPath = nextPhotoUrl ? extractStoragePath(nextPhotoUrl) : null;
          if (oldPath) {
            const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
            if (removeError) {
              throw removeError;
            }
          }
          nextPhotoUrl = await uploadStudentPhoto(studentId, selectedPhotoFile);
        }

        const { error } = await supabase.from("students").update({ ...payload, profile_photo: nextPhotoUrl }).eq("id", studentId);
        if (error) throw error;
        toast.success("Student updated");
      } else {
        const nextStudentUid = await getNextStudentUid();
        const { data: inserted, error } = await supabase
          .from("students")
          .insert({ ...payload, student_uid: nextStudentUid })
          .select("id")
          .single();
        if (error) throw error;

        const createdStudentId = inserted.id as string;
        if (selectedPhotoFile) {
          const publicUrl = await uploadStudentPhoto(createdStudentId, selectedPhotoFile);
          const { error: updateError } = await supabase.from("students").update({ profile_photo: publicUrl }).eq("id", createdStudentId);
          if (updateError) throw updateError;
        }
        toast.success("Student created");
      }
      router.push("/students");
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
      <h1 className="text-2xl font-semibold">{studentId ? "Edit Student" : "Add Student"}</h1>
      {studentUid && (
        <p className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 font-mono text-sm text-blue-200">
          Student ID (permanent): {studentUid}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Roll Number *" {...form.register("rollNumber")} error={form.formState.errors.rollNumber?.message} />
        <Input label="Full Name *" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
        <Input label="Father Name *" {...form.register("fatherName")} error={form.formState.errors.fatherName?.message} />
        <Input label="Mother Name" {...form.register("motherName")} />
        <div className="space-y-1">
          <label htmlFor="dateOfBirth" className="text-sm text-slate-300">
            Date of Birth *
          </label>
          <input
            id="dateOfBirth"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-blue-500 focus:ring-2"
            {...form.register("dateOfBirth")}
          />
          {form.formState.errors.dateOfBirth && (
            <p className="text-xs text-red-400">{form.formState.errors.dateOfBirth.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Gender *</label>
          <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2" {...form.register("gender")}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Class *</label>
          <select
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            {...form.register("classId")}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {form.formState.errors.classId && (
            <p className="text-xs text-red-400">{form.formState.errors.classId.message}</p>
          )}
        </div>
        <Input label="Address *" {...form.register("address")} error={form.formState.errors.address?.message} />
        <Input label="Phone *" {...form.register("phone")} error={form.formState.errors.phone?.message} />
        <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <div className="space-y-1">
          <label htmlFor="admissionDate" className="text-sm text-slate-300">
            Admission Date *
          </label>
          <input
            id="admissionDate"
            type="date"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-blue-500 focus:ring-2"
            {...form.register("admissionDate")}
          />
          {form.formState.errors.admissionDate && (
            <p className="text-xs text-red-400">{form.formState.errors.admissionDate.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Status</label>
          <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2" {...form.register("status")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-700 p-4">
        <p className="text-sm font-medium text-slate-200">Student Profile Photo</p>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line react-hooks/incompatible-library -- RHF watch() for live initials preview */}
          <ProfilePhoto src={photoPreview} alt="Student" name={form.watch("fullName")} size={72} />
          <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800">
            Choose photo
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > MAX_SIZE) {
                    toast.error("Photo must be under 500KB");
                    e.currentTarget.value = "";
                    return;
                  }
                  setSelectedPhotoFile(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }
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
