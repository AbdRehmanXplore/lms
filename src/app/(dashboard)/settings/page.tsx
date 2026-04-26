export default function SettingsPage() {
  const name = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "NEW OXFORD GRAMMER SCHOOL";
  const addr = process.env.NEXT_PUBLIC_SCHOOL_ADDRESS ?? "";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="surface-card max-w-lg space-y-2 p-6 text-slate-300">
        <p>
          School name (from environment): <strong className="text-slate-100">{name}</strong>
        </p>
        {addr && (
          <p>
            Address: <span className="text-slate-100">{addr}</span>
          </p>
        )}
        <p className="text-sm text-slate-500">Update <code className="text-slate-400">.env.local</code> and redeploy to change printed headers.</p>
      </div>
    </div>
  );
}
