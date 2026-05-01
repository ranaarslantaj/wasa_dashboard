"use client";

import { useCallback, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Plus, Search, Shield } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";

import { AdminManagementGate } from "@/components/auth/AdminManagementGate";
import { AdminFormModal } from "@/components/admins/AdminFormModal";
import { AdminsTable } from "@/components/admins/AdminsTable";
import { DeleteWithPasswordModal } from "@/components/employees/DeleteWithPasswordModal";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useAdmins } from "@/hooks/useAdmins";
import { useDebounce } from "@/hooks/useDebounce";
import { auth, db } from "@/lib/firebase";
import {
  PROVINCES,
  getDivisionsForProvince,
  getDistrictsForDivision,
  getTehsilsForDistrict,
} from "@/constants/geography";
import type { AccessLevel, Admin, AdminStatus } from "@/types";

type LevelFilter = "" | AccessLevel;
type StatusFilter = "" | AdminStatus;

const ACCESS_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: "", label: "All access levels" },
  { value: "province", label: "Province" },
  { value: "division", label: "Division" },
  { value: "district", label: "District" },
  { value: "tehsil", label: "Tehsil" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function AdminManagementPage() {
  return (
    <AdminManagementGate>
      <AdminManagementInner />
    </AdminManagementGate>
  );
}

function AdminManagementInner() {
  const { admin: currentAdmin } = useAuth();
  const toast = useToast();

  const adminsFilters = useMemo(() => ({ limit: 1000 }), []);
  const { data: admins, loading, refetch } = useAdmins(adminsFilters);

  /* ------------------------------ Filter state ------------------------------ */
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [provinceFilter, setProvinceFilter] = useState<string>("");
  const [divisionFilter, setDivisionFilter] = useState<string>("");
  const [districtFilter, setDistrictFilter] = useState<string>("");
  const [tehsilFilter, setTehsilFilter] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const search = useDebounce(searchInput, 250);

  const divisionOpts = useMemo(
    () => [
      { value: "", label: "All divisions" },
      ...getDivisionsForProvince(provinceFilter || "Punjab").map((d) => ({
        value: d,
        label: d,
      })),
    ],
    [provinceFilter],
  );
  const districtOpts = useMemo(
    () => [
      { value: "", label: "All districts" },
      ...getDistrictsForDivision(divisionFilter).map((d) => ({
        value: d,
        label: d,
      })),
    ],
    [divisionFilter],
  );
  const tehsilOpts = useMemo(
    () => [
      { value: "", label: "All tehsils" },
      ...getTehsilsForDistrict(districtFilter).map((t) => ({
        value: t,
        label: t,
      })),
    ],
    [districtFilter],
  );

  /* ------------------------- Filtering / counts / page ---------------------- */
  const filteredAdmins = useMemo<Admin[]>(() => {
    const needle = search.trim().toLowerCase();
    return admins.filter((a) => {
      if (levelFilter && a.accessLevel !== levelFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (provinceFilter && (a.province || "") !== provinceFilter) return false;
      if (divisionFilter && (a.division || "") !== divisionFilter) return false;
      if (districtFilter && (a.district || "") !== districtFilter) return false;
      if (tehsilFilter && (a.tehsil || "") !== tehsilFilter) return false;
      if (needle) {
        const hay = [a.name, a.email, a.phone].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [
    admins,
    levelFilter,
    statusFilter,
    provinceFilter,
    divisionFilter,
    districtFilter,
    tehsilFilter,
    search,
  ]);

  const stats = useMemo(() => {
    const out = { total: 0, active: 0, inactive: 0, province: 0, division: 0, district: 0, tehsil: 0 };
    for (const a of filteredAdmins) {
      out.total++;
      if (a.status === "active") out.active++;
      else out.inactive++;
      if (a.accessLevel === "province") out.province++;
      else if (a.accessLevel === "division") out.division++;
      else if (a.accessLevel === "district") out.district++;
      else if (a.accessLevel === "tehsil") out.tehsil++;
    }
    return out;
  }, [filteredAdmins]);

  const [pageSize, setPageSize] = useState<number>(25);
  const [pageNum, setPageNum] = useState<number>(1);
  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / pageSize));
  const safePage = Math.min(pageNum, totalPages);
  const pageSlice = useMemo(
    () =>
      filteredAdmins.slice((safePage - 1) * pageSize, (safePage - 1) * pageSize + pageSize),
    [filteredAdmins, safePage, pageSize],
  );

  /* -------------------------------- Modals -------------------------------- */
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<Admin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<boolean>(false);

  const handleAdd = useCallback(() => {
    setEditTarget(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((a: Admin) => {
    setEditTarget(a);
    setFormOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    async (a: Admin): Promise<void> => {
      const next: AdminStatus = a.status === "active" ? "inactive" : "active";
      try {
        await updateDoc(doc(db, "WasaAdmins", a.id), {
          status: next,
          updatedAt: serverTimestamp(),
        });
        toast.show({
          type: "success",
          title: next === "active" ? "Admin activated" : "Admin deactivated",
        });
        refetch();
      } catch (err) {
        toast.show({
          type: "error",
          title: "Status change failed",
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [refetch, toast],
  );

  const performDelete = useCallback(
    async (password: string): Promise<void> => {
      if (!deleteTarget || !currentAdmin?.email) return;
      setDeleteBusy(true);
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");
        const cred = EmailAuthProvider.credential(currentAdmin.email, password);
        await reauthenticateWithCredential(user, cred);
        await deleteDoc(doc(db, "WasaAdmins", deleteTarget.id));
        toast.show({ type: "success", title: "Admin deleted" });
        setDeleteTarget(null);
        refetch();
      } catch (err) {
        toast.show({
          type: "error",
          title: "Delete failed",
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setDeleteBusy(false);
      }
    },
    [deleteTarget, currentAdmin, refetch, toast],
  );

  /* -------------------------------- Render -------------------------------- */
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <Shield className="h-6 w-6 text-brand-600" /> Admin Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create, edit, and deactivate dashboard admins. Each admin sees data
            scoped to the geographic level you assign here.
          </p>
        </div>
        <Button onClick={handleAdd} leftIcon={<Plus className="h-4 w-4" />}>
          New Admin
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatChip label="Total" value={stats.total} accent="brand" />
        <StatChip label="Active" value={stats.active} accent="emerald" />
        <StatChip label="Inactive" value={stats.inactive} accent="slate" />
        <StatChip label="Division" value={stats.division} accent="brand" />
        <StatChip label="District" value={stats.district} accent="emerald" />
        <StatChip label="Tehsil" value={stats.tehsil} accent="amber" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <FilterField label="Access level">
              <Dropdown
                value={levelFilter}
                onChange={(v) => setLevelFilter(v as LevelFilter)}
                options={ACCESS_OPTIONS}
              />
            </FilterField>
            <FilterField label="Status">
              <Dropdown
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={STATUS_OPTIONS}
              />
            </FilterField>
            <FilterField label="Province">
              <Dropdown
                value={provinceFilter}
                onChange={(v) => {
                  setProvinceFilter(v);
                  setDivisionFilter("");
                  setDistrictFilter("");
                  setTehsilFilter("");
                }}
                options={[
                  { value: "", label: "All provinces" },
                  ...PROVINCES.map((p) => ({ value: p, label: p })),
                ]}
              />
            </FilterField>
            <FilterField label="Division">
              <Dropdown
                value={divisionFilter}
                onChange={(v) => {
                  setDivisionFilter(v);
                  setDistrictFilter("");
                  setTehsilFilter("");
                }}
                options={divisionOpts}
              />
            </FilterField>
            <FilterField label="District">
              <Dropdown
                value={districtFilter}
                onChange={(v) => {
                  setDistrictFilter(v);
                  setTehsilFilter("");
                }}
                options={districtOpts}
                disabled={!divisionFilter}
              />
            </FilterField>
            <FilterField label="Tehsil">
              <Dropdown
                value={tehsilFilter}
                onChange={setTehsilFilter}
                options={tehsilOpts}
                disabled={!districtFilter}
              />
            </FilterField>
            <FilterField label="Search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, email, phone"
                  className="block w-full rounded-lg border-slate-300 bg-white pl-8 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </FilterField>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <AdminsTable
          admins={pageSlice}
          loading={loading}
          currentAdminId={currentAdmin?.id}
          onEdit={handleEdit}
          onToggleActive={handleToggleActive}
          onDelete={(a) => setDeleteTarget(a)}
        />
        {filteredAdmins.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={filteredAdmins.length}
              onPageChange={setPageNum}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPageNum(1);
              }}
            />
          </div>
        )}
      </Card>

      <AdminFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        admin={editTarget}
        onSaved={refetch}
      />

      <DeleteWithPasswordModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        employeeName={deleteTarget?.name ?? ""}
        loading={deleteBusy}
        onConfirm={performDelete}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "brand" | "emerald" | "amber" | "red" | "slate";
}) {
  const map: Record<string, string> = {
    brand: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${map[accent]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold">{value}</div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
