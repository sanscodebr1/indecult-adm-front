import { AdminTalentsWorkspace } from "../../../components/admin-talents-workspace";

export const dynamic = "force-dynamic";

export default function TalentsPage() {
  return (
    <div className="admin-page stack">
      <section className="talent-hero-card">
        <div className="stack">
          <p className="eyebrow">Curadoria administrativa</p>
          <h1>Talentos enviados para revisao</h1>
          <p className="muted-text">
       
          </p>
        </div>
      </section>

      <AdminTalentsWorkspace />
    </div>
  );
}
