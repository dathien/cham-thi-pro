import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  CheckSquare,
  FileCheck2,
  FileSpreadsheet,
  FolderKanban,
  Printer,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NavPage } from '../types/omr';

interface GuideStep {
  stepNumber: string;
  title: string;
  description: string;
  page: NavPage;
  ctaLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    stepNumber: '01',
    title: 'Tạo kỳ kiểm tra',
    description:
      'Thiết lập tên trường, tên kỳ kiểm tra, môn học, khối lớp, thang điểm, ngưỡng đạt, mẫu phiếu và danh sách mã đề áp dụng cho kỳ thi.',
    page: 'exams',
    ctaLabel: 'Mở Kỳ kiểm tra',
    icon: CalendarDays,
  },
  {
    stepNumber: '02',
    title: 'Nhập danh sách học sinh',
    description:
      'Tạo các lớp học, tải file Excel mẫu hoặc nhập trực tiếp danh sách học sinh từ Excel/CSV. Hệ thống giữ nguyên số 0 ở đầu số báo danh và phát hiện trùng SBD.',
    page: 'classes',
    ctaLabel: 'Mở Lớp và học sinh',
    icon: Users,
  },
  {
    stepNumber: '03',
    title: 'Chọn hoặc thiết kế phiếu thi',
    description:
      'Chọn mẫu phiếu THPT từ năm 2025, mẫu truyền thống (10–100 câu), phiếu ghép đôi A5 hay phiếu rọc phách A3; hoặc tùy biến và đánh dấu trực tiếp trên mẫu tải lên.',
    page: 'templates',
    ctaLabel: 'Mở Mẫu phiếu thi',
    icon: FolderKanban,
  },
  {
    stepNumber: '04',
    title: 'Tạo mã đề và nhập đáp án',
    description:
      'Tạo hàng loạt mã đề (101, 102...), nhập đáp án bằng bảng tương tác, dán nhanh, nhập từ file Excel hoặc quét trực tiếp từ phiếu tô đáp án đã kiểm duyệt.',
    page: 'answers',
    ctaLabel: 'Mở Đáp án và thang điểm',
    icon: CheckSquare,
  },
  {
    stepNumber: '05',
    title: 'In phiếu cho học sinh làm bài',
    description:
      'Xuất file PDF chuẩn kích thước A4, A5 hoặc A3 có 4 điểm định vị rõ nét cùng khoảng trắng an toàn để in ấn và phát trực tiếp cho học sinh.',
    page: 'templates',
    ctaLabel: 'In mẫu phiếu',
    icon: Printer,
  },
  {
    stepNumber: '06',
    title: 'Chấm bằng Camera hoặc PDF/Ảnh',
    description:
      'Dùng Camera điện thoại hoặc máy tính tự động nhận diện 4 điểm định vị và chụp khi ổn định, hoặc vào mục Chấm PDF và ảnh để tải lên hàng loạt nhiều trang bài thi.',
    page: 'camera',
    ctaLabel: 'Mở Chấm bằng Camera',
    icon: Camera,
  },
  {
    stepNumber: '07',
    title: 'Kiểm duyệt bài thi',
    description:
      'Rà soát các bài có dấu hiệu tô mờ, tô nhiều đáp án, tẩy xóa, thiếu điểm định vị hoặc sai SBD/Mã đề trước khi xác nhận đưa vào bảng điểm chính thức.',
    page: 'review',
    ctaLabel: 'Mở Kiểm duyệt bài thi',
    icon: FileCheck2,
  },
  {
    stepNumber: '08',
    title: 'Xuất bảng điểm và phiếu trả bài',
    description:
      'Xem bảng điểm tổng hợp, xuất Excel chuẩn, xuất PDF hoặc file ZIP phiếu trả bài cá nhân hóa cho từng học sinh và theo dõi thống kê phân tích chất lượng đề.',
    page: 'gradebook',
    ctaLabel: 'Mở Bảng điểm',
    icon: FileSpreadsheet,
  },
];

export const GuidePage: React.FC = () => {
  const { setActivePage } = useApp();

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-[24px] font-bold text-[#1E293B] leading-tight">
          HƯỚNG DẪN SỬ DỤNG
        </h1>
        <p className="text-[15px] text-[#475569] leading-[1.65]">
          Thực hiện 8 bước để chấm thi, kiểm duyệt và xuất kết quả một cách dễ dàng.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] items-stretch">
        {GUIDE_STEPS.map((item) => {
          const IconComponent = item.icon;
          return (
            <article
              key={item.stepNumber}
              className="bg-white border border-slate-200 rounded-[12px] p-[20px] flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-[8px] bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#2563EB] tabular-nums leading-snug">
                      Bước {item.stepNumber}
                    </div>
                    <h2 className="text-[18px] font-bold text-[#1E293B] leading-snug">
                      {item.title}
                    </h2>
                  </div>
                </div>

                <p className="text-[15px] text-[#475569] leading-[1.65]">
                  {item.description}
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setActivePage(item.page)}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] md:min-h-[40px] px-4 py-2 rounded-[8px] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-[14px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                >
                  <span>{item.ctaLabel}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
