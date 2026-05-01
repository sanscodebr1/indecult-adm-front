export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Route } from "next";
import { getAdminDashboardSnapshot } from "../../lib/admin";

export default async function DashboardPage() {
  const snapshot = await getAdminDashboardSnapshot();
  const queues = [
    {
      title: "Cadastros aguardando revisao",
      value: String(snapshot.pendingProfiles),
      description: "",
      href: "/dashboard/talentos" as Route
    },
    {
      title: "Eleicoes em rascunho",
      value: String(snapshot.draftElections),
      description: "",
      href: "/dashboard/eleicoes" as Route
    },
    {
      title: "Eleicoes ao vivo",
      value: String(snapshot.liveElections),
      description: "",
      href: "/dashboard/eleicoes" as Route
    }
  ];

  return (
    <div className="admin-page stack">
      <section className="talent-hero-card">
        <div className="stack">
          <p className="eyebrow">Painel inicial</p>
          <h1>Operacao administrativa da plataforma</h1>
          <p className="muted-text">
       
       </p>
        </div>
      </section>

      <section className="card-grid card-grid--dashboard">
        {queues.map((item) => (
          <article key={item.title} className="panel-card">
            <p className="eyebrow">Modulo</p>
            <h2>{item.title}</h2>
            <p className="stat-highlight">{item.value}</p>
            <p>{item.description}</p>
            <Link href={item.href} className="text-link">
              Abrir modulo <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </section>


    </div>
  );
}
