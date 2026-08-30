import { FormEvent, useState } from "react";
import { signIn, signUp } from "../utils/auth";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const { error } = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setMessage(error ? error.message : mode === "signin" ? "Signed in — redirecting…" : "Check your email to confirm your account.");
    if (!error && mode === "signin") window.location.assign("/dashboard");
  }

  return <main><h1>{mode === "signin" ? "Welcome back" : "Create your Knot account"}</h1><form onSubmit={submit}>
    <label>Email<input name="email" type="email" required /></label>
    <label>Password<input name="password" type="password" minLength={8} required /></label>
    <button type="submit">{mode === "signin" ? "Sign in" : "Sign up"}</button>
  </form><p>{message}</p><button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}> {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button></main>;
}
