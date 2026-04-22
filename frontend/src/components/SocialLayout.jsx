import { useTenant } from "../TenantContext";

/**
 * @param {{
 *   navItems?: Array<{ key: string, label: string, icon?: import('react').ReactNode, onClick?: () => void, active?: boolean }>,
 *   rightPanel?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function SocialLayout({ navItems = [], rightPanel, children }) {
  const tenant = useTenant();

  return (
    <div className="min-h-screen max-w-7xl mx-auto grid grid-cols-12 gap-6 px-4 text-text">
      <aside className="col-span-3 sticky top-0 h-screen py-6 hidden md:block">
        <nav className="flex flex-col gap-2">
          <a
            href="/"
            className="text-2xl font-bold bg-clip-text text-transparent inline-block mb-4"
            style={{
              backgroundImage: "linear-gradient(to right, var(--accent), var(--gold))",
            }}
          >
            {tenant.brandName}
          </a>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`flex items-center gap-3 px-4 py-3 rounded-full text-left transition-colors ${
                item.active ? "bg-white/5 text-text" : "text-text-muted hover:bg-white/5 hover:text-text"
              }`}
            >
              {item.icon && <span className="text-lg">{item.icon}</span>}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="col-span-12 md:col-span-6 py-6 md:border-x border-border min-h-screen">
        {children}
      </main>

      <aside className="col-span-3 py-6 hidden lg:block">
        {rightPanel}
      </aside>
    </div>
  );
}
