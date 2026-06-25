import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { StatusBadge } from "../../../../components/status-badge";
import {
  assignElectionCandidatesAction,
  createElectionCategoryAction,
  deleteElectionCategoryAction,
  importElectionCandidatesByStateAction,
  removeElectionParticipantAction,
  updateElectionAction,
  updateElectionCategoryAction
} from "../../actions";
import {
  getElectionDetailForAdmin,
  listElectionAssignableTalentsForAdmin,
  listElectionVotesForAdmin,
  listStatesForAdmin,
  type AdminElectionParticipant,
  type AdminElectionVoteListItem
} from "../../../../lib/admin";
import {
  formatDateTime,
  formatElectionStatus,
  formatElectionVisibility
} from "../../../../lib/admin-presenters";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ElectionDetailTab = "overview" | "categories" | "participants" | "ranking" | "votes";

const VOTES_PAGE_SIZE = 20;

export default async function ElectionDetailPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const votesPage = toPositiveInteger(getSingleValue(query.votesPage), 1);
  const talentQuery = getSingleValue(query.talentQuery);
  const talentStateId = toNullablePositiveInteger(getSingleValue(query.talentStateId));
  const activeTab = toElectionDetailTab(getSingleValue(query.tab));
  const electionUpdated = query.electionUpdated === "1";
  const categoryCreated = query.categoryCreated === "1";
  const categoryUpdated = query.categoryUpdated === "1";
  const categoryDeleted = query.categoryDeleted === "1";
  const assignedCount = toNullablePositiveInteger(getSingleValue(query.assigned));
  const importedCount = toNullablePositiveInteger(getSingleValue(query.imported));
  const participantRemoved = query.participantRemoved === "1";
  const removalMode = getSingleValue(query.removalMode);

  const [detail, votes, states, assignableTalents] = await Promise.all([
    getElectionDetailForAdmin(id),
    listElectionVotesForAdmin(id, votesPage, VOTES_PAGE_SIZE),
    listStatesForAdmin(),
    listElectionAssignableTalentsForAdmin(id, { query: talentQuery, stateId: talentStateId, limit: 40 })
  ]);

  if (!detail) {
    notFound();
  }

  const votesRangeStart = votes.totalItems === 0 ? 0 : (votes.page - 1) * votes.pageSize + 1;
  const votesRangeEnd = Math.min(votes.page * votes.pageSize, votes.totalItems);
  const categoryRankings = buildCategoryRankings(detail.participants);

  return (
    <div className="admin-page stack">
      <section className="talent-hero-card">
        <div className="stack">
          <p className="eyebrow">Painel da eleicao</p>
          <h1>{detail.election.title}</h1>
          <p className="muted-text">{detail.election.description || "Sem descricao cadastrada para esta campanha."}</p>
          <div className="hero__actions">
            <StatusBadge tone={getElectionStatusTone(detail.election.status)}>{formatElectionStatus(detail.election.status)}</StatusBadge>
            <StatusBadge tone={detail.election.visibility === "public" ? "accent" : "neutral"}>
              {formatElectionVisibility(detail.election.visibility)}
            </StatusBadge>
          </div>
        </div>

        <div className="talent-hero-card__actions">
          <Link href={"/dashboard/eleicoes" as Route} className="button button--secondary">
            Voltar para eleicoes
          </Link>
        </div>
      </section>

      {categoryCreated ? <div className="inline-alert inline-alert--success">Categoria criada com sucesso.</div> : null}
      {electionUpdated ? <div className="inline-alert inline-alert--success">Eleicao atualizada com sucesso.</div> : null}
      {categoryUpdated ? <div className="inline-alert inline-alert--success">Categoria atualizada com sucesso.</div> : null}
      {categoryDeleted ? <div className="inline-alert inline-alert--success">Categoria excluida com sucesso.</div> : null}
      {assignedCount !== null ? <div className="inline-alert inline-alert--success">{assignedCount} talento(s) vinculado(s) a categoria.</div> : null}
      {importedCount !== null ? <div className="inline-alert inline-alert--success">{importedCount} talento(s) aprovado(s) importado(s) pelo estado.</div> : null}
      {participantRemoved ? (
        <div className="inline-alert inline-alert--success">
          {removalMode === "deactivated"
            ? "Participante removido da operacao ativa e preservado no historico por ja possuir votos."
            : "Participante excluido da eleicao com sucesso."}
        </div>
      ) : null}

      <nav className="detail-tabs" aria-label="Submenu da eleicao">
        {[
          { id: "overview", label: "Visao geral" },
          { id: "categories", label: "Categorias" },
          { id: "participants", label: "Participantes" },
          { id: "ranking", label: "Ranking" },
          { id: "votes", label: "Votos" }
        ].map((tab) => (
          <Link
            key={tab.id}
            href={buildElectionTabHref(id, query, tab.id as ElectionDetailTab)}
            className="detail-tabs__link"
            data-active={activeTab === tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <>
          <section className="card-grid card-grid--dashboard">
            <article className="panel-card">
              <p className="eyebrow">Resumo</p>
              <h2>Total de votos</h2>
              <p className="stat-highlight">{detail.totalVotes}</p>
              <p>Todos os votos contabilizados para a eleicao ate agora.</p>
            </article>

            <article className="panel-card">
              <p className="eyebrow">Resumo</p>
              <h2>Participantes</h2>
              <p className="stat-highlight">{detail.totalParticipants}</p>
              <p>Talentos vinculados a esta eleicao.</p>
            </article>

            <article className="panel-card">
              <p className="eyebrow">Resumo</p>
              <h2>Categorias</h2>
              <p className="stat-highlight">{detail.totalCategories}</p>
              <p>Grupos internos da eleicao prontos para organizar os participantes.</p>
            </article>
          </section>

          <section className="section-shell section-shell--split">
            <article className="panel-card">
              <p className="eyebrow">Edicao</p>
              <h2>Editar eleicao</h2>

              <form action={updateElectionAction} className="admin-form" encType="multipart/form-data">
                <input type="hidden" name="electionId" value={id} />

                <label className="field-block">
                  <span>Titulo</span>
                  <input type="text" name="title" required minLength={3} defaultValue={detail.election.title} className="admin-input" />
                </label>

                <label className="field-block">
                  <span>Slug</span>
                  <input type="text" name="slug" defaultValue={detail.election.slug} className="admin-input" />
                </label>

                <label className="field-block field-block--full">
                  <span>Descricao</span>
                  <textarea name="description" defaultValue={detail.election.description ?? ""} className="admin-textarea" />
                </label>

                <label className="field-block field-block--full">
                  <span>Logotipo (URL)</span>
                  <input type="url" name="logoUrl" defaultValue={detail.election.logo_url ?? ""} className="admin-input" />
                </label>

                <label className="field-block field-block--full">
                  <span>Upload do logotipo</span>
                  <input type="file" name="logoFile" accept="image/*" className="admin-input" />
                </label>

                <label className="field-block field-block--full">
                  <span>Imagem de capa (URL)</span>
                  <input type="url" name="coverUrl" defaultValue={detail.election.cover_url ?? ""} className="admin-input" />
                </label>

                <label className="field-block field-block--full">
                  <span>Upload da capa</span>
                  <input type="file" name="coverFile" accept="image/*" className="admin-input" />
                </label>

                <label className="field-block">
                  <span>Visibilidade</span>
                  <select name="visibility" defaultValue={detail.election.visibility} className="admin-input">
                    <option value="public">Publica</option>
                    <option value="private">Privada</option>
                  </select>
                </label>

                <label className="field-block">
                  <span>Status</span>
                  <select name="status" defaultValue={detail.election.status} className="admin-input">
                    {["draft", "scheduled", "live", "paused", "finished", "cancelled"].map((status) => (
                      <option key={status} value={status}>
                        {formatElectionStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-block">
                  <span>Inicio</span>
                  <input type="datetime-local" name="startsAt" defaultValue={toDateTimeLocalValue(detail.election.starts_at)} required className="admin-input" />
                </label>

                <label className="field-block">
                  <span>Encerramento</span>
                  <input type="datetime-local" name="endsAt" defaultValue={toDateTimeLocalValue(detail.election.ends_at)} required className="admin-input" />
                </label>

                <label className="field-block">
                  <span>Maximo de votos por IP/dia</span>
                  <input type="number" min="1" name="maxVotesPerIpPerDay" defaultValue={detail.election.max_votes_per_ip_per_day ?? ""} className="admin-input" />
                </label>

                <label className="field-block">
                  <span>Maximo de votos por fingerprint/dia</span>
                  <input
                    type="number"
                    min="1"
                    name="maxVotesPerFingerprintPerDay"
                    defaultValue={detail.election.max_votes_per_fingerprint_per_day ?? ""}
                    className="admin-input"
                  />
                </label>

                <label className="checkbox-field field-block--full">
                  <input type="checkbox" name="allowPublicResults" defaultChecked={detail.election.allow_public_results} />
                  <span>Permitir resultados publicos</span>
                </label>

                <div className="field-block--full">
                  <button type="submit" className="button">
                    Salvar eleicao
                  </button>
                </div>
              </form>
            </article>

            <article className="panel-card">
              <p className="eyebrow">Configuracao</p>
              <h2>Dados da campanha</h2>
              {detail.election.cover_url ? (
                <div className="stack">
                  <img
                    src={detail.election.cover_url}
                    alt={`Capa da eleicao ${detail.election.title}`}
                    style={{ width: "100%", maxHeight: "240px", borderRadius: "18px", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div className="inline-alert">Nenhuma imagem de capa configurada para esta eleicao.</div>
              )}
              {detail.election.logo_url ? (
                <div className="stack">
                  <img
                    src={detail.election.logo_url}
                    alt={`Logotipo da eleicao ${detail.election.title}`}
                    style={{ maxWidth: "180px", maxHeight: "180px", borderRadius: "18px", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div className="inline-alert">Nenhum logotipo configurado para esta eleicao.</div>
              )}
              <dl className="detail-list">
                <div>
                  <dt>Slug</dt>
                  <dd>/{detail.election.slug}</dd>
                </div>
                <div>
                  <dt>Logo URL</dt>
                  <dd>{detail.election.logo_url ?? "Nao informado"}</dd>
                </div>
                <div>
                  <dt>Capa URL</dt>
                  <dd>{detail.election.cover_url ?? "Nao informado"}</dd>
                </div>
                <div>
                  <dt>Periodo</dt>
                  <dd>
                    {formatDateTime(detail.election.starts_at)} ate {formatDateTime(detail.election.ends_at)}
                  </dd>
                </div>
                <div>
                  <dt>Limite por IP/dia</dt>
                  <dd>{detail.election.max_votes_per_ip_per_day ?? "Sem limite"}</dd>
                </div>
                <div>
                  <dt>Limite por fingerprint/dia</dt>
                  <dd>{detail.election.max_votes_per_fingerprint_per_day ?? "Sem limite"}</dd>
                </div>
                <div>
                  <dt>Resultados publicos</dt>
                  <dd>{detail.election.allow_public_results ? "Sim" : "Nao"}</dd>
                </div>
                <div>
                  <dt>Publicada em</dt>
                  <dd>{formatDateTime(detail.election.published_at)}</dd>
                </div>
              </dl>
            </article>

            <article className="panel-card">
              <p className="eyebrow">Categorias</p>
              <h2>Organizacao interna</h2>
              {detail.categories.length === 0 ? (
                <div className="inline-alert">
                  Nenhuma categoria cadastrada ainda. Crie categorias para organizar os participantes desta eleicao.
                </div>
              ) : (
                <div className="history-list">
                  {detail.categories.map((category) => (
                    <div key={category.id} className="history-item">
                      <div className="history-item__header">
                        <strong>{category.name}</strong>
                        <StatusBadge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Ativa" : "Inativa"}</StatusBadge>
                      </div>
                      <span>/{category.slug}</span>
                      <span>{category.description || "Sem descricao cadastrada."}</span>
                      <span>Participantes: {category.participantsCount}</span>
                      <span>Votos acumulados: {category.totalVotes}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}

      {activeTab === "categories" ? (
        <>
          <section className="section-shell section-shell--split">
            <article className="panel-card">
              <p className="eyebrow">Categorias</p>
              <h2>Criar categoria da eleicao</h2>

              <form action={createElectionCategoryAction} className="admin-form">
                <input type="hidden" name="electionId" value={id} />

                <label className="field-block">
                  <span>Nome</span>
                  <input type="text" name="name" required minLength={2} placeholder="Ex.: Samba, Sertanejo, Infantil" className="admin-input" />
                </label>

                <label className="field-block">
                  <span>Slug</span>
                  <input type="text" name="slug" placeholder="Opcional. Se vazio, sera gerado." className="admin-input" />
                </label>

                <label className="field-block field-block--full">
                  <span>Descricao</span>
                  <textarea name="description" placeholder="Contexto e recorte desta categoria dentro da eleicao." className="admin-textarea" />
                </label>

                <label className="field-block">
                  <span>Ordem de exibicao</span>
                  <input type="number" min="0" name="displayOrder" defaultValue="0" className="admin-input" />
                </label>

                <div className="field-block">
                  <span>Salvar categoria</span>
                  <button type="submit" className="button">
                    Criar categoria
                  </button>
                </div>
              </form>
            </article>

            <article className="panel-card">
              <p className="eyebrow">Importacao</p>
              <h2>Adicionar aprovados por estado</h2>
              <p className="muted-text">Escolha uma categoria e importe todos os talentos aprovados daquele estado.</p>

              {detail.categories.length === 0 ? (
                <div className="inline-alert">Crie ao menos uma categoria antes de importar participantes.</div>
              ) : (
                <form action={importElectionCandidatesByStateAction} className="admin-form">
                  <input type="hidden" name="electionId" value={id} />

                  <label className="field-block">
                    <span>Categoria</span>
                    <select name="categoryId" required className="admin-input">
                      <option value="">Selecione</option>
                      {detail.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-block">
                    <span>Estado</span>
                    <select name="stateId" required className="admin-input">
                      <option value="">Selecione</option>
                      {states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.sigla} - {state.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="field-block">
                    <span>Importar aprovados</span>
                    <button type="submit" className="button">
                      Importar por estado
                    </button>
                  </div>
                </form>
              )}
            </article>
          </section>

          <section className="panel-card">
            <div className="admin-section-heading">
              <div className="stack">
                <p className="eyebrow">Mapa atual</p>
                <h2>Categorias cadastradas</h2>
              </div>
            </div>

            {detail.categories.length === 0 ? (
              <div className="inline-alert">Nenhuma categoria cadastrada ainda para esta eleicao.</div>
            ) : (
              <div className="history-list">
                {detail.categories.map((category) => (
                  <div key={category.id} className="history-item">
                    <form action={updateElectionCategoryAction} className="stack">
                      <input type="hidden" name="electionId" value={id} />
                      <input type="hidden" name="categoryId" value={category.id} />

                      <div className="history-item__header">
                        <strong>{category.name}</strong>
                        <StatusBadge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Ativa" : "Inativa"}</StatusBadge>
                      </div>

                      <div className="admin-form">
                        <label className="field-block">
                          <span>Nome</span>
                          <input type="text" name="name" required minLength={2} defaultValue={category.name} className="admin-input" />
                        </label>

                        <label className="field-block">
                          <span>Slug</span>
                          <input type="text" name="slug" defaultValue={category.slug} className="admin-input" />
                        </label>

                        <label className="field-block field-block--full">
                          <span>Descricao</span>
                          <textarea name="description" defaultValue={category.description ?? ""} className="admin-textarea" />
                        </label>

                        <label className="field-block">
                          <span>Ordem</span>
                          <input type="number" min="0" name="displayOrder" defaultValue={String(category.displayOrder)} className="admin-input" />
                        </label>

                        <label className="checkbox-field field-block">
                          <input type="checkbox" name="isActive" defaultChecked={category.isActive} />
                          <span>Categoria ativa</span>
                        </label>
                      </div>

                      <div className="hero__actions">
                        <span>Participantes: {category.participantsCount}</span>
                        <span>Votos acumulados: {category.totalVotes}</span>
                      </div>

                      <div className="hero__actions">
                        <button type="submit" className="button button--secondary">
                          Salvar categoria
                        </button>
                      </div>
                    </form>

                    <form action={deleteElectionCategoryAction}>
                      <input type="hidden" name="electionId" value={id} />
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button type="submit" className="button button--danger">
                        Excluir categoria
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {activeTab === "participants" ? (
        <section className="panel-card">
          <div className="admin-section-heading">
            <div className="stack">
              <p className="eyebrow">Selecao livre</p>
              <h2>Pesquisar talentos aprovados</h2>
              <p className="muted-text">Busque por nome ou slug, marque os checkboxes e vincule os talentos na categoria escolhida.</p>
            </div>
          </div>

          <form method="GET" action={`/dashboard/eleicoes/${id}`} className="admin-form">
            <input type="hidden" name="tab" value="participants" />

            <label className="field-block">
              <span>Buscar por nome ou slug</span>
              <input type="search" name="talentQuery" defaultValue={talentQuery} placeholder="Ex.: maria, talentos-do-sul" className="admin-input" />
            </label>

            <label className="field-block">
              <span>Filtrar por estado</span>
              <select name="talentStateId" defaultValue={talentStateId ? String(talentStateId) : ""} className="admin-input">
                <option value="">Todos</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.sigla} - {state.nome}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-block">
              <span>Atualizar lista</span>
              <button type="submit" className="button button--secondary">
                Pesquisar
              </button>
            </div>

            <div className="field-block">
              <span>Limpar</span>
              <Link href={buildElectionTabHref(id, {}, "participants")} className="button button--secondary">
                Limpar filtros
              </Link>
            </div>
          </form>

          {detail.categories.length === 0 ? (
            <div className="inline-alert">Crie uma categoria antes de vincular participantes manualmente.</div>
          ) : assignableTalents.length === 0 ? (
            <div className="inline-alert">Nenhum talento aprovado encontrado para os filtros atuais.</div>
          ) : (
            <div className="stack">
              <form action={assignElectionCandidatesAction} className="stack">
                <input type="hidden" name="electionId" value={id} />

                <div className="admin-form">
                  <label className="field-block">
                    <span>Categoria de destino</span>
                    <select name="categoryId" required className="admin-input">
                      <option value="">Selecione</option>
                      {detail.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="field-block">
                    <span>Aplicar selecao</span>
                    <button type="submit" className="button">
                      Vincular selecionados
                    </button>
                  </div>
                </div>

                <div className="history-list">
                  {assignableTalents.map((talent) => (
                    <label key={talent.profileId} className="history-item">
                      <span className="checkbox-field">
                        <input type="checkbox" name="profileIds" value={talent.profileId} />
                        <strong>{talent.displayName}</strong>
                      </span>
                      <span>/{talent.publicSlug}</span>
                      <span>{formatTalentLocation(talent.cityName, talent.stateSigla)}</span>
                      <span>
                        {talent.existingCandidateId
                          ? `Ja esta na eleicao${talent.existingCategoryId ? ` em ${findCategoryName(detail.categories, talent.existingCategoryId)}` : ""}.`
                          : "Ainda nao vinculado a esta eleicao."}
                      </span>
                    </label>
                  ))}
                </div>
              </form>

              <section className="stack">
                <div className="admin-section-heading">
                  <div className="stack">
                    <p className="eyebrow">Participantes atuais</p>
                    <h2>Excluir participantes</h2>
                    <p className="muted-text">Se o participante ja tiver votos, ele sera desativado e preservado no historico em vez de ser apagado.</p>
                  </div>
                </div>

                {detail.participants.length === 0 ? (
                  <div className="inline-alert">Nenhum participante vinculado a esta eleicao ainda.</div>
                ) : (
                  <div className="history-list">
                    {detail.participants.map((participant) => (
                      <div key={participant.electionCandidateId} className="history-item">
                        <div className="history-item__header">
                          <strong>{participant.displayName}</strong>
                          <StatusBadge tone={participant.isActive ? "success" : "neutral"}>
                            {participant.isActive ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </div>
                        <span>/{participant.publicSlug || "sem-slug"}</span>
                        <span>{participant.category?.name ?? "Sem categoria"}</span>
                        <span>Votos: {participant.voteCount}</span>
                        <form action={removeElectionParticipantAction}>
                          <input type="hidden" name="electionId" value={id} />
                          <input type="hidden" name="electionCandidateId" value={participant.electionCandidateId} />
                          <button type="submit" className="button button--danger">
                            Excluir participante
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "ranking" ? (
        <div className="stack">
          <section className="panel-card">
            <div className="admin-section-heading">
              <div className="stack">
                <p className="eyebrow">Ranking geral</p>
                <h2>Participantes ordenados por votos</h2>
              </div>
            </div>

            {detail.participants.length === 0 ? (
              <div className="inline-alert">Nenhum participante vinculado a esta eleicao ainda.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Posicao</th>
                      <th>Participante</th>
                      <th>Categoria</th>
                      <th>Status</th>
                      <th>Votos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.participants.map((participant) => (
                      <tr key={participant.electionCandidateId}>
                        <td>#{participant.rankingPosition ?? "-"}</td>
                        <td>{renderParticipantCell(participant)}</td>
                        <td>{participant.category?.name ?? "Sem categoria"}</td>
                        <td>
                          <StatusBadge tone={participant.isActive ? "success" : "neutral"}>
                            {participant.isActive ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </td>
                        <td>{participant.voteCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel-card">
            <div className="admin-section-heading">
              <div className="stack">
                <p className="eyebrow">Ranking por categoria</p>
                <h2>Classificacao segmentada</h2>
                <p className="muted-text">Cada categoria mostra seus participantes ordenados pela quantidade de votos dentro do proprio grupo.</p>
              </div>
            </div>

            {categoryRankings.length === 0 ? (
              <div className="inline-alert">Nenhuma categoria com participantes encontrada nesta eleicao.</div>
            ) : (
              <div className="history-list">
                {categoryRankings.map((group) => (
                  <article key={group.key} className="history-item">
                    <div className="history-item__header">
                      <strong>{group.label}</strong>
                      <StatusBadge tone="accent">{group.totalVotes} voto(s)</StatusBadge>
                    </div>
                    <span>{group.participants.length} participante(s)</span>

                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Posicao</th>
                            <th>Participante</th>
                            <th>Status</th>
                            <th>Votos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.participants.map((participant, index) => (
                            <tr key={participant.electionCandidateId}>
                              <td>#{index + 1}</td>
                              <td>{renderParticipantCell(participant)}</td>
                              <td>
                                <StatusBadge tone={participant.isActive ? "success" : "neutral"}>
                                  {participant.isActive ? "Ativo" : "Inativo"}
                                </StatusBadge>
                              </td>
                              <td>{participant.voteCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "votes" ? (
        <section className="panel-card">
          <div className="admin-section-heading">
            <div className="stack">
              <p className="eyebrow">Votos</p>
              <h2>Lista paginada</h2>
              <p className="muted-text">
                Mostrando {votesRangeStart}-{votesRangeEnd} de {votes.totalItems} votos registrados.
              </p>
            </div>
          </div>

          {votes.items.length === 0 ? (
            <div className="inline-alert">Nenhum voto contabilizado para esta eleicao ainda.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Participante</th>
                    <th>Categoria</th>
                    <th>Vote attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {votes.items.map((vote) => (
                    <tr key={vote.id}>
                      <td>{formatDateTime(vote.createdAt)}</td>
                      <td>{renderVoteParticipantCell(vote)}</td>
                      <td>{vote.category?.name ?? "Sem categoria"}</td>
                      <td>
                        <code>{vote.voteAttemptId}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-section-heading">
            <span className="muted-text">
              Pagina {votes.page} de {votes.totalPages}
            </span>
            <div className="hero__actions">
              {votes.page > 1 ? (
                <Link href={buildVotesPageHref(id, query, votes.page - 1)} className="button button--secondary">
                  Pagina anterior
                </Link>
              ) : (
                <span className="button button--secondary">Pagina anterior</span>
              )}
              {votes.page < votes.totalPages ? (
                <Link href={buildVotesPageHref(id, query, votes.page + 1)} className="button button--secondary">
                  Proxima pagina
                </Link>
              ) : (
                <span className="button button--secondary">Proxima pagina</span>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function renderParticipantCell(participant: AdminElectionParticipant) {
  return (
    <div className="table-primary">
      <strong>{participant.displayName}</strong>
      <span>/{participant.publicSlug || "sem-slug"}</span>
      <span>Numero: {participant.candidateNumber ?? "Nao definido"}</span>
    </div>
  );
}

function renderVoteParticipantCell(vote: AdminElectionVoteListItem) {
  if (!vote.participant) {
    return "Participante removido";
  }

  return (
    <div className="table-primary">
      <strong>{vote.participant.displayName}</strong>
      <span>/{vote.participant.publicSlug || "sem-slug"}</span>
      <span>Numero: {vote.participant.candidateNumber ?? "Nao definido"}</span>
    </div>
  );
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function toPositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNullablePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildVotesPageHref(electionId: string, query: Record<string, string | string[] | undefined>, page: number) {
  return buildElectionTabHref(electionId, query, "votes", { votesPage: String(Math.max(1, page)) });
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

function formatTalentLocation(city: string | null, stateSigla: string | null) {
  const parts = [city?.trim(), stateSigla?.trim()].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(", ") : "Localizacao nao informada";
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function findCategoryName(categories: Array<{ id: string; name: string }>, categoryId: string) {
  return categories.find((category) => category.id === categoryId)?.name ?? "outra categoria";
}

function buildCategoryRankings(participants: AdminElectionParticipant[]) {
  const grouped = new Map<
    string,
    {
      key: string;
      label: string;
      totalVotes: number;
      participants: AdminElectionParticipant[];
    }
  >();

  for (const participant of participants) {
    const key = participant.category?.id ?? "uncategorized";
    const label = participant.category?.name ?? "Sem categoria";
    const current = grouped.get(key) ?? {
      key,
      label,
      totalVotes: 0,
      participants: []
    };

    current.totalVotes += participant.voteCount;
    current.participants.push(participant);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      participants: [...group.participants].sort((left, right) => {
        if (right.voteCount !== left.voteCount) {
          return right.voteCount - left.voteCount;
        }

        return left.displayName.localeCompare(right.displayName, "pt-BR");
      })
    }))
    .sort((left, right) => {
      if (right.totalVotes !== left.totalVotes) {
        return right.totalVotes - left.totalVotes;
      }

      return left.label.localeCompare(right.label, "pt-BR");
    });
}

function toElectionDetailTab(value: string): ElectionDetailTab {
  switch (value) {
    case "categories":
    case "participants":
    case "ranking":
    case "votes":
      return value;
    case "overview":
    default:
      return "overview";
  }
}

function buildElectionTabHref(
  electionId: string,
  query: Record<string, string | string[] | undefined>,
  tab: ElectionDetailTab,
  overrides: Record<string, string | null> = {}
) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(query)) {
    if (typeof rawValue === "string" && rawValue.length > 0) {
      params.set(key, rawValue);
    } else if (Array.isArray(rawValue) && rawValue[0]) {
      params.set(key, rawValue[0]);
    }
  }

  params.set("tab", tab);

  for (const [key, value] of Object.entries(overrides)) {
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return `/dashboard/eleicoes/${electionId}${queryString ? `?${queryString}` : ""}` as Route;
}
