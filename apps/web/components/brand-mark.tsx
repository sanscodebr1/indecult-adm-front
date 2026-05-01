import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

type BrandMarkProps = {
  href?: Route;
  compact?: boolean;
};

export function BrandMark({ href = "/", compact = false }: BrandMarkProps) {
  return (
    <Link href={href} className={`brand-mark${compact ? " brand-mark--compact" : ""}`} aria-label="Voltar para a pagina inicial da Indecult Admin">
      <span className="brand-mark__badge">
        <Image
          src="/indecult-logotipo.jpg"
          alt="Logo da Indecult"
          width={420}
          height={420}
          priority
          style={{ width: "100%", height: "auto" }}
        />
      </span>
      {!compact ? (
        <span className="brand-mark__copy">
          <span className="brand-mark__title">INDECULT Admin</span>
          <span className="brand-mark__subtitle">Painel de operacao, curadoria e acompanhamento</span>
        </span>
      ) : null}
    </Link>
  );
}
