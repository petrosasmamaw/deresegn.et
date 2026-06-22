import { Home, History, Plus } from 'lucide-react'

export default function BottomNav({ activeTab = 'home', onTabChange, onFabClick }) {
  return (
    <>
      <nav
        className="bottom-nav fixed bottom-0 left-0 right-0 z-30 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="relative">
          <div className="bottom-nav-inner">
            <button
              type="button"
              onClick={() => onTabChange('home')}
              className={`bottom-nav-tab${activeTab === 'home' ? ' bottom-nav-tab-active' : ''}`}
              aria-current={activeTab === 'home' ? 'page' : undefined}
            >
              <Home size={22} strokeWidth={2} />
              <span>Home</span>
            </button>

            <div className="bottom-nav-fab-slot" aria-hidden="true" />

            <button
              type="button"
              onClick={() => onTabChange('history')}
              className={`bottom-nav-tab${activeTab === 'history' ? ' bottom-nav-tab-active' : ''}`}
              aria-current={activeTab === 'history' ? 'page' : undefined}
            >
              <History size={22} strokeWidth={2} />
              <span>History</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onFabClick}
            className="bottom-nav-fab"
            aria-label="Verify Receipt"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>
      </nav>

      <div className="bottom-nav-spacer md:hidden" aria-hidden="true" />
    </>
  )
}
