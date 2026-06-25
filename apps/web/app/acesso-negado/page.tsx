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
            <h1>Voce nao tem permissao para acessar o painel administrativo.</h1>
            <p>
              Esta area e exclusiva para administradores autorizados. Se voce acredita que deveria ter acesso, entre em contato com a equipe
              responsavel pela plataforma.
            </p>
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
