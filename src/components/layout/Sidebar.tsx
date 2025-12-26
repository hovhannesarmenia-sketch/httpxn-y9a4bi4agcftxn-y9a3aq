import { Calendar, Users, Settings, Activity, Stethoscope, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export function Sidebar({ activeTab, onTabChange, onLogout }: SidebarProps) {
  const { t, language, setLanguage } = useLanguage();

  const navItems = [
    { id: 'calendar', icon: Calendar, label: t('nav.calendar') },
    { id: 'patients', icon: Users, label: t('nav.patients') },
    { id: 'settings', icon: Settings, label: t('nav.settings') },
    { id: 'diagnostics', icon: Activity, label: t('nav.diagnostics') },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar transition-transform lg:translate-x-0 -translate-x-full" style={{ background: 'var(--gradient-sidebar)' }}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
            <Stethoscope className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">MedBook</h1>
            <p className="text-xs text-sidebar-foreground/60">
              {t('ui.doctorPanel')}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'sidebar-nav-item w-full',
                activeTab === item.id && 'active'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Language Switcher & Logout */}
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('ARM')}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                language === 'ARM'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'bg-sidebar-accent text-sidebar-foreground/70 hover:bg-sidebar-accent/80'
              )}
            >
              {t('ui.languageArm')}
            </button>
            <button
              onClick={() => setLanguage('RU')}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                language === 'RU'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'bg-sidebar-accent text-sidebar-foreground/70 hover:bg-sidebar-accent/80'
              )}
            >
              Русский
            </button>
          </div>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">{t('common.logout')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
