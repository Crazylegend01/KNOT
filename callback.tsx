import { useEffect } from "react";
import { createClient } from "../../utils/supabase";

export default function AuthCallback() {
  useEffect(() => {
    createClient().auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      window.location.replace(error ? "/login" : "/dashboard");
    });
  }, []);
  return <p>Signing you in…</p>;
}
