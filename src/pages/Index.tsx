import { useState } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CalendarView } from '@/components/calendar/CalendarView';
import { Stethoscope } from 'lucide-react';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('calendar');

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 pb-20 lg:pt-0 lg:pb-0 min-h-screen">
        <div className="p-4 lg:p-8">
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'patients' && (
            <div className="medical-card p-8 text-center">
              <Stethoscope className="h-12 w-12 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Пациенты</h2>
              <p className="text-muted-foreground">Раздел в разработке</p>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="medical-card p-8 text-center">
              <Stethoscope className="h-12 w-12 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Настройки</h2>
              <p className="text-muted-foreground">Раздел в разработке</p>
            </div>
          )}
          {activeTab === 'diagnostics' && (
            <div className="medical-card p-8 text-center">
              <Stethoscope className="h-12 w-12 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Диагностика</h2>
              <p className="text-muted-foreground">Раздел в разработке</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const Index = () => {
  return (
    <LanguageProvider>
      <DashboardContent />
    </LanguageProvider>
  );
};

export default Index;
