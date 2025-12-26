import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CalendarView } from '@/components/calendar/CalendarView';
import { PatientsView } from '@/components/patients/PatientsView';
import { SettingsView } from '@/components/settings/SettingsView';
import { DiagnosticsView } from '@/components/diagnostics/DiagnosticsView';
import { Loader2 } from 'lucide-react';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('calendar');
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <LanguageProvider>
      <DashboardContent />
    </LanguageProvider>
  );
};

export default Index;
