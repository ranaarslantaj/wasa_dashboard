"use client";

import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import {
  ScrollableTable,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/lib/formatters";
import type { Admin } from "@/types";

const ACCESS_LEVEL_BADGE: Record<string, string> = {
  province: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  division: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  district: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  tehsil:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const ACCESS_LEVEL_LABEL: Record<string, string> = {
  province: "Province",
  division: "Division",
  district: "District",
  tehsil: "Tehsil",
};

export interface AdminsTableProps {
  admins: Admin[];
  loading: boolean;
  currentAdminId?: string | null;
  onEdit: (a: Admin) => void;
  onToggleActive: (a: Admin) => void;
  onDelete: (a: Admin) => void;
}

export function AdminsTable({
  admins,
  loading,
  currentAdminId,
  onEdit,
  onToggleActive,
  onDelete,
}: AdminsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!admins.length) {
    return (
      <EmptyState
        icon={Users}
        title="No admins found"
        description="Try adjusting your filters or create a new admin to get started."
      />
    );
  }

  return (
    <ScrollableTable>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Access Level</TH>
            <TH>Scope</TH>
            <TH>Status</TH>
            <TH>Last Login</TH>
            <TH className="w-12 text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {admins.map((a) => {
            const scopeText = formatScope(a);
            const isSelf = currentAdminId === a.id;
            return (
              <TR key={a.id}>
                <TD>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {a.name || "—"}
                  </div>
                  {isSelf && (
                    <div className="text-[11px] text-brand-600 dark:text-brand-400">
                      You
                    </div>
                  )}
                </TD>
                <TD className="text-slate-600 dark:text-slate-300">
                  {a.email || "—"}
                </TD>
                <TD>
                  <Badge className={ACCESS_LEVEL_BADGE[a.accessLevel] ?? ""}>
                    {ACCESS_LEVEL_LABEL[a.accessLevel] ?? a.accessLevel}
                  </Badge>
                </TD>
                <TD className="text-slate-600 dark:text-slate-300">
                  {scopeText}
                </TD>
                <TD>
                  {a.status === "active" ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge>Inactive</Badge>
                  )}
                </TD>
                <TD className="text-slate-500 dark:text-slate-400">
                  {a.lastLogin ? formatTimeAgo(a.lastLogin) : "Never"}
                </TD>
                <TD className="text-right">
                  <RowActions
                    admin={a}
                    isSelf={isSelf}
                    onEdit={onEdit}
                    onToggleActive={onToggleActive}
                    onDelete={onDelete}
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </ScrollableTable>
  );
}

function formatScope(a: Admin): string {
  const parts: string[] = [a.province || "Punjab"];
  if (a.division) parts.push(a.division);
  if (a.district) parts.push(a.district);
  if (a.tehsil) parts.push(a.tehsil);
  return parts.join(" · ");
}

interface RowActionsProps {
  admin: Admin;
  isSelf: boolean;
  onEdit: (a: Admin) => void;
  onToggleActive: (a: Admin) => void;
  onDelete: (a: Admin) => void;
}

function RowActions({
  admin,
  isSelf,
  onEdit,
  onToggleActive,
  onDelete,
}: RowActionsProps) {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit(admin);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onToggleActive(admin);
            }}
            disabled={isSelf}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
              isSelf
                ? "text-slate-400 cursor-not-allowed"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
            )}
            title={isSelf ? "You can't change your own status" : undefined}
          >
            {admin.status === "active" ? (
              <>
                <PowerOff className="h-3.5 w-3.5" /> Deactivate
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5" /> Activate
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete(admin);
            }}
            disabled={isSelf}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
              isSelf
                ? "text-slate-400 cursor-not-allowed"
                : "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40",
            )}
            title={isSelf ? "You can't delete yourself" : undefined}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminsTable;
