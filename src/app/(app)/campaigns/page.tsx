"use client";

import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { AdminManagementGate } from "@/components/auth/AdminManagementGate";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
} from "@/components/ui";

export default function CampaignsPage() {
  const router = useRouter();

  return (
    <AdminManagementGate>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone size={20} aria-hidden />
            <CardTitle>Campaigns</CardTitle>
          </div>
          <CardDescription>
            Create and manage announcements shown in the public app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Megaphone}
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
