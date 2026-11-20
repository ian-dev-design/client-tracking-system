import { Brand } from "@/components/ui";

export default function NoAccess() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <Brand className="mb-8" />
        <h1 className="text-2xl font-bold tracking-tight">You don&apos;t have access.</h1>
        <p className="muted mt-2">Ask the owner to add you.</p>
        <a className="btn mt-6" href="/api/auth/signout">Use a different account</a>
      </div>
    </div>
  );
}
