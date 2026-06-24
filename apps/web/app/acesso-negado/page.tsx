import Link from "next/link";
import { BrandMark } from "../../components/brand-mark";

export default function AccessDeniedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-shell__panel">
        <header className="auth-shell__header">
          <BrandMark />
        </header>

        <section className="auth-layout">
          <article className="panel-card auth-copy">
            <p className="eyebrow">Acesso restrito</p>
            <h1>Seu usuario nao tem permissao de admin.</h1>
            <p>
              O painel administrativo verifica a tabela <strong>`public.admins`</strong>. Para entrar no `/dashboard`, seu usuario precisa estar
              vinculado nela com <strong>`is_active = true`</strong>.
            </p>
            <ul className="bullet-list">
              <li>Confirme se o usuario certo foi usado no login.</li>
              <li>Verifique se existe um registro para esse `user_id` na tabela `admins`.</li>
              <li>Depois disso, faca login novamente e tente acessar o painel.</li>
            </ul>
            <div className="hero__actions">
              <Link href="/login" className="button button--primary">
                Voltar para login
              </Link>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
