import Link from "next/link";
import type { Route } from "next";
import { getAdminDashboardSnapshot, listElectionsForAdmin } from "../../../lib/admin";
import { formatDateTime, formatElectionStatus, formatElectionVisibility } from "../../../lib/admin-presenters";
import { StatusBadge } from "../../../components/status-badge";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const statusOptions = ["all", "draft", "scheduled", "live", "paused", "finished", "cancelled"] as const;
const visibilityOptions = ["all", "public", "private"] as const;

export default async function ElectionsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const created = params.created === "1";
  const query = getSingleValue(params.q);
  const status = getSingleValue(params.status) || "all";
  const visibility = getSingleValue(params.visibility) || "all";

  const [snapshot, elections] = await Promise.all([
    getAdminDashboardSnapshot(),
    listElectionsForAdmin({ query, status, visibility })
  ]);

  return (
    <div className="admin-page stack">
      <section className="talent-hero-card">
        <div className="stack">
          <p className="eyebrow">Operacao de eleicoes</p>
          <h1>Eleicoes</h1>
          <p className="muted-text">
            
          </p>
        </div>

        <div className="talent-hero-card__actions">
          <Link href={"/dashboard/eleicoes/nova" as Route} className="button">
            Criar eleicao
          </Link>
        </div>
      </section>

      {created ? <div className="inline-alert inline-alert--success">Eleicao criada com sucesso no Supabase.</div> : null}

      <section className="card-grid card-grid--dashboard">
        <article className="panel-card">
          <p className="eyebrow">Resumo</p>
          <h2>Total filtrado</h2>
          <p className="stat-highlight">{elections.length}</p>
          <p>Campanhas visiveis com os filtros aplicados agora.</p>
        </article>

        <article className="panel-card">
          <p className="eyebrow">Resumo</p>
          <h2>Em rascunho</h2>
          <p className="stat-highlight">{snapshot.draftElections}</p>
          <p>Eleicoes que ainda nao foram publicadas.</p>
        </article>

        <article className="panel-card">
          <p className="eyebrow">Resumo</p>
          <h2>Ao vivo</h2>
          <p className="stat-highlight">{snapshot.liveElections}</p>
          <p>Campanhas em operacao com votacao aberta.</p>
        </article>
      </section>

      <section className="panel-card">
        <div className="admin-section-heading">
          <div className="stack">
            <p className="eyebrow">Filtros</p>
            <h2>Encontrar eleicoes</h2>
          </div>

          <Link href={"/dashboard/eleicoes" as Route} className="button button--secondary">
            Limpar filtros
          </Link>
        </div>

        <form className="admin-form" method="GET">
          <label className="field-block">
            <span>Buscar por titulo ou slug</span>
            <input type="search" name="q" defaultValue={query} placeholder="Ex.: talentos-2026" className="admin-input" />
          </label>

          <label className="field-block">
            <span>Status</span>
            <select name="status" defaultValue={status} className="admin-input">
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Todos" : formatElectionStatus(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Visibilidade</span>
            <select name="visibility" defaultValue={visibility} className="admin-input">
              {visibilityOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Todas" : formatElectionVisibility(item)}
                </option>
              ))}
            </select>
          </label>

          <div className="field-block">
            <span>Aplicar filtros</span>
            <button type="submit" className="button button--secondary">
              Atualizar lista
            </button>
          </div>
        </form>
      </section>

      <section className="panel-card">
        <div className="admin-section-heading">
          <div className="stack">
            <p className="eyebrow">Listagem</p>
            <h2>Campanhas cadastradas</h2>
          </div>
        </div>

        {elections.length === 0 ? (
          <div className="inline-alert">Nenhuma eleicao encontrada para os filtros atuais.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Eleicao</th>
                  <th>Status</th>
                  <th>Visibilidade</th>
                  <th>Periodo</th>
                  <th>Limites</th>
                </tr>
              </thead>
              <tbody>
                {elections.map((election) => (
                  <tr key={election.id}>
                    <td>
                      <div className="table-primary">
                        <Link href={`/dashboard/eleicoes/${election.id}` as Route} className="text-link">
                          {election.title}
                        </Link>
                        <span>/{election.slug}</span>
                        <span>{election.description || "Sem descricao cadastrada."}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={getElectionStatusTone(election.status)}>{formatElectionStatus(election.status)}</StatusBadge>
                    </td>
                    <td>
                      <StatusBadge tone={election.visibility === "public" ? "accent" : "neutral"}>
                        {formatElectionVisibility(election.visibility)}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className="table-primary">
                        <strong>Inicio</strong>
                        <span>{formatDateTime(election.starts_at)}</span>
                        <strong>Fim</strong>
                        <span>{formatDateTime(election.ends_at)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span>IP/dia: {election.max_votes_per_ip_per_day ?? "Sem limite"}</span>
                        <span>Fingerprint/dia: {election.max_votes_per_fingerprint_per_day ?? "Sem limite"}</span>
                        <span>Resultados publicos: {election.allow_public_results ? "Sim" : "Nao"}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getElectionStatusTone(status?: string | null) {
  switch (status) {
    case "live":
      return "success";
    case "scheduled":
      return "accent";
    case "cancelled":
      return "danger";
    case "paused":
    case "finished":
      return "neutral";
    case "draft":
    default:
      return "pending";
  }
}
