import { useState } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CalendarView } from '@/components/calendar/CalendarView';
import { PatientsView } from '@/components/patients/PatientsView';
import { SettingsView } from '@/components/settings/SettingsView';
import { DiagnosticsView } from '@/components/diagnostics/DiagnosticsView';

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
          {activeTab === 'patients' && <PatientsView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'diagnostics' && <DiagnosticsView />}
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
