import Link from "next/link";
import type { Route } from "next";
import { BrandMark } from "../components/brand-mark";

const priorityCards: Array<{
  title: string;
  description: string;
  href: Route;
}> = [
  {
    title: "Triagem de cadastros",
    description: "Concentre aprovacoes, rejeicoes e pedidos de ajuste em uma fila unica de analise.",
    href: "/login"
  },
  {
    title: "Operacao de eleicoes",
    description: "Prepare campanhas, acompanhe candidatos e monitore votacao com a base do Supabase compartilhada.",
    href: "/login"
  },
  {
    title: "Auditoria e status",
    description: "Use o painel como ponto central para acompanhar eventos, fluxos criticos e consistencia operacional.",
    href: "/dashboard"
  }
];

const roadmap = [
  "Aprovar ou rejeitar perfis enviados para analise",
  "Gerenciar eleicoes, candidatos e status das campanhas",
  "Acompanhar auditoria, volume de votos e regras do sistema",
  "Evoluir autorizacao modular usando a tabela admins"
];

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="hero">
        <header className="hero__header">
          <BrandMark />
          <nav className="hero__nav">
            <a href="#modulos">Modulos</a>
            <a href="#stack">Stack</a>
            <Link href="/login" className="button button--primary">
              Entrar
            </Link>
          </nav>
        </header>

        <div className="hero__content">
          <div className="stack hero__copy">
            <p className="eyebrow">Painel administrativo</p>
            <h1>Base Turbo pronta para operar o admin da plataforma Indecult.</h1>
            <p className="hero__text">
              A app `web` nasce em Next.js dentro de um monorepo Turbo e compartilha o mesmo Supabase do projeto principal, incluindo migrations e
              edge functions.
            </p>
            <div className="hero__actions">
              <Link href="/login" className="button button--primary">
                Acessar painel
              </Link>
              <Link href="/dashboard" className="button button--secondary">
                Ver estrutura inicial
              </Link>
            </div>
          </div>

          <aside className="hero__summary panel-card">
            <p className="eyebrow">O que ja veio junto</p>
            <div className="stat-grid">
              <div>
                <span className="stat-value">01</span>
                <span className="stat-label">App Next para o admin</span>
              </div>
              <div>
                <span className="stat-value">02</span>
                <span className="stat-label">Pacote compartilhado do Supabase</span>
              </div>
              <div>
                <span className="stat-value">03</span>
                <span className="stat-label">Migrations e edge functions</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="modulos" className="section-shell">
        <div className="section-heading">
          <p className="eyebrow">Frentes iniciais</p>
          <h2>Um ponto de partida orientado a operacao administrativa.</h2>
        </div>

        <div className="card-grid">
          {priorityCards.map((card) => (
            <article key={card.title} className="panel-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <Link href={card.href} className="text-link">
                Abrir caminho inicial <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="stack" className="section-shell section-shell--split">
        <article className="panel-card">
          <p className="eyebrow">Stack do projeto</p>
          <h2>Monorepo preparado para crescer junto com o produto.</h2>
          <ul className="bullet-list">
            <li>Turborepo na raiz com workspaces para apps e packages.</li>
            <li>Next.js 15 na `apps/web`, com typed routes e transpile dos pacotes internos.</li>
            <li>`packages/supabase` com helpers de browser, server, auth e service role.</li>
            <li>`supabase/` copiado com migrations, config e edge functions existentes.</li>
          </ul>
        </article>

        <article className="panel-card">
          <p className="eyebrow">Proximas entregas</p>
          <h2>Roadmap imediato do admin.</h2>
          <ul className="bullet-list">
            {roadmap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
