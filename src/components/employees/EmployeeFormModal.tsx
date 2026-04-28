"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { createAuthUserForEmployee, db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Dropdown, MultiSelect } from "@/components/ui/Dropdown";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useUnionCouncils } from "@/hooks/useUnionCouncils";
import {
  PROVINCES,
  getDivisionsForProvince,
  getDistrictsForDivision,
  getTehsilsForDistrict,
} from "@/constants/geography";
import { DEPARTMENTS } from "@/constants/departments";
import {
  isDistrictLocked,
  isDivisionLocked,
  isTehsilLocked,
} from "@/lib/scope";
import type {
  ComplaintType,
  Department,
  WasaEmployee,
} from "@/types";

export interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  employee: WasaEmployee | null;
  complaintTypes: ComplaintType[];
  onSaved: () => void;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  cnic: string;
  designation: string;
  department: string;
  specialization: string[];
  province: string;
  division: string;
  district: string;
  tehsil: string;
  ucId: string;
  address: string;
  active: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNIC_RE = /^\d{5}-\d{7}-\d$/;
const PHONE_RE = /^(?:\+?92|0)?3\d{9}$/;

const DEFAULT_PROVINCE = "Punjab";

/** Hash a plaintext password using Web Crypto SHA-256.
 *
 *  NOTE: Placeholder only. The WASA employee mobile app will migrate to proper
 *  Firebase Auth on first login. We deliberately avoid creating an Auth user
 *  inline here because `createUserWithEmailAndPassword` would sign the new user
 *  into the dashboard, kicking the admin out. The spec accepts this trade-off
 *  (see §6.5 implementation notes) — real auth happens on the employee app.
 */
