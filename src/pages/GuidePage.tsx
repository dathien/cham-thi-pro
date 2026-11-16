import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NavPage } from '../types/omr';

const STEPS: { step: number; title: string; desc: string; page: NavPage; cta: string }[] = [
  {
    step: 1,
    title: 'Tạo kỳ kiểm tra',
    desc: 'Thiết lập tên trường (mặc định TRƯỜNG THPT), tên kỳ kiểm tra, môn học, khối lớp, thang điểm, ngưỡng đạt, mẫu phiếu và danh sách mã đề.',
    page: 'exams',
    cta: 'Mở Kỳ kiểm tra',
  },
  {
    step: 2,
    title: 'Nhập danh sách học sinh',
    desc: 'Tạo các lớp học, tải file Excel mẫu hoặc nhập trực tiếp danh sách học sinh từ Excel/CSV. Giữ nguyên số 0 ở đầu số báo danh và phát hiện trùng SBD.',
    page: 'classes',
    cta: 'Mở Lớp & học sinh',
  },
  {
    step: 3,
    title: 'Chọn hoặc thiết kế phiếu thi',
    desc: 'Chọn mẫu THPT từ năm 2025, mẫu truyền thống (10–100 câu), phiếu ghép đôi A5 hay phiếu rọc phách A3; hoặc tùy biến / đánh dấu trực tiếp trên mẫu tải lên.',
    page: 'templates',
    cta: 'Mở Mẫu phiếu thi',
  },
  {
    step: 4,
    title: 'Tạo mã đề và nhập đáp án',
    desc: 'Tạo hàng loạt mã đề (101, 102...), nhập đáp án bằng bảng tương tác, dán nhanh, nhập Excel hoặc quét từ phiếu tô đáp án đã kiểm duyệt.',
    page: 'answers',
    cta: 'Mở Đáp án & thang điểm',
  },
  {
    step: 5,
    title: 'In phiếu cho học sinh làm bài',
    desc: 'Xuất file PDF chuẩn kích thước A4/A5/A3 có 4 điểm định vị rõ nét và khoảng trắng an toàn để in phát cho học sinh.',
    page: 'templates',
    cta: 'In mẫu phiếu',
  },
  {
    step: 6,
    title: 'Chấm bằng Camera hoặc PDF/Ảnh',
    desc: 'Dùng Camera điện thoại/máy tính tự động bắt 4 điểm định vị và chụp khi ổn định, hoặc tải lên hàng loạt file PDF nhiều trang và ảnh chụp.',
    page: 'camera',
    cta: 'Mở Chấm Camera',
  },
  {
    step: 7,
    title: 'Kiểm duyệt các bài chưa chắc chắn',
    desc: 'Kiểm tra các bài có dấu hiệu tô mờ, tô nhiều đáp án, tẩy xóa, thiếu điểm định vị hoặc sai SBD/Mã đề trước khi đưa vào bảng điểm chính thức.',
    page: 'review',
    cta: 'Mở Kiểm duyệt bài thi',
  },
  {
    step: 8,
    title: 'Xuất bảng điểm và phiếu trả bài',
    desc: 'Xem bảng điểm, xuất Excel XLSX / CSV / mẫu cột vnEdu & SMAS, xuất phiếu trả bài PDF tiếng Việt (hoặc file ZIP cả lớp) và phân tích chất lượng đề.',
    page: 'gradebook',
    cta: 'Mở Bảng điểm',
  },
];

export const GuidePage: React.FC = () => {
  const { setActivePage } = useApp();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1E293B]">Hướng dẫn sử dụng quy trình 8 bước</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quy trình chấm thi trắc nghiệm OMR khép kín, bảo mật cục bộ và hoạt động hoàn toàn ngoại tuyến.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STEPS.map((item) => (
          <div
            key={item.step}
            className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3"
          >
            <div>
              <div className="text-xs font-semibold text-[#2563EB] font-mono-num">
                Bước {item.step}
              </div>
              <h2 className="text-sm font-bold text-[#1E293B] mt-0.5">{item.title}</h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{item.desc}</p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setActivePage(item.page)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline"
              >
                {item.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
