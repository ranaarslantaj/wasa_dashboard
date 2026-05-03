"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
} from "lucide-react";

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
import { cn } from "@/lib/cn";
import type { AccessLevel, Admin, AdminStatus } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?:\+?92|0)?3\d{9}$/;

interface AccessLevelMeta {
  value: AccessLevel;
  label: string;
  hint: string;
}

const ACCESS_LEVELS: AccessLevelMeta[] = [
  { value: "province", label: "Province", hint: "Sees everything in their province" },
  { value: "division", label: "Division", hint: "Limited to one division's districts" },
  { value: "district", label: "District", hint: "Limited to a single district" },
  { value: "tehsil",   label: "Tehsil",   hint: "Limited to a single tehsil" },
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
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setShowPassword(false);
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

  const handleAccessLevel = (next: AccessLevel) => {
    setForm((prev) => {
      const cleared = { ...prev, accessLevel: next };
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
    setErrors((prev) => ({
      ...prev,
      division: undefined,
      district: undefined,
      tehsil: undefined,
    }));
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

  const scopeChip = useMemo(() => {
    const parts: string[] = [form.province || "Punjab"];
    if (form.division) parts.push(form.division);
    if (form.district) parts.push(form.district);
    if (form.tehsil) parts.push(form.tehsil);
    return parts.join(" · ");
  }, [form.province, form.division, form.district, form.tehsil]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEdit ? "Edit admin" : "Add admin"}
      description={
        isEdit
          ? "Update an admin's contact details, scope, or status."
          : "Provision a new dashboard admin and assign their access scope."
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
            Scope: <span className="font-medium text-slate-700 dark:text-slate-200">{scopeChip}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button form="admin-form" type="submit" loading={saving}>
              {isEdit ? "Save changes" : "Create admin"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="admin-form" onSubmit={handleSubmit} className="space-y-6">
        {/* IDENTITY */}
        <Section
          icon={<User className="h-4 w-4" />}
          title="Identity"
          description="Basic profile information for the new admin."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Full name" error={errors.name} required>
              <IconInput
                icon={<User className="h-4 w-4" />}
                type="text"
                value={form.name}
                onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                placeholder="e.g. Hassan Ahmad"
                disabled={saving}
              />
            </Field>

            <Field
              label="Email address"
              error={errors.email}
              required
              hint={isEdit ? "Email cannot be changed for an existing admin." : undefined}
            >
              <IconInput
                icon={<Mail className="h-4 w-4" />}
                type="email"
                value={form.email}
                onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                placeholder="admin@example.com"
                disabled={saving || isEdit}
                autoComplete="email"
              />
            </Field>

            {!isEdit && (
              <Field
                label="Password"
                error={errors.password}
                required
                hint="At least 6 characters. Used by the admin to sign in."
              >
                <IconInput
                  icon={<KeyRound className="h-4 w-4" />}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(v) => setForm((p) => ({ ...p, password: v }))}
                  placeholder="Set a strong password"
                  disabled={saving}
                  autoComplete="new-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                />
              </Field>
            )}

            <Field label="Phone" error={errors.phone} hint="Optional. Pakistan mobile (03XXXXXXXXX).">
              <IconInput
                icon={<Phone className="h-4 w-4" />}
                type="tel"
                value={form.phone}
                onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                placeholder="03XXXXXXXXX"
                disabled={saving}
              />
            </Field>
          </div>
        </Section>

        {/* ACCESS LEVEL */}
        <Section
          icon={<Shield className="h-4 w-4" />}
          title="Access level"
          description="Controls what this admin sees across the dashboard."
        >
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {ACCESS_LEVELS.map((opt) => {
              const active = form.accessLevel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleAccessLevel(opt.value)}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-xs transition-colors",
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-900 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-100"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
                  )}
                  aria-pressed={active}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        active
                          ? "text-brand-700 dark:text-brand-200"
                          : "text-slate-900 dark:text-slate-100",
                      )}
                    >
                      {opt.label}
                    </span>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full border",
                        active
                          ? "border-brand-500 bg-brand-500"
                          : "border-slate-300 dark:border-slate-600",
                      )}
                      aria-hidden
                    />
                  </div>
                  <span
                    className={cn(
                      "leading-snug",
                      active
                        ? "text-brand-700/80 dark:text-brand-200/80"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                  >
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* GEOGRAPHIC SCOPE */}
        <Section
          icon={<MapPin className="h-4 w-4" />}
          title="Geographic scope"
          description="Where this admin's access applies. Required fields adjust to the chosen access level."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Province" error={errors.province} required>
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
            </Field>

            {requireDivision && (
              <Field label="Division" error={errors.division} required>
                <Dropdown
                  value={form.division}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      division: v,
                      district: "",
                      tehsil: "",
                    }))
                  }
                  options={[
                    { value: "", label: "Select division" },
                    ...divisionsAvailable.map((d) => ({ value: d, label: d })),
                  ]}
                  disabled={saving}
                />
              </Field>
            )}

            {requireDistrict && (
              <Field label="District" error={errors.district} required>
                <Dropdown
                  value={form.district}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, district: v, tehsil: "" }))
                  }
                  options={[
                    { value: "", label: "Select district" },
                    ...districtsAvailable.map((d) => ({ value: d, label: d })),
                  ]}
                  disabled={saving || !form.division}
                />
              </Field>
            )}

            {requireTehsil && (
              <Field label="Tehsil" error={errors.tehsil} required>
                <Dropdown
                  value={form.tehsil}
                  onChange={(v) => setForm((p) => ({ ...p, tehsil: v }))}
                  options={[
                    { value: "", label: "Select tehsil" },
                    ...tehsilsAvailable.map((t) => ({ value: t, label: t })),
                  ]}
                  disabled={saving || !form.district}
                />
              </Field>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">Effective scope:</span>{" "}
            {scopeChip}
          </div>
        </Section>

        {/* STATUS */}
        <Section
          icon={<Building2 className="h-4 w-4" />}
          title="Status"
          description="Inactive admins cannot sign in and are auto-signed out if currently online."
        >
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {(["active", "inactive"] as AdminStatus[]).map((s) => {
              const active = form.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, status: s }))}
                  disabled={saving}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? s === "active"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-700 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                  aria-pressed={active}
                >
                  {s === "active" ? "Active" : "Inactive"}
                </button>
              );
            })}
          </div>
        </Section>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local presentational helpers                                              */
/* -------------------------------------------------------------------------- */

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface IconInputProps {
  icon: ReactNode;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  trailing?: ReactNode;
}

function IconInput({
  icon,
  type,
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
  trailing,
}: IconInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className={cn(
          "block w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900",
          "focus:border-brand-500 focus:ring-brand-500",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      />
      {trailing && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {trailing}
        </span>
      )}
    </div>
  );
}

export default AdminFormModal;
