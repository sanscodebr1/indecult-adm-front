import { SignInForm } from "../../components/auth/sign-in-form";
import { BrandMark } from "../../components/brand-mark";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-shell__panel">
        <header className="auth-shell__header">
          <BrandMark />
        </header>

        <div className="auth-layout">

          <SignInForm />
        </div>
      </section>
    </main>
  );
}
