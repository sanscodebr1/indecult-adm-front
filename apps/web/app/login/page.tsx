import Link from "next/link";
import { SignInForm } from "../../components/auth/sign-in-form";
import { BrandMark } from "../../components/brand-mark";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-shell__panel">
        <header className="auth-shell__header">
          <BrandMark />
          <Link href="/" className="text-link">
            Voltar para a home <span aria-hidden="true">→</span>
          </Link>
        </header>

        <div className="auth-layout">

          <SignInForm />
        </div>
      </section>
    </main>
  );
}
