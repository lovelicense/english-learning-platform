export function DashboardShell({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <section className="mx-auto max-w-5xl rounded-3xl bg-white p-10 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-slate-600">{subtitle}</p>
      </section>
    </main>
  );
}
