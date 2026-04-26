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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(defaultValues?.profilePhoto ?? "");

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
  }, [defaultValues?.profilePhoto]);

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const key = `${studentId ?? "new"}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(key, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(key);
      const url = data.publicUrl;
      form.setValue("profilePhoto", url, { shouldDirty: true, shouldValidate: true });
      setPhotoPreview(url);
      toast.success("Photo uploaded");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Photo upload failed";
      toast.error(msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSubmit = async (values: StudentFormValues) => {
    setLoading(true);
    try {
      const photoUrl = values.profilePhoto?.trim() || null;

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
        admission_date: values.admissionDate || null,
        profile_photo: photoUrl,
        status: values.status,
      };

      if (studentId) {
        const { error } = await supabase.from("students").update(payload).eq("id", studentId);
        if (error) throw error;
        toast.success("Student updated");
      } else {
        const { error } = await supabase.from("students").insert(payload);
        if (error) throw error;
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
            Admission Date
          </label>
          <input
            id="admissionDate"
            type="date"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-blue-500 focus:ring-2"
            {...form.register("admissionDate")}
          />
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
          <ProfilePhoto src={photoPreview} alt="Student" size={72} variant="card" />
          <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800">
            {uploadingPhoto ? "Uploading..." : "Upload from computer"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void uploadPhoto(file);
                }
              }}
            />
          </label>
        </div>
        <Input label="Profile photo URL" placeholder="Auto-filled from storage upload" {...form.register("profilePhoto")} />
        <p className="text-xs text-slate-500">Uploads to Supabase Storage bucket: avatars</p>
      </div>

      <Button type="submit" disabled={loading || uploadingPhoto}>
        {loading ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
