import type { ReactNode } from "react";
import { AdminSidebar } from "../../components/admin-sidebar";
import { requireAdminViewer } from "../../lib/admin";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const viewer = await requireAdminViewer();

  return (
    <div className="admin-app-shell">
      <AdminSidebar email={viewer.email ?? viewer.id} />
      <section className="admin-main-content">{children}</section>
    </div>
  );
}
