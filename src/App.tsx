import React, { useEffect } from 'react';
import { scheduleDriveSync } from './engine/googleDriveSync';
import { Layout } from './components/Layout';
import { AppProvider, useApp } from './context/AppContext';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AnswerKeysPage } from './pages/AnswerKeysPage';
import { BackupRestorePage } from './pages/BackupRestorePage';
import { BatchGradingPage } from './pages/BatchGradingPage';
import { CameraGradingPage } from './pages/CameraGradingPage';
import { ClassesStudentsPage } from './pages/ClassesStudentsPage';
import { DocumentScannerPage } from './pages/DocumentScannerPage';
import { ExamsPage } from './pages/ExamsPage';
import { GradebookPage } from './pages/GradebookPage';
import { GuidePage } from './pages/GuidePage';
import { OverviewPage } from './pages/OverviewPage';
import { ReportCardsPage } from './pages/ReportCardsPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplateDesignerPage } from './pages/TemplateDesignerPage';
import { TemplatesLibraryPage } from './pages/TemplatesLibraryPage';

const DriveOnlineListener: React.FC = () => {
  useEffect(() => {
    window.addEventListener('online', scheduleDriveSync);
    return () => window.removeEventListener('online', scheduleDriveSync);
  }, []);
  return null;
};

const PageRouter: React.FC = () => {
  const { ready, activePage } = useApp();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-xs text-slate-600">
        Đang khởi tạo dữ liệu cục bộ IndexedDB...
      </div>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <OverviewPage />;
      case 'exams':
        return <ExamsPage />;
      case 'classes':
        return <ClassesStudentsPage />;
      case 'templates':
        return <TemplatesLibraryPage />;
      case 'designer':
        return <TemplateDesignerPage />;
      case 'answers':
        return <AnswerKeysPage />;
      case 'camera':
        return <CameraGradingPage />;
      case 'batch':
        return <BatchGradingPage />;
      case 'scanner':
        return <DocumentScannerPage />;
      case 'review':
        return <ReviewPage />;
      case 'gradebook':
        return <GradebookPage />;
      case 'report-cards':
        return <ReportCardsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'backup':
        return <BackupRestorePage />;
      case 'settings':
        return <SettingsPage />;
      case 'guide':
        return <GuidePage />;
      default:
        return <OverviewPage />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
};

export default function App() {
  return (
    <AppProvider>
      <DriveOnlineListener />
      <PageRouter />
    </AppProvider>
  );
}