const sha256 = async (value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const buildInitialState = (
  employee: WasaEmployee | null,
  scopeProvince: string,
  scopeDivision: string,
  scopeDistrict: string,
  scopeTehsil: string,
): FormState => {
  if (employee) {
    return {
      name: employee.name ?? "",
      email: employee.email ?? "",
      password: "",
      phone: employee.phone ?? "",
      cnic: employee.cnic ?? "",
      designation: employee.designation ?? "",
      department: employee.department ?? "",
      specialization: Array.isArray(employee.specialization)
        ? employee.specialization
        : [],
      province: employee.province || scopeProvince || DEFAULT_PROVINCE,
      division: employee.division || scopeDivision || "",
      district: employee.district || scopeDistrict || "",
      tehsil: employee.tehsil || scopeTehsil || "",
      ucId: employee.ucId ?? "",
      address: employee.address ?? "",
      active: employee.active ?? true,
    };
  }
  return {
    name: "",
    email: "",
    password: "",
    phone: "",
    cnic: "",
    designation: "",
    department: "",
    specialization: [],
    province: scopeProvince || DEFAULT_PROVINCE,
    division: scopeDivision || "",
    district: scopeDistrict || "",
    tehsil: scopeTehsil || "",
    ucId: "",
    address: "",
    active: true,
  };
};

export function EmployeeFormModal({
  open,
  onClose,
  employee,
  complaintTypes,
  onSaved,
}: EmployeeFormModalProps) {
  const { adminScope } = useAuth();
  const toast = useToast();

  const isEdit = !!employee;

  // Scope-derived locks + baselines.
  const provinceLocked = !!adminScope && !adminScope.fullAccess;
  const divisionLocked = isDivisionLocked(adminScope);
  const districtLocked = isDistrictLocked(adminScope);
  const tehsilLocked = isTehsilLocked(adminScope);

  const scopeProvince = adminScope?.province || DEFAULT_PROVINCE;
  const scopeDivision = adminScope?.division ?? "";
  const scopeDistrict = adminScope?.district ?? "";
  const scopeTehsil = adminScope?.tehsil ?? "";

  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(
      employee,
      scopeProvince,
      scopeDivision,
      scopeDistrict,
      scopeTehsil,
    ),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [saving, setSaving] = useState<boolean>(false);

  // Reset state each time the modal opens or the target employee changes.
  useEffect(() => {
    if (!open) return;
    setForm(
      buildInitialState(
        employee,
        scopeProvince,
        scopeDivision,
        scopeDistrict,
        scopeTehsil,
      ),
    );
    setErrors({});
    setSaving(false);
  }, [
    open,
    employee,
    scopeProvince,
    scopeDivision,
    scopeDistrict,
    scopeTehsil,
  ]);

  // Cascading dropdown option lookups.
  const divisionOptions = useMemo(
    () => getDivisionsForProvince(form.province).map((d) => ({ value: d, label: d })),
    [form.province],
  );
  const districtOptions = useMemo(
    () => getDistrictsForDivision(form.division).map((d) => ({ value: d, label: d })),
    [form.division],
  );
  const tehsilOptions = useMemo(
    () => getTehsilsForDistrict(form.district).map((t) => ({ value: t, label: t })),
    [form.district],
  );

  // Union councils filtered by selected district/tehsil.
  const ucFilters = useMemo(() => {
    if (!form.district) return null;
    return {
      province: form.province || undefined,
      district: form.district,
      tehsil: form.tehsil || undefined,
    };
  }, [form.province, form.district, form.tehsil]);
  const { data: ucs } = useUnionCouncils(ucFilters);
  const ucOptions = useMemo(
    () => ucs.map((u) => ({ value: u.id, label: u.name })),
    [ucs],
  );

  const specializationOptions = useMemo(
    () => complaintTypes.map((ct) => ({ value: ct.key, label: ct.label })),
    [complaintTypes],
  );

  const departmentOptions = useMemo(
    () => DEPARTMENTS.map((d) => ({ value: d.value, label: d.label })),
    [],
  );

  const provinceOptions = useMemo(
    () => PROVINCES.map((p) => ({ value: p, label: p })),
    [],
  );

  // Cascading field setters that auto-clear children.
  const updateProvince = (v: string): void => {
    if (provinceLocked) return;
    setForm((prev) => ({
      ...prev,
      province: v,
      division: "",
      district: "",
      tehsil: "",
      ucId: "",
    }));
  };

  const updateDivision = (v: string): void => {
    if (divisionLocked) return;
    setForm((prev) => ({
      ...prev,
      division: v,
      district: "",
      tehsil: "",
      ucId: "",
    }));
  };

  const updateDistrict = (v: string): void => {
    if (districtLocked) return;
    setForm((prev) => ({
      ...prev,
      district: v,
      tehsil: "",
      ucId: "",
    }));
  };

  const updateTehsil = (v: string): void => {
    if (tehsilLocked) return;
    setForm((prev) => ({ ...prev, tehsil: v, ucId: "" }));
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
    if (!form.phone.trim()) next.phone = "Phone is required";
    else if (!PHONE_RE.test(form.phone.replace(/\s+/g, "")))
      next.phone = "Enter a valid Pakistan mobile number";
    if (form.cnic.trim() && !CNIC_RE.test(form.cnic.trim()))
      next.cnic = "CNIC must be in XXXXX-XXXXXXX-X format";
    if (!form.department) next.department = "Department is required";
    if (!form.district) next.district = "District is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    try {
      if (isEdit && employee) {
        await updateDoc(doc(db, "WasaEmployees", employee.id), {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          cnic: form.cnic.trim(),
          designation: form.designation.trim(),
          department: form.department as Department,
          specialization: form.specialization,
          province: form.province,
          division: form.division,
          district: form.district,
          tehsil: form.tehsil,
          ucId: form.ucId || null,
          address: form.address.trim(),
          active: form.active,
          updatedAt: serverTimestamp(),
        });
        toast.show({
          type: "success",
          title: "Employee updated",
        });
      } else {
        // Provision a Firebase Auth user via a secondary app so the admin's
        // primary session is not disturbed, then persist its uid alongside the profile.
        const email = form.email.trim().toLowerCase();
        const uid = await createAuthUserForEmployee(email, form.password);
        const hashed = await sha256(form.password);
        await addDoc(collection(db, "WasaEmployees"), {
          uid,
          name: form.name.trim(),
          email,
          phone: form.phone.trim(),
          password: hashed,
          cnic: form.cnic.trim(),
          designation: form.designation.trim(),
          department: form.department as Department,
          specialization: form.specialization,
          province: form.province,
          division: form.division,
          district: form.district,
          tehsil: form.tehsil,
          ucId: form.ucId || null,
          address: form.address.trim(),
          active: form.active,
          currentAssignments: 0,
          totalResolved: 0,
          lastLogin: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.show({
          type: "success",
          title: "Employee created",
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save employee";
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
      onClose={saving ? () => undefined : onClose}
      title={isEdit ? "Edit Employee" : "New Employee"}
      size="xl"
      closeOnOverlay={!saving}
      closeOnEsc={!saving}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Name, Email */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="emp-name" className={fieldLabel}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="emp-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputBase}
              autoComplete="off"
            />
            {errors.name && <p className={errorText}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="emp-email" className={fieldLabel}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="emp-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className={inputBase}
              autoComplete="off"
            />
            {errors.email && <p className={errorText}>{errors.email}</p>}
          </div>
        </div>

        {/* Row 2: Password (create only), Phone */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="emp-password" className={fieldLabel}>
              Password
              {!isEdit && <span className="text-red-500"> *</span>}
            </label>
            <input
              id="emp-password"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              className={inputBase}
              autoComplete="new-password"
              disabled={isEdit}
              placeholder={isEdit ? "Password changes are out of scope" : ""}
            />
            {errors.password && <p className={errorText}>{errors.password}</p>}
          </div>
          <div>
            <label htmlFor="emp-phone" className={fieldLabel}>
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              id="emp-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className={inputBase}
              autoComplete="off"
              placeholder="03XXXXXXXXX"
            />
            {errors.phone && <p className={errorText}>{errors.phone}</p>}
          </div>
        </div>

        {/* Row 3: CNIC, Designation */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="emp-cnic" className={fieldLabel}>
              CNIC
            </label>
            <input
              id="emp-cnic"
              type="text"
              value={form.cnic}
              onChange={(e) => setForm((p) => ({ ...p, cnic: e.target.value }))}
              className={inputBase}
              autoComplete="off"
              placeholder="XXXXX-XXXXXXX-X"
            />
            {errors.cnic && <p className={errorText}>{errors.cnic}</p>}
          </div>
          <div>
            <label htmlFor="emp-designation" className={fieldLabel}>
              Designation
            </label>
            <input
              id="emp-designation"
              type="text"
              value={form.designation}
              onChange={(e) =>
                setForm((p) => ({ ...p, designation: e.target.value }))
              }
              className={inputBase}
              autoComplete="off"
              placeholder="e.g. Field Officer"
            />
          </div>
        </div>

        {/* Row 4: Department, Specializations */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="emp-department" className={fieldLabel}>
              Department <span className="text-red-500">*</span>
            </label>
            <Dropdown
              id="emp-department"
              value={form.department}
              onChange={(v) => setForm((p) => ({ ...p, department: v }))}
              options={departmentOptions}
              placeholder="Select department"
            />
            {errors.department && (
              <p className={errorText}>{errors.department}</p>
            )}
          </div>
          <div>
            <label className={fieldLabel}>Specializations</label>
            <MultiSelect
              value={form.specialization}
              onChange={(v) => setForm((p) => ({ ...p, specialization: v }))}
              options={specializationOptions}
              placeholder="Select specializations"
            />
          </div>
        </div>

        {/* Row 5a: Province, Division */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={fieldLabel}>Province</label>
            <Dropdown
              value={form.province}
              onChange={updateProvince}
              options={provinceOptions}
              placeholder="Select province"
              locked={provinceLocked}
            />
          </div>
          <div>
            <label className={fieldLabel}>Division</label>
            <Dropdown
              value={form.division}
              onChange={updateDivision}
              options={divisionOptions}
              placeholder="Select division"
              locked={divisionLocked}
            />
          </div>
        </div>

        {/* Row 5b: District, Tehsil */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={fieldLabel}>
              District <span className="text-red-500">*</span>
            </label>
            <Dropdown
              value={form.district}
              onChange={updateDistrict}
              options={districtOptions}
              placeholder="Select district"
              locked={districtLocked}
            />
            {errors.district && <p className={errorText}>{errors.district}</p>}
          </div>
          <div>
            <label className={fieldLabel}>Tehsil</label>
            <Dropdown
              value={form.tehsil}
              onChange={updateTehsil}
              options={tehsilOptions}
              placeholder="Select tehsil"
              locked={tehsilLocked}
              disabled={!form.district}
            />
          </div>
        </div>

        {/* Row 6: UC */}
        <div>
          <label className={fieldLabel}>Union Council</label>
          <Dropdown
            value={form.ucId}
            onChange={(v) => setForm((p) => ({ ...p, ucId: v }))}
            options={ucOptions}
            placeholder={
              !form.district
                ? "Select district first"
                : ucOptions.length === 0
                ? "No UCs available"
                : "Select UC (optional)"
            }
            disabled={!form.district || ucOptions.length === 0}
          />
        </div>

        {/* Row 7: Address + Active */}
        <div>
          <label htmlFor="emp-address" className={fieldLabel}>
            Address
          </label>
          <textarea
            id="emp-address"
            rows={2}
            value={form.address}
            onChange={(e) =>
              setForm((p) => ({ ...p, address: e.target.value }))
            }
            className={inputBase}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) =>
              setForm((p) => ({ ...p, active: e.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Active
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isEdit ? "Save changes" : "Create employee"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default EmployeeFormModal;
