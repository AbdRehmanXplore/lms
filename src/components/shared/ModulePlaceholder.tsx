import Link from "next/link";

type Props = {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
};

export function ModulePlaceholder({ title, description, primaryHref, primaryLabel }: Props) {
  return (
    <section className="surface-card p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-300">{description}</p>
      {primaryHref && primaryLabel && (
        <Link
          href={primaryHref}
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
        >
          {primaryLabel}
        </Link>
      )}
    </section>
  );
}
