import Link from "next/link";
import type { Route } from "next";
import { createElectionAction } from "../../actions";
import { FormSubmitButton } from "../../../../components/form-submit-button";
import { formatElectionStatus } from "../../../../lib/admin-presenters";

export const dynamic = "force-dynamic";

export default function NewElectionPage() {
  return (
    <div className="admin-page stack">
      <section className="talent-hero-card">
        <div className="stack">
          <p className="eyebrow">Operacao de eleicoes</p>
          <h1>Criar eleicao</h1>
          <p className="muted-text">Cadastre uma campanha com agenda, visibilidade e limites operacionais.</p>
        </div>

        <Link href={"/dashboard/eleicoes" as Route} className="button button--secondary">
          Voltar para eleicoes
        </Link>
      </section>

      <section className="section-shell section-shell--split">
        <article className="panel-card">
          <p className="eyebrow">Formulario</p>
          <h2>Nova eleicao</h2>

          <form action={createElectionAction} className="admin-form" encType="multipart/form-data">
            <label className="field-block">
              <span>Titulo</span>
              <input type="text" name="title" required minLength={3} placeholder="Ex.: Eleicao talentos 2026" className="admin-input" />
            </label>

            <label className="field-block">
              <span>Slug</span>
              <input type="text" name="slug" placeholder="Opcional. Se vazio, sera gerado automaticamente." className="admin-input" />
            </label>

            <label className="field-block field-block--full">
              <span>Descricao</span>
              <textarea name="description" placeholder="Contexto da campanha, publico esperado e observacoes principais." className="admin-textarea" />
            </label>

            <label className="field-block field-block--full">
              <span>Logotipo (URL)</span>
              <input type="url" name="logoUrl" placeholder="https://exemplo.com/logo-da-eleicao.png" className="admin-input" />
            </label>

            <label className="field-block field-block--full">
              <span>Upload do logotipo</span>
              <input type="file" name="logoFile" accept="image/*" className="admin-input" />
            </label>

            <label className="field-block field-block--full">
              <span>Imagem de capa (URL)</span>
              <input type="url" name="coverUrl" placeholder="https://exemplo.com/capa-da-eleicao.jpg" className="admin-input" />
            </label>

            <label className="field-block field-block--full">
              <span>Upload da capa</span>
              <input type="file" name="coverFile" accept="image/*" className="admin-input" />
            </label>

            <label className="field-block">
              <span>Visibilidade</span>
              <select name="visibility" defaultValue="public" className="admin-input">
                <option value="public">Publica</option>
                <option value="private">Privada</option>
              </select>
            </label>

            <label className="field-block">
              <span>Status inicial</span>
              <select name="status" defaultValue="draft" className="admin-input">
                {["draft", "scheduled", "live", "paused", "finished", "cancelled"].map((status) => (
                  <option key={status} value={status}>
                    {formatElectionStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>Inicio</span>
              <input type="datetime-local" name="startsAt" required className="admin-input" />
            </label>

            <label className="field-block">
              <span>Encerramento</span>
              <input type="datetime-local" name="endsAt" required className="admin-input" />
            </label>

            <label className="field-block">
              <span>Maximo de votos por IP/dia</span>
              <input type="number" min="1" name="maxVotesPerIpPerDay" className="admin-input" />
            </label>

            <label className="field-block">
              <span>Maximo de votos por fingerprint/dia</span>
              <input type="number" min="1" name="maxVotesPerFingerprintPerDay" className="admin-input" />
            </label>

            <label className="checkbox-field field-block--full">
              <input type="checkbox" name="allowPublicResults" defaultChecked />
              <span>Permitir resultados publicos</span>
            </label>

            <div className="field-block--full">
              <FormSubmitButton idleLabel="Criar eleicao" pendingLabel="Criando eleicao..." />
            </div>
          </form>
        </article>
      </section>
    </div>
  );
}
