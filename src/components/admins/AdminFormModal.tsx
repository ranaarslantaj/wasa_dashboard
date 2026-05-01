"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/context/ToastContext";
import { createAuthUser, db } from "@/lib/firebase";
import {
  PROVINCES,
  getDivisionsForProvince,
  getDistrictsForDivision,
  getTehsilsForDistrict,
} from "@/constants/geography";
import type { AccessLevel, Admin, AdminStatus } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?:\+?92|0)?3\d{9}$/;

const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "province", label: "Province" },
  { value: "division", label: "Division" },
  { value: "district", label: "District" },
  { value: "tehsil", label: "Tehsil" },
];

export interface AdminFormModalProps {
  open: boolean;
  onClose: () => void;
  admin: Admin | null;
  onSaved: () => void;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  accessLevel: AccessLevel;
  province: string;
  division: string;
  district: string;
  tehsil: string;
  status: AdminStatus;
}

const emptyForm = (): FormState => ({
  name: "",
  email: "",
  password: "",
  phone: "",
  accessLevel: "district",
  province: "Punjab",
  division: "",
  district: "",
  tehsil: "",
  status: "active",
});

const formFromAdmin = (a: Admin): FormState => ({
  name: a.name ?? "",
  email: a.email ?? "",
  password: "",
  phone: a.phone ?? "",
  accessLevel: a.accessLevel ?? "district",
  province: a.province || "Punjab",
  division: a.division ?? "",
  district: a.district ?? "",
  tehsil: a.tehsil ?? "",
  status: a.status ?? "active",
});

