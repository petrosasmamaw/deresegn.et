export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-16 px-4">
      {Icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg mb-4" style={{ background: 'var(--color-primary-muted)' }}>
          <Icon size={32} style={{ color: 'var(--color-primary)' }} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="section-title mb-2">{title}</h3>
      <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">{description}</p>
    </div>
  )
}
