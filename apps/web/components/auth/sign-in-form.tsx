"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@indecult/ui";
import { signInWithEmailAndPassword } from "@indecult/supabase";
import { createWebBrowserSupabaseClient } from "../../lib/supabase-browser";

export function SignInForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="panel-card panel-card--form">
      <div className="stack">
        <p className="eyebrow">Acesso administrativo</p>
        <h1>Entrar no painel</h1>
        <p>Use sua conta do Supabase para acessar triagem de perfis, eleicoes e trilha de auditoria.</p>
      </div>

      <form
        style={formStyle}
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);

          const formData = new FormData(event.currentTarget);
          const email = String(formData.get("email") ?? "");
          const password = String(formData.get("password") ?? "");

          startTransition(async () => {
            const supabase = createWebBrowserSupabaseClient();
            const result = await signInWithEmailAndPassword(supabase, { email, password });

            if (result.error) {
              setError(result.error.message);
              return;
            }

            router.push("/dashboard");
            router.refresh();
          });
        }}
      >
        <Field label="Email">
          <Input type="email" name="email" placeholder="Digite seu e-mail" required />
        </Field>
        <Field label="Senha">
          <Input type="password" name="password" placeholder="Digite sua senha" required minLength={6} />
        </Field>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar no painel"}
        </Button>
        {error ? <p style={errorStyle}>{error}</p> : null}
      </form>
    </div>
  );
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: 18
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#b91c1c",
  lineHeight: 1.6
};
