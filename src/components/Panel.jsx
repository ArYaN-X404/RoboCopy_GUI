export default function Panel({ title, description, children, actions }) {
  return (
    <section className="crystal-shell squircle shadow-float min-w-0 space-y-5 p-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? <p className="text-sm text-white/60">{description}</p> : null}
        </div>
        {actions ? <div className="flex min-w-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
