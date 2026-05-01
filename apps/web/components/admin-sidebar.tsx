"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./auth/sign-out-button";
import { BrandMark } from "./brand-mark";

const items = [
  { href: "/dashboard", label: "Painel inicial", shortLabel: "01" },
  { href: "/dashboard/talentos", label: "Talentos", shortLabel: "02" },
  { href: "/dashboard/eleicoes", label: "Eleicoes", shortLabel: "03" }
] as const;

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__top">
        <div className="admin-sidebar__brand">
          <BrandMark href={"/dashboard" as Route} compact />
        </div>

        <section className="admin-sidebar__identity">
          <p className="admin-sidebar__label">Area do admin</p>
          <strong>{email}</strong>
        </section>

        <nav className="admin-sidebar__nav" aria-label="Menu lateral do painel administrativo">
          {items.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link key={item.href} href={item.href as Route} className="admin-sidebar__nav-link" data-active={isActive}>
                <span>{item.label}</span>
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="admin-sidebar__bottom">
        <SignOutButton />
      </div>
    </aside>
  );
}
