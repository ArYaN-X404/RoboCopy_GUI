export default function Panel({ title, description, children, actions }) {
  return (
    <section className="crystal-shell space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? <p className="text-sm text-white/60">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
