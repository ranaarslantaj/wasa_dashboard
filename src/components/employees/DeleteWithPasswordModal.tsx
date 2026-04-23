"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export interface DeleteWithPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  employeeName: string;
  loading?: boolean;
}

/**
 * Delete confirmation modal that requires the admin's current password.
 * Mirrors the WeWatch pattern. The parent is responsible for verifying the
 * password via `reauthenticateWithCredential` before performing the delete.
 */
export function DeleteWithPasswordModal({
  open,
  onClose,
  onConfirm,
  employeeName,
  loading = false,
}: DeleteWithPasswordModalProps) {
  const [password, setPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setSubmitting(false);
    }
  }, [open]);

  const isLoading = submitting || loading;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!password || isLoading) return;
    setSubmitting(true);
    try {
      await onConfirm(password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => undefined : onClose}
      size="sm"
      closeOnOverlay={!isLoading}
      closeOnEsc={!isLoading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Delete {employeeName}?
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              This will permanently remove the employee record. This action
              cannot be undone.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="delete-employee-password"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Enter your password to confirm
          </label>
          <input
            id="delete-employee-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            className="block w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            loading={isLoading}
            disabled={!password}
          >
            Delete
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default DeleteWithPasswordModal;
