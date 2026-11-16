import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  DatabaseBackup,
  Download,
  FileCheck2,
  FileImage,
  FileSpreadsheet,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Maximize2,
  Menu,
  Minimize2,
  PenTool,
  RefreshCw,
  ScanLine,
  Settings,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWA';
import type { NavPage } from '../types/omr';

interface MenuGroup {
  id: string;
  label: string;
  items: { id: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'manage',
    label: 'QUẢN LÝ',
    items: [
      { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'exams', label: 'Kỳ kiểm tra', icon: CalendarDays },
      { id: 'classes', label: 'Lớp và học sinh', icon: Users },
    ],
  },
  {
    id: 'prepare',
    label: 'CHUẨN BỊ CHẤM THI',
    items: [
      { id: 'templates', label: 'Mẫu phiếu thi', icon: FolderKanban },
      { id: 'designer', label: 'Thiết kế phiếu', icon: PenTool },
      { id: 'answers', label: 'Đáp án và thang điểm', icon: CheckSquare },
    ],
  },
  {
    id: 'grade',
    label: 'CHẤM THI',
    items: [
      { id: 'camera', label: 'Chấm bằng Camera', icon: Camera },
      { id: 'batch', label: 'Chấm PDF và ảnh', icon: FileImage },
      { id: 'scanner', label: 'Scan tài liệu', icon: ScanLine },
      { id: 'review', label: 'Kiểm duyệt bài thi', icon: FileCheck2 },
    ],
  },
  {
    id: 'results',
    label: 'KẾT QUẢ',
    items: [
      { id: 'gradebook', label: 'Bảng điểm', icon: FileSpreadsheet },
      { id: 'report-cards', label: 'Phiếu trả bài', icon: BookOpen },
      { id: 'analytics', label: 'Thống kê và phân tích', icon: BarChart3 },
    ],
  },
  {
    id: 'system',
    label: 'HỆ THỐNG',
    items: [
      { id: 'backup', label: 'Sao lưu và khôi phục', icon: DatabaseBackup },
      { id: 'settings', label: 'Cài đặt', icon: Settings },
      { id: 'guide', label: 'Hướng dẫn sử dụng', icon: HelpCircle },
    ],
  },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activePage,
    setActivePage,
    dataScope,
    setDataScope,
    starterSeedingStatus,
    exams,
    activeExamId,
    setActiveExamId,
    submissions,
    opencvStatus,
    opencvError,
    retryLoadOpenCV,
  } = useApp();

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const reviewCount = submissions.filter(
    (s) =>
      !s.isTestSample &&
      s.status === 'needs_review' &&
      (!activeExamId || s.examId === activeExamId)
  ).length;

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen denial
    }
  };

  const handleNav = (id: NavPage) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <nav
      className="flex-1 overflow-y-auto no-scrollbar py-2 px-2.5 space-y-2"
      aria-label="Menu chức năng"
    >
      {/* Compact Scope Switcher for mobile */}
      <div className="md:hidden pb-2 mb-1 border-b border-slate-100">
        <div className="grid grid-cols-2 p-0.5 bg-slate-100 rounded-md text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setDataScope('practice')}
            className={`py-1.5 rounded text-center transition-colors ${
              dataScope === 'practice'
                ? 'bg-white text-[#2563EB] shadow-sm font-semibold'
                : 'text-slate-600'
            }`}
          >
            Dữ liệu thực hành
          </button>
          <button
            type="button"
            onClick={() => setDataScope('official')}
            className={`py-1.5 rounded text-center transition-colors ${
              dataScope === 'official'
                ? 'bg-white text-[#16A34A] shadow-sm font-semibold'
                : 'text-slate-600'
            }`}
          >
            Dữ liệu của tôi
          </button>
        </div>
      </div>

      {MENU_GROUPS.map((group) => {
        const isCollapsed = !!collapsedGroups[group.id];
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
            >
              <span>{group.label}</span>
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
            {!isCollapsed && (
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors text-[13px] ${
                        active
                          ? 'bg-[#2563EB] text-white font-medium'
                          : 'text-[#1E293B] hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active ? 'text-white' : 'text-slate-500'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.id === 'review' && reviewCount > 0 && (
                        <span
                          className={`text-[11px] font-mono-num font-semibold px-1.5 ${
                            active ? 'text-blue-100' : 'text-[#DC2626]'
                          }`}
                        >
                          {reviewCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#1E293B]">
      {/* Header */}
      <header className="no-print sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-3 lg:px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Mở menu điều hướng"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* OMR Brand Logo */}
          <button
            type="button"
            onClick={() => handleNav('overview')}
            className="flex items-center gap-2.5 shrink-0 text-left"
          >
            <svg
              className="w-8 h-8 shrink-0"
              viewBox="0 0 64 64"
              fill="none"
              aria-hidden="true"
            >
              <rect width="64" height="64" rx="12" fill="#2563EB" />
              <rect x="13" y="9" width="38" height="46" rx="3" fill="#FFFFFF" />
              <rect x="16" y="12" width="4" height="4" fill="#1E293B" />
              <rect x="44" y="12" width="4" height="4" fill="#1E293B" />
              <rect x="16" y="48" width="4" height="4" fill="#1E293B" />
              <rect x="44" y="48" width="4" height="4" fill="#1E293B" />
              <circle cx="24" cy="25" r="3" stroke="#94A3B8" strokeWidth="1.4" />
              <circle cx="32" cy="25" r="3" fill="#16A34A" />
              <circle cx="40" cy="25" r="3" stroke="#94A3B8" strokeWidth="1.4" />
              <circle cx="24" cy="34" r="3" fill="#16A34A" />
              <circle cx="32" cy="34" r="3" stroke="#94A3B8" strokeWidth="1.4" />
              <circle cx="40" cy="34" r="3" stroke="#94A3B8" strokeWidth="1.4" />
              <circle cx="24" cy="43" r="3" stroke="#94A3B8" strokeWidth="1.4" />
              <circle cx="32" cy="43" r="3" stroke="#94A3B8" strokeWidth="1.4" />
              <circle cx="40" cy="43" r="3" fill="#16A34A" />
            </svg>
            <span className="font-bold tracking-tight text-[14px] lg:text-[15px] text-[#1E293B] whitespace-nowrap">
              CHẤM THI THÔNG MINH
            </span>
          </button>

          {/* Compact Scope Switcher */}
          <div className="hidden md:flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md ml-2 shrink-0">
            <button
              type="button"
              onClick={() => setDataScope('practice')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                dataScope === 'practice'
                  ? 'bg-white text-[#2563EB] shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              Dữ liệu thực hành
            </button>
            <button
              type="button"
              onClick={() => setDataScope('official')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                dataScope === 'official'
                  ? 'bg-white text-[#16A34A] shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              Dữ liệu của tôi
            </button>
          </div>

          {/* Active Exam Selector */}
          <div className="hidden lg:flex items-center gap-2 pl-3 ml-1 border-l border-slate-200 min-w-0">
            <span className="text-xs text-slate-500 whitespace-nowrap">Kỳ kiểm tra:</span>
            {exams.length > 0 ? (
              <select
                value={activeExamId || ''}
                onChange={(e) => setActiveExamId(e.target.value || null)}
                className="max-w-[240px] truncate text-xs font-medium bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
                aria-label="Chọn kỳ kiểm tra đang làm việc"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.subject})
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('exams')}
                className="text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap"
              >
                + Tạo kỳ kiểm tra
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {starterSeedingStatus?.active && (
            <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-[#2563EB] bg-blue-50 border border-blue-200 rounded px-2.5 py-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Đang chấm mẫu thực hành ({starterSeedingStatus.done}/{starterSeedingStatus.total})
            </span>
          )}

          {/* Online / Offline status */}
          <div
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2 py-1 ${
              isOnline ? 'text-[#16A34A]' : 'text-amber-700'
            }`}
            title={isOnline ? 'Đang kết nối mạng' : 'Đang hoạt động ngoại tuyến (Offline)'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="whitespace-nowrap">{isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
          </div>

          {/* PWA Install CTA */}
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#2563EB] text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cài đặt App</span>
            </button>
          )}
          {!isInstalled && !isInstallable && isIOS && (
            <button
              type="button"
              onClick={() => setShowIOSGuide((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Cài trên iOS</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            aria-label="Chuyển chế độ toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => handleNav('guide')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activePage === 'guide'
                ? 'bg-blue-50 text-[#2563EB]'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden md:inline">Hướng dẫn</span>
          </button>
        </div>
      </header>

      {/* OpenCV Library Readiness Notification */}
      {(opencvStatus === 'loading' || opencvStatus === 'error') && (
        <div
          className={`no-print px-4 py-2 text-xs flex items-center justify-between gap-3 border-b ${
            opencvStatus === 'error'
              ? 'bg-red-50 border-red-200 text-[#DC2626]'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {opencvStatus === 'loading'
                ? 'Thư viện xử lý ảnh OpenCV.js WebAssembly đang được khởi tạo cục bộ. Chức năng chấm OMR sẽ sẵn sàng ngay sau ít giây.'
                : opencvError || 'Thư viện xử lý ảnh OpenCV.js chưa sẵn sàng.'}
            </span>
          </div>
          {opencvStatus === 'error' && (
            <button
              type="button"
              onClick={retryLoadOpenCV}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#DC2626] text-white font-medium hover:bg-red-700 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại
            </button>
          )}
        </div>
      )}

      {/* iOS Install Inline Banner */}
      {showIOSGuide && (
        <div className="no-print bg-blue-50 border-b border-blue-200 px-4 py-2.5 text-xs text-slate-700 flex items-center justify-between gap-3">
          <span>
            Để cài đặt trên iPhone/iPad: Nhấn nút <strong>Chia sẻ (Share)</strong> trên thanh công cụ Safari, sau đó chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
          </span>
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            className="text-slate-500 hover:text-slate-800 font-medium whitespace-nowrap"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Sidebar: sticky with no visible scrollbar while ensuring bottom items stay accessible */}
        <aside className="no-print hidden lg:flex lg:w-[236px] lg:shrink-0 flex-col bg-white border-r border-slate-200 sticky top-14 h-[calc(100vh-3.5rem)]">
          {renderSidebarContent()}
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileMenuOpen && (
          <div className="no-print fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative w-[260px] max-w-[82vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-[#1E293B]">CHẤM THI THÔNG MINH</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {exams.length > 0 && (
                <div className="p-3 border-b border-slate-200">
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Kỳ kiểm tra đang làm việc
                  </label>
                  <select
                    value={activeExamId || ''}
                    onChange={(e) => setActiveExamId(e.target.value || null)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.subject})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {renderSidebarContent()}
            </aside>
          </div>
        )}

        {/* Main Workspace */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
            {children}
          </div>

          {/* Footer - strictly copyright only here */}
          <footer className="no-print border-t border-slate-200 bg-white px-4 lg:px-6 py-3 text-center text-xs text-slate-500">
            Copyright © 2026 – Phát triển bởi Thầy Hồ Nguyễn Đa Thiện
          </footer>
        </main>
      </div>
    </div>
  );
};
