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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(defaultValues?.profilePhoto ?? "");

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
  }, [defaultValues?.profilePhoto]);

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const key = `teacher-${teacherId ?? "new"}-${Date.now()}.${ext}`;
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

  const onSubmit = async (values: TeacherFormValues) => {
    setLoading(true);
    try {
      const photoUrl = values.profilePhoto?.trim() || null;

      const payload = {
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
        profile_photo: photoUrl,
      };

      if (teacherId) {
        const { error } = await supabase.from("teachers").update(payload).eq("id", teacherId);
        if (error) throw error;
        toast.success("Teacher updated");
      } else {
        const { error } = await supabase.from("teachers").insert(payload);
        if (error) throw error;
        const { error: salErr } = await supabase.rpc("generate_monthly_salaries", { p_month_year: null });
        if (salErr) console.warn("generate_monthly_salaries:", salErr.message);
        toast.success("Teacher created");
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
          <ProfilePhoto src={photoPreview} alt="Teacher" size={72} variant="card" />
          <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800">
            {uploadingPhoto ? "Uploading..." : "Upload from computer"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
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
