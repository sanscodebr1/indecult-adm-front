export function formatProfileStatus(status?: string | null) {
  switch (status) {
    case "pending_review":
      return "Em analise";
    case "approved":
      return "Aprovado";
    case "rejected":
      return "Reprovado";
    case "suspended":
      return "Suspenso";
    case "draft":
    default:
      return "Rascunho";
  }
}

export function formatElectionStatus(status?: string | null) {
  switch (status) {
    case "scheduled":
      return "Agendada";
    case "live":
      return "Ao vivo";
    case "paused":
      return "Pausada";
    case "finished":
      return "Encerrada";
    case "cancelled":
      return "Cancelada";
    case "draft":
    default:
      return "Rascunho";
  }
}

export function formatElectionVisibility(visibility?: string | null) {
  switch (visibility) {
    case "private":
      return "Privada";
    case "public":
    default:
      return "Publica";
  }
}

export function formatChangeRequestType(type?: string | null) {
  switch (type) {
    case "profile_update":
      return "Atualizacao";
    case "initial_submission":
    default:
      return "Primeiro envio";
  }
}

export function formatMediaKind(kind?: string | null) {
  switch (kind) {
    case "profile_photo":
      return "Foto de perfil";
    case "intro_video":
      return "Video de apresentacao";
    case "gallery_image":
    default:
      return "Imagem de galeria";
  }
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Nao informado";
  }

  return new Date(value).toLocaleString("pt-BR");
}

export function formatDateOnly(value?: string | null) {
  if (!value) {
    return "Nao informado";
  }

  return new Date(value).toLocaleDateString("pt-BR");
}

export function formatFileSize(fileSizeBytes?: number | null) {
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return "Tamanho nao informado";
  }

  if (fileSizeBytes < 1024) {
    return `${fileSizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = fileSizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