export function AdminFormModal({
  open,
  onClose,
  admin,
  onSaved,
}: AdminFormModalProps) {
  const isEdit = !!admin;
  const toast = useToast();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(admin ? formFromAdmin(admin) : emptyForm());
  }, [admin, open]);

  const divisionsAvailable = useMemo(
    () => getDivisionsForProvince(form.province),
    [form.province],
  );
  const districtsAvailable = useMemo(
    () => getDistrictsForDivision(form.division),
    [form.division],
  );
  const tehsilsAvailable = useMemo(
    () => getTehsilsForDistrict(form.district),
    [form.district],
  );

  const requireDivision =
    form.accessLevel === "division" ||
    form.accessLevel === "district" ||
    form.accessLevel === "tehsil";
  const requireDistrict =
    form.accessLevel === "district" || form.accessLevel === "tehsil";
  const requireTehsil = form.accessLevel === "tehsil";

  const handleAccessLevel = (v: string) => {
    const next = v as AccessLevel;
    setForm((prev) => {
      const cleared = {
        ...prev,
        accessLevel: next,
      };
      // Drop fields that are not relevant for the new access level.
      if (next === "province") {
        cleared.division = "";
        cleared.district = "";
        cleared.tehsil = "";
      } else if (next === "division") {
        cleared.district = "";
        cleared.tehsil = "";
      } else if (next === "district") {
        cleared.tehsil = "";
      }
      return cleared;
    });
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(form.email.trim()))
      next.email = "Enter a valid email address";
    if (!isEdit && !form.password) next.password = "Password is required";
    else if (!isEdit && form.password.length < 6)
      next.password = "Password must be at least 6 characters";
    if (form.phone.trim() && !PHONE_RE.test(form.phone.replace(/\s+/g, "")))
      next.phone = "Enter a valid Pakistan mobile number";
    if (!form.province) next.province = "Province is required";
    if (requireDivision && !form.division)
      next.division = "Division is required for this access level";
    if (requireDistrict && !form.district)
      next.district = "District is required for this access level";
    if (requireTehsil && !form.tehsil)
      next.tehsil = "Tehsil is required for this access level";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
    try {
      const email = form.email.trim().toLowerCase();
      const sharedFields = {
        name: form.name.trim(),
        email,
        phone: form.phone.trim(),
        accessLevel: form.accessLevel,
        province: form.province,
        division: requireDivision ? form.division : null,
        district: requireDistrict ? form.district : null,
        tehsil: requireTehsil ? form.tehsil : null,
        status: form.status,
        updatedAt: serverTimestamp(),
      };

      if (isEdit && admin) {
        await updateDoc(doc(db, "WasaAdmins", admin.id), sharedFields);
        toast.show({ type: "success", title: "Admin updated" });
      } else {
        // Provision a Firebase Auth user via secondary app so the current
        // super-admin session is not disturbed; persist its uid on the doc.
        const uid = await createAuthUser(email, form.password);
        await addDoc(collection(db, "WasaAdmins"), {
          ...sharedFields,
          uid,
          password: "",
          createdAt: serverTimestamp(),
          lastLogin: null,
        });
        toast.show({ type: "success", title: "Admin created" });
      }
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save admin";
      toast.show({ type: "error", title: message });
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel =
    "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200";
  const inputBase =
    "block w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed";
  const errorText = "mt-1 text-xs text-red-600 dark:text-red-400";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEdit ? "Edit admin" : "Add admin"}
      description={
        isEdit
          ? "Update an admin's scope, contact details, or status."
          : "Provision a new dashboard admin and assign their access scope."
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button form="admin-form" type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create admin"}
          </Button>
        </div>
      }
    >
      <form
        id="admin-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <div>
          <label className={fieldLabel}>Name</label>
          <input
            type="text"
            className={inputBase}
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
            disabled={saving}
          />
          {errors.name && <p className={errorText}>{errors.name}</p>}
        </div>

        <div>
          <label className={fieldLabel}>Email</label>
          <input
            type="email"
            className={inputBase}
            value={form.email}
            onChange={(e) =>
              setForm((p) => ({ ...p, email: e.target.value }))
            }
            disabled={saving || isEdit}
            placeholder="admin@example.com"
          />
          {errors.email && <p className={errorText}>{errors.email}</p>}
          {isEdit && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Email cannot be changed for an existing admin.
            </p>
          )}
        </div>

        {!isEdit && (
          <div>
            <label className={fieldLabel}>Password</label>
            <input
              type="password"
              className={inputBase}
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              disabled={saving}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            {errors.password && (
              <p className={errorText}>{errors.password}</p>
            )}
          </div>
        )}

        <div>
          <label className={fieldLabel}>Phone</label>
          <input
            type="tel"
            className={inputBase}
            value={form.phone}
            onChange={(e) =>
              setForm((p) => ({ ...p, phone: e.target.value }))
            }
            disabled={saving}
            placeholder="03XXXXXXXXX"
          />
          {errors.phone && <p className={errorText}>{errors.phone}</p>}
        </div>

        <div className="md:col-span-2">
          <label className={fieldLabel}>Access level</label>
          <Dropdown
            value={form.accessLevel}
            onChange={handleAccessLevel}
            options={ACCESS_LEVELS}
            disabled={saving}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Province admins see everything. Lower levels are restricted to the
            geography below.
          </p>
        </div>

        <div>
          <label className={fieldLabel}>Province</label>
          <Dropdown
            value={form.province}
            onChange={(v) =>
              setForm((p) => ({
                ...p,
                province: v,
                division: "",
                district: "",
                tehsil: "",
              }))
            }
            options={PROVINCES.map((p) => ({ value: p, label: p }))}
            disabled={saving}
          />
          {errors.province && <p className={errorText}>{errors.province}</p>}
        </div>

        <div>
          <label className={fieldLabel}>
            Division{requireDivision && " *"}
          </label>
          <Dropdown
            value={form.division}
            onChange={(v) =>
              setForm((p) => ({ ...p, division: v, district: "", tehsil: "" }))
            }
            options={[
              { value: "", label: requireDivision ? "Select division" : "—" },
              ...divisionsAvailable.map((d) => ({ value: d, label: d })),
            ]}
            disabled={saving || !requireDivision}
          />
          {errors.division && <p className={errorText}>{errors.division}</p>}
        </div>

        <div>
          <label className={fieldLabel}>
            District{requireDistrict && " *"}
          </label>
          <Dropdown
            value={form.district}
            onChange={(v) =>
              setForm((p) => ({ ...p, district: v, tehsil: "" }))
            }
            options={[
              { value: "", label: requireDistrict ? "Select district" : "—" },
              ...districtsAvailable.map((d) => ({ value: d, label: d })),
            ]}
            disabled={saving || !requireDistrict || !form.division}
          />
          {errors.district && <p className={errorText}>{errors.district}</p>}
        </div>

        <div>
          <label className={fieldLabel}>
            Tehsil{requireTehsil && " *"}
          </label>
          <Dropdown
            value={form.tehsil}
            onChange={(v) => setForm((p) => ({ ...p, tehsil: v }))}
            options={[
              { value: "", label: requireTehsil ? "Select tehsil" : "—" },
              ...tehsilsAvailable.map((t) => ({ value: t, label: t })),
            ]}
            disabled={saving || !requireTehsil || !form.district}
          />
          {errors.tehsil && <p className={errorText}>{errors.tehsil}</p>}
        </div>

        <div className="md:col-span-2">
          <label className={fieldLabel}>Status</label>
          <Dropdown
            value={form.status}
            onChange={(v) =>
              setForm((p) => ({ ...p, status: v as AdminStatus }))
            }
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            disabled={saving}
          />
        </div>
      </form>
    </Modal>
  );
}

export default AdminFormModal;
