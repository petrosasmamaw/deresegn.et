export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && <Icon size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} strokeWidth={1.5} />}
      <h3 className="section-title mb-2">{title}</h3>
      <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] max-w-sm mx-auto">{description}</p>
    </div>
  )
}
