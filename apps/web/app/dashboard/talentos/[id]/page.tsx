import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { approveTalentProfileAction, rejectTalentProfileAction } from "../../actions";
import { BrandMark } from "../../../../components/brand-mark";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { FormSubmitButton } from "../../../../components/form-submit-button";
import { StatusBadge } from "../../../../components/status-badge";
import {
  formatChangeRequestType,
  formatDateOnly,
  formatDateTime,
  formatFileSize,
  formatMediaKind,
  formatProfileStatus
} from "../../../../lib/admin-presenters";
import { getTalentProfileDetailForAdmin, requireAdminViewer } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

export default async function TalentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminViewer();
  const { id } = await params;
  const detail = await getTalentProfileDetailForAdmin(id);

  if (!detail) {
    notFound();
  }

  const { profile, user, media, requests, pendingRequest } = detail;
  const profilePhoto = media.filter((item) => item.media_kind === "profile_photo");
  const introVideos = media.filter((item) => item.media_kind === "intro_video");
  const galleryImages = media.filter((item) => item.media_kind === "gallery_image");

  return (
    <main className="dashboard-shell">
      <section className="dashboard-shell__frame">
        <header className="dashboard-header panel-card">
          <div className="stack">
            <BrandMark href={"/dashboard" as Route} />
            <div>
              <p className="eyebrow">Detalhe do talento</p>
              <h1>{profile.display_name}</h1>
              <p className="muted-text">
                Perfil publico em <strong>{profile.public_slug}</strong>, vinculado a <strong>{user?.email ?? profile.full_name}</strong>.
              </p>
            </div>
          </div>

          <Link href={"/dashboard/talentos" as Route} className="text-link">
            Voltar para a lista <span aria-hidden="true">→</span>
          </Link>
        </header>

        <DashboardNav />

        <section className="admin-detail-grid">
          <article className="panel-card">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">Resumo</p>
                <h2>Dados principais</h2>
              </div>
              <StatusBadge tone={toProfileTone(profile.status)}>{formatProfileStatus(profile.status)}</StatusBadge>
            </div>

            <dl className="detail-list">
              <div>
                <dt>Nome completo</dt>
                <dd>{profile.full_name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user?.email ?? "Nao informado"}</dd>
              </div>
              <div>
                <dt>Nascimento</dt>
                <dd>{formatDateOnly(profile.birth_date)}</dd>
              </div>
              <div>
                <dt>Cidade</dt>
                <dd>{formatLocation(profile.city_name ?? profile.city, profile.state_sigla ?? profile.state_code)}</dd>
              </div>
              <div>
                <dt>Enviado em</dt>
                <dd>{formatDateTime(profile.submitted_at)}</dd>
              </div>
              <div>
                <dt>Revisado em</dt>
                <dd>{formatDateTime(profile.reviewed_at)}</dd>
              </div>
            </dl>

            <div className="detail-block">
              <h3>Biografia</h3>
              <p>{profile.bio?.trim() || "Sem biografia preenchida."}</p>
            </div>

            {profile.rejection_reason ? (
              <div className="inline-alert inline-alert--danger">
                <strong>Motivo da reprovacao:</strong> {profile.rejection_reason}
              </div>
            ) : null}
          </article>

          <aside className="stack">
            <article className="panel-card">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">Decisao administrativa</p>
                  <h2>Aprovar ou reprovar</h2>
                </div>
              </div>

              {pendingRequest ? (
                <div className="stack">
                  <p className="muted-text">
                    Solicitacao pendente do tipo <strong>{formatChangeRequestType(pendingRequest.request_type)}</strong>, aberta em{" "}
                    <strong>{formatDateTime(pendingRequest.created_at)}</strong>.
                  </p>

                  <form action={approveTalentProfileAction} className="stack">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="changeRequestId" value={pendingRequest.id} />
                    <FormSubmitButton idleLabel="Aprovar talento" pendingLabel="Aprovando..." />
                  </form>

                  <form action={rejectTalentProfileAction} className="admin-form stack">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="changeRequestId" value={pendingRequest.id} />
                    <label className="field-block">
                      <span>Motivo da reprovacao</span>
                      <textarea
                        name="reason"
                        required
                        minLength={3}
                        placeholder="Explique o motivo para orientar o talento na proxima submissao."
                        className="admin-textarea"
                      />
                    </label>
                    <FormSubmitButton idleLabel="Reprovar com motivo" pendingLabel="Reprovando..." variant="danger" />
                  </form>
                </div>
              ) : (
                <p className="muted-text">Nao existe solicitacao pendente para este perfil no momento.</p>
              )}
            </article>

            <article className="panel-card">
              <p className="eyebrow">Historico</p>
              <h2>Solicitacoes recentes</h2>

              {requests.length === 0 ? (
                <p className="muted-text">Ainda nao ha solicitacoes registradas.</p>
              ) : (
                <div className="history-list">
                  {requests.map((request) => (
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
          </aside>
        </section>

        <section className="section-shell">
          <article className="panel-card">
            <p className="eyebrow">Midias aplicadas</p>
            <h2>Arquivos vinculados ao perfil</h2>

            <div className="stack">
              <MediaGroup title="Foto de perfil" items={profilePhoto} />
              <MediaGroup title="Video de apresentacao" items={introVideos} />
              <MediaGroup title="Galeria" items={galleryImages} />
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function MediaGroup({
  title,
  items
}: {
  title: string;
  items: Array<{
    id: string;
    media_kind: "gallery_image" | "intro_video" | "profile_photo";
    source: "upload" | "youtube";
    storage_bucket: string | null;
    storage_path: string | null;
    external_url: string | null;
    mime_type: string | null;
    file_size_bytes: number | null;
  }>;
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

function getMediaUrl(item: {
  source: "upload" | "youtube";
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  signed_url?: string | null;
}): string | null {
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

function formatLocation(city: string | null | undefined, stateCode: string | null | undefined) {
  const parts = [city?.trim(), stateCode?.trim()].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" - ") : "Nao informado";
}

