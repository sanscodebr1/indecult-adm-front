"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@indecult/ui";
import { signOut } from "@indecult/supabase";
import { createWebBrowserSupabaseClient } from "../../lib/supabase-browser";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const supabase = createWebBrowserSupabaseClient();
          await signOut(supabase);
          router.push("/login");
          router.refresh();
        })
      }
    >
      {isPending ? "Saindo..." : "Sair"}
    </Button>
  );
}
