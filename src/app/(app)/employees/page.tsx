"use client";

import { useCallback, useMemo, useState } from "react";
import {
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  UserCog,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useFilters, useActiveFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import { useWasaEmployees } from "@/hooks/useWasaEmployees";
import { useComplaintTypes } from "@/hooks/useComplaintTypes";
import { useDebounce } from "@/hooks/useDebounce";
import { DEPARTMENTS } from "@/constants/departments";
import { exportToPdf } from "@/lib/exportPdf";
import { exportToExcel } from "@/lib/exportExcel";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";

import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { EmployeesTable } from "@/components/employees/EmployeesTable";
import { DeleteWithPasswordModal } from "@/components/employees/DeleteWithPasswordModal";
import {
  ExportConfirmModal,
  type ExportFormat,
} from "@/components/complaints/ExportConfirmModal";

import type { WasaEmployee } from "@/types";

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const EXPORT_COLUMNS: { header: string; dataKey: string; width?: number }[] = [
  { header: "Name", dataKey: "name", width: 22 },
  { header: "Designation", dataKey: "designation", width: 20 },
  { header: "Department", dataKey: "department", width: 18 },
  { header: "Email", dataKey: "email", width: 26 },
  { header: "Phone", dataKey: "phone", width: 16 },
  { header: "CNIC", dataKey: "cnic", width: 18 },
  { header: "District", dataKey: "district", width: 16 },
  { header: "Tehsil", dataKey: "tehsil", width: 16 },
  { header: "Status", dataKey: "active", width: 10 },
  { header: "Active Assignments", dataKey: "currentAssignments", width: 10 },
  { header: "Total Resolved", dataKey: "totalResolved", width: 10 },
];

export default function EmployeesPage() {
  const { admin } = useAuth();
  const toast = useToast();
  const filterCtx = useFilters();
  const f = useActiveFilters();

  // Local filters (not in shared FilterContext).
  const [localDepartment, setLocalDepartment] = useState<string>("");
  const [localSpecialization, setLocalSpecialization] = useState<string>("");
  const [localStatus, setLocalStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Modal state.
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<WasaEmployee | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<WasaEmployee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  // Pagination state.
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Employee filters → hook input.
  const employeeFilters = useMemo(
    () => ({
      scopeDistricts: f.scopeDistricts,
      district: f.district || undefined,
      tehsil: f.tehsil || undefined,
      department: localDepartment || undefined,
      specialization: localSpecialization || undefined,
      activeOnly: localStatus === "active",
    }),
    [
      f.scopeDistricts,
      f.district,
      f.tehsil,
      localDepartment,
      localSpecialization,
      localStatus,
    ],
  );

  const { data: employees, loading, refetch } =
    useWasaEmployees(employeeFilters);

  // Load complaint types (active) for specialization filter + form.
  const { data: complaintTypes } = useComplaintTypes({ activeOnly: true });

  // Status filter also needs to handle "inactive": hook only handles activeOnly.
  // Apply inactive + search filter client-side.
  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (localStatus === "inactive") {
      list = list.filter((e) => !e.active);
    }
    const term = debouncedSearch.trim().toLowerCase();
    if (term) {
      list = list.filter((e) => {
        return (
          (e.name ?? "").toLowerCase().includes(term) ||
          (e.email ?? "").toLowerCase().includes(term) ||
          (e.phone ?? "").toLowerCase().includes(term) ||
          (e.designation ?? "").toLowerCase().includes(term) ||
          (e.cnic ?? "").toLowerCase().includes(term)
        );
      });
    }
    return list;
  }, [employees, localStatus, debouncedSearch]);

  // Stats.
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.active).length;
    const inactive = total - active;
    const overloaded = employees.filter(
      (e) => (e.currentAssignments ?? 0) >= 10,
    ).length;
    return { total, active, inactive, overloaded };
  }, [employees]);

  // Paginated slice.
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () =>
      filteredEmployees.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize,
      ),
    [filteredEmployees, safePage, pageSize],
  );

  /* -------------------------------- Handlers ------------------------------- */

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (emp: WasaEmployee) => {
    setEditTarget(emp);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  const handleToggleActive = useCallback(
    async (emp: WasaEmployee): Promise<void> => {
      try {
        await updateDoc(doc(db, "WasaEmployees", emp.id), {
          active: !emp.active,
          updatedAt: serverTimestamp(),
        });
        toast.show({
          type: "success",
          title: emp.active ? "Employee deactivated" : "Employee activated",
        });
        refetch();
      } catch (err) {
        toast.show({
          type: "error",
          title:
            err instanceof Error ? err.message : "Failed to update status",
        });
      }
    },
    [refetch, toast],
  );

  const handleConfirmDelete = useCallback(
    async (password: string): Promise<void> => {
      if (!deleteTarget) return;
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email || !admin?.email) {
        toast.show({
          type: "error",
          title: "Session expired. Please sign in again.",
        });
        return;
      }
      setDeleteLoading(true);
      try {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          password,
        );
        await reauthenticateWithCredential(currentUser, credential);

        await deleteDoc(doc(db, "WasaEmployees", deleteTarget.id));
        toast.show({
          type: "success",
          title: `${deleteTarget.name || "Employee"} deleted`,
        });
        setDeleteTarget(null);
        refetch();
      } catch (err) {
        toast.show({
          type: "error",
          title:
            err instanceof Error
              ? err.message
              : "Password incorrect or delete failed",
        });
      } finally {
        setDeleteLoading(false);
      }
    },
    [admin?.email, deleteTarget, refetch, toast],
  );

  /* -------------------------------- Export -------------------------------- */

  const exportRows = useMemo(
    () =>
      filteredEmployees.map((e) => ({
        name: e.name ?? "",
        designation: e.designation ?? "",
        department: e.department ?? "",
        email: e.email ?? "",
        phone: e.phone ?? "",
        cnic: e.cnic ?? "",
        district: e.district ?? "",
        tehsil: e.tehsil ?? "",
        active: e.active ? "Active" : "Inactive",
        currentAssignments: e.currentAssignments ?? 0,
        totalResolved: e.totalResolved ?? 0,
      })),
    [filteredEmployees],
  );

  const handleExport = useCallback(async (): Promise<void> => {
    if (!exportFormat) return;
    setExportLoading(true);
    try {
      if (exportFormat === "pdf") {
        exportToPdf({
          title: "WASA Employees Report",
          subtitle: `Records: ${exportRows.length}`,
          columns: EXPORT_COLUMNS.map((c) => ({
            header: c.header,
            dataKey: c.dataKey,
          })),
          rows: exportRows,
          filename: `WASA_Employees_Report_${new Date()
            .toISOString()
            .slice(0, 10)}.pdf`,
          summary: [
            { label: "Total", value: stats.total },
            { label: "Active", value: stats.active },
            { label: "Inactive", value: stats.inactive },
            { label: "Overloaded", value: stats.overloaded },
          ],
        });
      } else if (exportFormat === "excel") {
        exportToExcel({
          sheetName: "Employees",
          columns: EXPORT_COLUMNS,
          rows: exportRows,
          filenamePrefix: "WASA_Employees_Report",
        });
      }
      toast.show({ type: "success", title: "Export ready" });
      setExportFormat(null);
    } catch (err) {
      toast.show({
        type: "error",
        title: err instanceof Error ? err.message : "Export failed",
      });
    } finally {
      setExportLoading(false);
    }
  }, [exportFormat, exportRows, stats, toast]);

  /* -------------------------------- Filters ------------------------------- */

  // Reset local filters + shared geography via context.
  const resetLocalFilters = () => {
    setLocalDepartment("");
    setLocalSpecialization("");
    setLocalStatus("all");
    setSearchInput("");
    filterCtx.resetFilters();
    setPage(1);
  };

  const inputBase =
    "block w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<FileText className="h-4 w-4" />}
          onClick={() => setExportFormat("pdf")}
          disabled={filteredEmployees.length === 0}
        >
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<FileSpreadsheet className="h-4 w-4" />}
          onClick={() => setExportFormat("excel")}
          disabled={filteredEmployees.length === 0}
        >
          Excel
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={openCreate}
        >
          New Employee
        </Button>
      </div>

      {/* Stats chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <UserCog className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total
                </p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-slate-500 dark:text-slate-400">Active</p>
            <p className="text-xl font-semibold text-green-600 dark:text-green-400">
              {stats.active}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inactive
            </p>
            <p className="text-xl font-semibold text-slate-700 dark:text-slate-300">
              {stats.inactive}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Overloaded
                </p>
                <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                  {stats.overloaded}
                </p>
              </div>
              {stats.overloaded > 0 && (
                <Badge variant="danger">10+ active</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                District
              </label>
              <Dropdown
                value={filterCtx.selectedDistrict}
                onChange={filterCtx.setSelectedDistrict}
                options={filterCtx.availableDistricts.map((d) => ({
                  value: d,
                  label: d,
                }))}
                placeholder="All districts"
                locked={filterCtx.districtLocked}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Tehsil
              </label>
              <Dropdown
                value={filterCtx.selectedTehsil}
                onChange={filterCtx.setSelectedTehsil}
                options={filterCtx.availableTehsils.map((t) => ({
                  value: t,
                  label: t,
                }))}
                placeholder="All tehsils"
                locked={filterCtx.tehsilLocked}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Department
              </label>
              <Dropdown
                value={localDepartment}
                onChange={(v) => {
                  setLocalDepartment(v);
                  setPage(1);
                }}
                options={DEPARTMENTS.map((d) => ({
                  value: d.value,
                  label: d.label,
                }))}
                placeholder="All departments"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Specialization
              </label>
              <Dropdown
                value={localSpecialization}
                onChange={(v) => {
                  setLocalSpecialization(v);
                  setPage(1);
                }}
                options={complaintTypes.map((ct) => ({
                  value: ct.key,
                  label: ct.label,
                }))}
                placeholder="All specializations"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Status
              </label>
              <Dropdown
                value={localStatus}
                onChange={(v) => {
                  setLocalStatus(v as StatusFilter);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Name, email, phone, CNIC"
                  className={`${inputBase} pl-9`}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetLocalFilters}>
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <EmployeesTable
        employees={paginated}
        loading={loading}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
        onDelete={(emp) => setDeleteTarget(emp)}
      />

      <Pagination
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalCount={filteredEmployees.length}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {/* Modals */}
      <EmployeeFormModal
        open={formOpen}
        onClose={closeForm}
        employee={editTarget}
        complaintTypes={complaintTypes}
        onSaved={refetch}
      />

      <DeleteWithPasswordModal
        open={!!deleteTarget}
        onClose={() => (deleteLoading ? undefined : setDeleteTarget(null))}
        onConfirm={handleConfirmDelete}
        employeeName={deleteTarget?.name ?? "employee"}
        loading={deleteLoading}
      />

      <ExportConfirmModal
        open={!!exportFormat}
        onClose={() =>
          exportLoading ? undefined : setExportFormat(null)
        }
        format={exportFormat ?? "pdf"}
        count={filteredEmployees.length}
        onConfirm={handleExport}
        loading={exportLoading}
      />

    </div>
  );
}
