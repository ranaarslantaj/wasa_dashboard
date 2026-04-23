"use client";

import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { AdminManagementGate } from "@/components/auth/AdminManagementGate";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
} from "@/components/ui";

export default function AdminManagementPage() {
  const router = useRouter();

  return (
    <AdminManagementGate>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={20} aria-hidden />
            <CardTitle>Admin Management</CardTitle>
          </div>
          <CardDescription>
            Create, edit, deactivate admin accounts across the access hierarchy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Shield}
            title="Coming soon"
            description="This super-admin section is scaffolded and ready. Full CRUD will be implemented in the next phase."
            action={{
              label: "Back to Dashboard",
              onClick: () => router.push("/dashboard"),
            }}
          />
        </CardContent>
      </Card>
    </AdminManagementGate>
  );
}
