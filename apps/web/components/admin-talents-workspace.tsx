"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { listAdminTalents, reviewAdminTalent, type AdminTalentListItem } from "@indecult/supabase";
import { createWebBrowserSupabaseClient } from "../lib/supabase-browser";
import {
  formatChangeRequestType,
  formatDateOnly,
  formatDateTime,
  formatFileSize,
  formatMediaKind,
  formatProfileStatus,
  formatRegistrationPaymentStatus,
  toRegistrationPaymentTone
} from "../lib/admin-presenters";
import { StatusBadge } from "./status-badge";

export function AdminTalentsWorkspace() {
  const [items, setItems] = useState<AdminTalentListItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [pendingApproval, setPendingApproval] = useState<AdminTalentListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void loadTalents();
  }, []);

  const summary = useMemo(() => {
    const pending = items.filter((item) => item.profile.status === "pending_review").length;
    const approved = items.filter((item) => item.profile.status === "approved").length;

    return {
      pending,
      approved,
      total: items.length
    };
  }, [items]);

  async function loadTalents() {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createWebBrowserSupabaseClient();
      const result = await listAdminTalents(supabase);

      if (result.error) {
        setError(result.error.message);
        setItems([]);
        return;
      }

      const nextItems = result.data?.items ?? [];
      setItems(nextItems);

      if (nextItems.length > 0 && !expandedId) {
        setExpandedId(nextItems[0]?.profile.id ?? null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar os talentos.");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  function requestApproval(item: AdminTalentListItem) {
    if (item.profile.registration_payment_status === "pending") {
      setPendingApproval(item);
      return;
    }

    reviewTalent(item, "approved");
  }

  function reviewTalent(item: AdminTalentListItem, decision: "approved" | "rejected") {
    const reason = rejectionReasons[item.profile.id]?.trim() ?? "";

    setError(null);
    setFeedback(null);

    startTransition(async () => {
      try {
        const supabase = createWebBrowserSupabaseClient();
        const result = await reviewAdminTalent(supabase, {
          profileId: item.profile.id,
          changeRequestId: item.pendingRequest?.id ?? null,
          decision,
          reason: decision === "rejected" ? reason : null
        });

        if (result.error) {
          setError(result.error.message);
          return;
        }

        setFeedback(result.data?.message ?? "Status atualizado com sucesso.");
        setPendingApproval(null);
        await loadTalents();
        setExpandedId(item.profile.id);
      } catch (reviewError) {
        setError(reviewError instanceof Error ? reviewError.message : "Nao foi possivel atualizar o talento.");
      }
    });
  }

  return (
    <div className="stack">
      <section className="admin-summary-grid">
        <article className="panel-card">
          <p className="eyebrow">Fila atual</p>
          <p className="stat-highlight">{summary.pending}</p>
          <p>Perfis aguardando analise.</p>
        </article>
        <article className="panel-card">
          <p className="eyebrow">Aprovados</p>
          <p className="stat-highlight">{summary.approved}</p>
          <p>Perfis ja liberados no ecossistema.</p>
        </article>
        <article className="panel-card">
          <p className="eyebrow">Total listado</p>
          <p className="stat-highlight">{summary.total}</p>
          <p>Talentos carregados via edge function administrativa.</p>
        </article>
      </section>

      {feedback ? <div className="inline-alert inline-alert--success">{feedback}</div> : null}
      {error ? <div className="inline-alert inline-alert--danger">{error}</div> : null}

      {pendingApproval ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setPendingApproval(null)}>
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-without-payment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Confirmacao necessaria</p>
            <h2 id="approve-without-payment-title">Aprovar talento sem pagamento?</h2>
            <p className="muted-text">
              <strong>{pendingApproval.profile.display_name}</strong> ainda nao concluiu o pagamento da inscricao. Voce pode
              aprovar mesmo assim: o talento tera acesso ao painel e a cobranca PIX pendente sera cancelada.
            </p>
            <div className="talent-action-row">
              <button type="button" className="button button--ghost" disabled={isPending} onClick={() => setPendingApproval(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={isPending}
                onClick={() => reviewTalent(pendingApproval, "approved")}
              >
                {isPending ? "Processando..." : "Sim, aprovar sem pagamento"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="panel-card">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Talentos</p>
            <h2>Curadoria sem trocar de tela</h2>
          </div>

          <button type="button" className="button button--ghost" onClick={() => void loadTalents()} disabled={isLoading || isPending}>
            {isLoading ? "Atualizando..." : "Atualizar lista"}
          </button>
        </div>

        {isLoading ? <p className="muted-text">Carregando talentos...</p> : null}
        {!isLoading && items.length === 0 ? <p className="muted-text">Nenhum talento encontrado no Supabase ainda.</p> : null}

        <div className="talent-stack">
          {items.map((item) => {
            const isExpanded = expandedId === item.profile.id;
            const mediaSource = getDisplayMediaForRequest(item.pendingRequest, item.media);
            const profilePhoto = mediaSource.filter((media) => media.media_kind === "profile_photo");
            const introVideos = mediaSource.filter((media) => media.media_kind === "intro_video");
            const galleryImages = mediaSource.filter((media) => media.media_kind === "gallery_image");

            return (
              <article key={item.profile.id} className="talent-card" data-expanded={isExpanded}>
                <button
                  type="button"
                  className="talent-card__summary"
                  onClick={() => setExpandedId(isExpanded ? null : item.profile.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="talent-card__identity">
                    <strong>{item.profile.display_name}</strong>
                    <span>{item.user?.email ?? item.profile.full_name}</span>
                  </div>

                  <div className="talent-card__meta">
                    <StatusBadge tone={toProfileTone(item.profile.status)}>{formatProfileStatus(item.profile.status)}</StatusBadge>
                    {item.profile.registration_payment_status && item.profile.registration_payment_status !== "not_required" ? (
                      <StatusBadge tone={toRegistrationPaymentTone(item.profile.registration_payment_status)}>
                        {formatRegistrationPaymentStatus(item.profile.registration_payment_status)}
                      </StatusBadge>
                    ) : null}
                    <span>{formatLocation(item.profile.city_name, item.profile.state_sigla)}</span>
                    <span>{item.pendingRequest ? formatChangeRequestType(item.pendingRequest.request_type) : "Sem pendencia"}</span>
                    <span>{formatDateTime(item.profile.submitted_at)}</span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="talent-card__expanded">
                    <section className="talent-hero-card">
                      <div className="stack">
                        <p className="eyebrow">Dados do talento</p>
                        <h3>{item.profile.status === "pending_review" ? "Perfil aguardando validacao administrativa." : "Perfil ja revisado."}</h3>
                        <p className="muted-text">
                          {item.profile.bio?.trim() || "O talento ainda nao enviou uma biografia detalhada."}
                        </p>
                      </div>

                      {item.pendingRequest ? (
                        <div className="talent-hero-card__actions">
                          <button type="button" className="button button--primary" disabled={isPending} onClick={() => requestApproval(item)}>
                            {isPending ? "Processando..." : "Aprovar talento"}
                          </button>
                        </div>
                      ) : (
                        <StatusBadge tone={toProfileTone(item.profile.status)}>{formatProfileStatus(item.profile.status)}</StatusBadge>
                      )}
                    </section>

                    <div className="talent-expanded-grid">
                      <article className="panel-card panel-card--nested">
                        <p className="eyebrow">Resumo pessoal</p>
                        <h3>Informacoes principais</h3>
                        <dl className="detail-list">
                          <div>
                            <dt>Nome de exibicao</dt>
                            <dd>{item.profile.display_name}</dd>
                          </div>
                          <div>
                            <dt>Email</dt>
                            <dd>{item.user?.email ?? "Nao informado"}</dd>
                          </div>
                          <div>
                            <dt>Nome completo</dt>
                            <dd>{item.profile.full_name}</dd>
                          </div>
                          <div>
                            <dt>Localidade</dt>
                            <dd>{formatLocation(item.profile.city_name, item.profile.state_sigla)}</dd>
                          </div>
                          <div>
                            <dt>Data de nascimento</dt>
                            <dd>{formatDateOnly(item.profile.birth_date)}</dd>
                          </div>
                          <div>
                            <dt>Slug publico</dt>
                            <dd>{item.profile.public_slug}</dd>
                          </div>
                          <div>
                            <dt>Status do pagamento</dt>
                            <dd>
                              <StatusBadge tone={toRegistrationPaymentTone(item.profile.registration_payment_status)}>
                                {formatRegistrationPaymentStatus(item.profile.registration_payment_status)}
                              </StatusBadge>
                            </dd>
                          </div>
                        </dl>
                      </article>

                      <article className="panel-card panel-card--nested">
                        <p className="eyebrow">Decisao administrativa</p>
                        <h3>Aprovar ou reprovar</h3>
                        {item.pendingRequest ? (
                          <div className="stack">
                            <p className="muted-text">
                              Solicitacao <strong>{formatChangeRequestType(item.pendingRequest.request_type)}</strong> aberta em{" "}
                              <strong>{formatDateTime(item.pendingRequest.created_at)}</strong>.
                            </p>
                            <label className="field-block">
                              <span>Motivo da reprovacao</span>
                              <textarea
                                className="admin-textarea"
                                value={rejectionReasons[item.profile.id] ?? ""}
                                onChange={(event) =>
                                  setRejectionReasons((current) => ({
                                    ...current,
                                    [item.profile.id]: event.target.value
                                  }))
                                }
                                placeholder="Explique o motivo para orientar a proxima submissao."
                              />
                            </label>
                            <div className="talent-action-row">
                              <button type="button" className="button button--danger" disabled={isPending} onClick={() => reviewTalent(item, "rejected")}>
                                {isPending ? "Processando..." : "Reprovar com motivo"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="stack">
                            <p className="muted-text">Nao existe solicitacao pendente para este perfil.</p>
                            {item.profile.rejection_reason ? (
                              <div className="inline-alert inline-alert--danger">
                                <strong>Ultimo motivo:</strong> {item.profile.rejection_reason}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </article>
                    </div>

                    <div className="talent-expanded-grid">
                      <article className="panel-card panel-card--nested">
                        <p className="eyebrow">Midias</p>
                        <h3>Arquivos vinculados</h3>
                        <div className="stack">
                          <MediaGroup title="Foto de perfil" items={profilePhoto} />
                          <MediaGroup title="Video de apresentacao" items={introVideos} />
                          <MediaGroup title="Galeria" items={galleryImages} />
                        </div>
                      </article>

                      <article className="panel-card panel-card--nested">
                        <p className="eyebrow">Historico</p>
                        <h3>Solicitacoes recentes</h3>
                        {item.requests.length === 0 ? (
                          <p className="muted-text">Ainda nao ha solicitacoes registradas.</p>
                        ) : (
                          <div className="history-list">
                            {item.requests.map((request) => (
                              <article key={request.id} className="history-item">
                                <div className="history-item__header">
                                  <strong>{formatChangeRequestType(request.request_type)}</strong>
                                  <StatusBadge tone={toRequestTone(request.status)}>{request.status}</StatusBadge>
                                </div>
                                <p className="muted-text">Criada em {formatDateTime(request.created_at)}</p>
                                {request.rejection_reason ? <p className="muted-text">Motivo: {request.rejection_reason}</p> : null}
                              </article>
                            ))}
                          </div>
                        )}
                      </article>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MediaGroup({
  title,
  items
}: {
  title: string;
  items: AdminTalentListItem["media"];
}) {
  return (
    <section className="detail-block">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted-text">Nenhum item nesta categoria.</p>
      ) : (
        <div className="media-list">
          {items.map((item) => {
            const mediaUrl = getMediaUrl(item);
            const isVideo = item.media_kind === "intro_video" && item.source === "upload";
            const isImage = (item.media_kind === "profile_photo" || item.media_kind === "gallery_image") && item.source === "upload";
            const isYouTube = item.source === "youtube";

            return (
              <article key={item.id} className="media-item">
                <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <strong>{formatMediaKind(item.media_kind)}</strong>
                    {mediaUrl ? (
                      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", wordBreak: "break-all", color: "#0066cc", textDecoration: "underline" }}>
                        {getMediaDisplayName(mediaUrl)}
                      </a>
                    ) : (
                      <span>{item.external_url ?? item.storage_path ?? "Sem referencia de arquivo"}</span>
                    )}
                    <span style={{ display: "block", fontSize: "0.875rem", color: "#666" }}>
                      {item.mime_type ?? "Tipo nao informado"} • {formatFileSize(item.file_size_bytes)}
                    </span>
                  </div>

                  {(isImage || isVideo) && mediaUrl && (
                    <div style={{ flex: 0, minWidth: "120px" }}>
                      {isImage && <img src={mediaUrl} alt="Preview" style={{ maxWidth: "120px", maxHeight: "120px", borderRadius: "4px", objectFit: "cover" }} />}
                      {isVideo && (
                        <video style={{ maxWidth: "120px", maxHeight: "120px", borderRadius: "4px", objectFit: "cover" }} controls>
                          <source src={mediaUrl} type={item.mime_type ?? "video/mp4"} />
                        </video>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getMediaUrl(item: AdminTalentListItem["media"][0]): string | null {
  if (item.signed_url) {
    return item.signed_url;
  }

  if (item.source === "youtube" && item.external_url) {
    return item.external_url;
  }

  return item.external_url ?? null;
}

function getMediaDisplayName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split("/");
    return parts[parts.length - 1] || "Abrir mídia";
  } catch {
    return "Abrir mídia";
  }
}

function toProfileTone(status: string) {
  switch (status) {
    case "pending_review":
      return "pending" as const;
    case "approved":
      return "success" as const;
    case "rejected":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function formatLocation(cityName?: string | null, stateSigla?: string | null) {
  const city = cityName?.trim();
  const state = stateSigla?.trim();

  if (city && state) {
    return `${city}, ${state}`;
  }

  if (city) {
    return city;
  }

  if (state) {
    return state;
  }

  return "Nao informado";
}

function toRequestTone(status: string) {
  switch (status) {
    case "pending":
      return "pending" as const;
    case "approved":
      return "success" as const;
    case "rejected":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function getDisplayMediaForRequest(pendingRequest: AdminTalentListItem["pendingRequest"], currentMedia: AdminTalentListItem["media"]) {
  if (!pendingRequest?.proposed_media || !Array.isArray(pendingRequest.proposed_media)) {
    return currentMedia;
  }

  const normalized = pendingRequest.proposed_media
    .filter(isRecord)
    .map((item, index) => ({
      id: `pending-${pendingRequest.id}-${index}`,
      talent_profile_id: pendingRequest.talent_profile_id,
      media_kind: toMediaKind(item.mediaKind) ?? ("gallery_image" as const),
      source: toMediaSource(item.source) ?? ("upload" as const),
      storage_bucket: toNullableString(item.storageBucket),
      storage_path: toNullableString(item.storagePath),
      external_url: toNullableString(item.externalUrl),
      signed_url: toNullableString(item.signed_url),
      mime_type: toNullableString(item.mimeType),
      file_size_bytes: toNullableNumber(item.fileSizeBytes),
      sort_order: typeof item.sortOrder === "number" ? item.sortOrder : index,
      is_active: true,
      created_at: "",
      updated_at: ""
    }))
    .filter((item) => item.media_kind && item.source);

  return normalized.length > 0 ? normalized : currentMedia;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMediaKind(value: unknown): "gallery_image" | "intro_video" | "profile_photo" | null {
  return value === "gallery_image" || value === "intro_video" || value === "profile_photo" ? value : null;
}

function toMediaSource(value: unknown): "upload" | "youtube" | null {
  return value === "upload" || value === "youtube" ? value : null;
}
