"use client";

import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import { AdminManagementGate } from "@/components/auth/AdminManagementGate";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
} from "@/components/ui";

export default function ComplaintTypesPage() {
  const router = useRouter();

  return (
    <AdminManagementGate>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag size={20} aria-hidden />
            <CardTitle>Complaint Types</CardTitle>
          </div>
          <CardDescription>
            Configure the catalog of complaint types shown in the public app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Tag}
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
