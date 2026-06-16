import { Home, History, Plus } from 'lucide-react'

export default function BottomNav({ activeTab = 'home', onTabChange, onFabClick }) {
  return (
    <>
      {/* Mobile Bottom Navigation - Hidden on Desktop */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border)] z-30 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Home Tab */}
          <button
            onClick={() => onTabChange('home')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg transition-colors ${
              activeTab === 'home'
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
            title="Home"
          >
            <Home size={24} strokeWidth={2} />
            <span className="text-xs font-semibold">Home</span>
          </button>

          {/* History Tab */}
          <button
            onClick={() => onTabChange('history')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg transition-colors ${
              activeTab === 'history'
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
            title="History"
          >
            <History size={24} strokeWidth={2} />
            <span className="text-xs font-semibold">History</span>
          </button>

          {/* FAB (Center - Verify Receipt) */}
          <button
            onClick={onFabClick}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[var(--color-primary)] text-[var(--color-text-inverted)] shadow-lg flex items-center justify-center hover:bg-[var(--color-primary-hover)] transition-all active:scale-95"
            title="Verify Receipt"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>
      </nav>

      {/* Safe Area Spacer */}
      <div className="md:hidden h-20"></div>
    </>
  )
}
