"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Visao geral" },
  { href: "/dashboard/talentos", label: "Talentos" },
  { href: "/dashboard/eleicoes/nova", label: "Nova eleicao" }
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="dashboard-nav" aria-label="Navegacao do painel administrativo">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link key={item.href} href={item.href as Route} className="dashboard-nav__link" data-active={isActive}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
