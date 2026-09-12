import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';

// Layout
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Breadcrumbs } from './components/layout/Breadcrumbs';

// Pages
import { LoginPage } from './pages/LoginPage';
import { HomeDashboard } from './pages/HomeDashboard';
import { MyWorkPage } from './pages/MyWorkPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { KanbanBoardPage } from './pages/KanbanBoardPage';
import { BacklogPage } from './pages/BacklogPage';
import { SprintsPage } from './pages/SprintsPage';
import { ChatPage } from './pages/ChatPage';
import { TeamsPage } from './pages/TeamsPage';
import { CalendarPage } from './pages/CalendarPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { FilesPage } from './pages/FilesPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { AiSettingsPage } from './pages/AiSettingsPage';
import { SecurityCenterPage } from './pages/SecurityCenterPage';
import { LandingPage } from './pages/LandingPage';
import { SignupPage } from './pages/SignupPage';
import { BillingPage } from './pages/BillingPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { DeveloperAppsPage } from './pages/DeveloperAppsPage';
import { KnowledgeHubPage } from './pages/KnowledgeHubPage';
import { GovernancePage } from './pages/GovernancePage';
import { OpsDashboardPage } from './pages/OpsDashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { CapacityPlanningPage } from './pages/CapacityPlanningPage';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { MobileDrawer } from './components/layout/MobileDrawer';

import { GitHubCallbackPage } from './pages/GitHubCallbackPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RoleGuard } from './components/common/RoleGuard';

const ProtectedLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-canvas flex flex-col items-center justify-center text-xs text-ink font-sans space-y-3">
        <div className="w-8 h-8 rounded-xl bg-olive flex items-center justify-center text-white font-black text-sm shadow-sm animate-pulse">
          TMP
        </div>
        <div className="editorial-eyebrow text-[10px]">[ OPERATING SYSTEM ]</div>
        <div className="font-semibold text-xs text-ink/70">Loading Enterprise Workstation...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      <Route
        path="*"
        element={
          !user ? (
            <LoginPage />
          ) : (
            <SocketProvider>
              <div className="flex h-screen w-screen bg-canvas text-ink overflow-hidden font-sans">
                {/* Left Collapsible Navigation Sidebar (hidden on mobile) */}
                <div className="hidden md:block h-full">
                  <Sidebar />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden pb-14 md:pb-0 bg-canvas">
                  <Header />
                  <Breadcrumbs />
                  <main className="flex-1 overflow-y-auto bg-canvas relative">
                    <ErrorBoundary>
                      <Routes>
                        <Route path="/" element={<HomeDashboard />} />
                        <Route path="/my-work" element={<MyWorkPage />} />
                        <Route path="/projects" element={<ProjectsPage />} />
                        <Route path="/projects/:key" element={<ProjectDetailPage />} />
                        <Route path="/projects/:key/overview" element={<ProjectDetailPage />} />
                        <Route path="/projects/:key/board" element={<KanbanBoardPage />} />
                        <Route path="/projects/:key/backlog" element={<BacklogPage />} />
                        <Route path="/projects/:key/sprints" element={<SprintsPage />} />
                        <Route path="/projects/:key/analytics" element={<AnalyticsPage />} />
                        <Route path="/projects/:key/chat" element={<ChatPage />} />
                        <Route path="/projects/:key/files" element={<FilesPage />} />
                        <Route path="/boards" element={<KanbanBoardPage />} />
                        <Route path="/backlogs" element={<BacklogPage />} />
                        <Route path="/sprints" element={<SprintsPage />} />
                        <Route path="/chat" element={<ChatPage />} />
                        <Route path="/teams" element={<TeamsPage />} />
                        <Route path="/calendar" element={<CalendarPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/files" element={<FilesPage />} />
                        <Route path="/integrations" element={<IntegrationsPage />} />
                        <Route path="/automations" element={<AutomationsPage />} />
                        <Route path="/templates" element={<TemplatesPage />} />
                        <Route path="/knowledge" element={<KnowledgeHubPage />} />
                        <Route path="/collaboration" element={<KnowledgeHubPage />} />
                        <Route path="/landing" element={<LandingPage />} />
                        <Route path="/pricing" element={<RoleGuard minRole="ADMIN"><LandingPage /></RoleGuard>} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/settings/ai" element={<RoleGuard minRole="ADMIN"><AiSettingsPage /></RoleGuard>} />
                        <Route path="/settings/security" element={<RoleGuard minRole="ADMIN"><SecurityCenterPage /></RoleGuard>} />
                        <Route path="/settings/billing" element={<RoleGuard minRole="ADMIN"><BillingPage /></RoleGuard>} />
                        <Route path="/settings/developer-apps" element={<RoleGuard minRole="ADMIN"><DeveloperAppsPage /></RoleGuard>} />
                        <Route path="/settings/governance" element={<RoleGuard minRole="ADMIN"><GovernancePage /></RoleGuard>} />
                        <Route path="/governance" element={<RoleGuard minRole="ADMIN"><GovernancePage /></RoleGuard>} />
                        <Route path="/settings/ops" element={<RoleGuard minRole="ADMIN"><OpsDashboardPage /></RoleGuard>} />
                        <Route path="/ops" element={<RoleGuard minRole="ADMIN"><OpsDashboardPage /></RoleGuard>} />
                        <Route path="/capacity" element={<RoleGuard minRole="PROJECT_MANAGER"><CapacityPlanningPage /></RoleGuard>} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </ErrorBoundary>
                  </main>
                </div>

                {/* Mobile Navigation Controls */}
                <MobileBottomNav onOpenDrawer={() => setIsDrawerOpen(true)} />
                <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
              </div>
            </SocketProvider>
          )
        }
      />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProtectedLayout />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
