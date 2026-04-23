"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export type ExportFormat = "pdf" | "excel" | "pptx";

export interface ExportConfirmModalProps {
  open: boolean;
  onClose: () => void;
  format: ExportFormat;
  count: number;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: "PDF",
  excel: "Excel",
  pptx: "PowerPoint",
};

export function ExportConfirmModal({
  open,
  onClose,
  format,
  count,
  onConfirm,
  loading = false,
}: ExportConfirmModalProps) {
  const label = FORMAT_LABEL[format];
  const disabled = count === 0 || loading;

  const handleConfirm = async (): Promise<void> => {
    if (disabled) return;
    await onConfirm();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Download ${label} report`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={loading}
            disabled={disabled}
          >
            Download
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {count === 0 ? (
          <>There are no records to include in this export. Adjust your filters and try again.</>
        ) : (
          <>
            Download {label} report with{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {count}
            </span>{" "}
            record{count === 1 ? "" : "s"}?
          </>
        )}
      </p>
    </Modal>
  );
}

export default ExportConfirmModal;
