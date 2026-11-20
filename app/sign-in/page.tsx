"use client";

import { signIn } from "next-auth/react";
import { Brand } from "@/components/ui";

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <Brand className="mb-8" />
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="muted mt-2">Use your work Google account. You&apos;ll also be asked to allow sending email from your Gmail — the app only sends when you click &ldquo;Approve &amp; send&rdquo;.</p>
        <button className="btn btn-primary mt-6 w-full" onClick={() => signIn("google", { callbackUrl: "/" })}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
