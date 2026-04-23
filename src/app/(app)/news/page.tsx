"use client";

import { useRouter } from "next/navigation";
import { Newspaper } from "lucide-react";
import { AdminManagementGate } from "@/components/auth/AdminManagementGate";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
} from "@/components/ui";

export default function NewsPage() {
  const router = useRouter();

  return (
    <AdminManagementGate>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Newspaper size={20} aria-hidden />
            <CardTitle>News</CardTitle>
          </div>
          <CardDescription>
            Publish news items for WASA customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Newspaper}
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
