import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  FolderUp,
  HardDrive,
  Laptop,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import type { GuideIllustrationId } from '../data/guideSections';

interface Props {
  id: GuideIllustrationId;
}

export const GuideIllustration: React.FC<Props> = ({ id }) => {
  switch (id) {
    case 'overview':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { step: '1. QUẢN LÝ', title: 'Kỳ kiểm tra & Lớp', desc: 'Tạo kỳ thi, nhập DS học sinh' },
              { step: '2. CHUẨN BỊ', title: 'Phiếu thi & Đáp án', desc: 'In phiếu A4/A5, nhập đáp án' },
              { step: '3. CHẤM THI', title: 'Camera / PDF / Duyệt', desc: 'Chấm OMR và kiểm duyệt' },
              { step: '4. KẾT QUẢ', title: 'Điểm & Phân tích', desc: 'Excel, Phiếu trả bài, KR-20' },
            ].map((box, idx) => (
              <div key={box.step} className="relative bg-white border border-slate-200 rounded-[8px] p-3.5">
                <div className="text-[13px] font-bold text-[#2563EB]">{box.step}</div>
                <div className="text-[15px] font-bold text-[#1E293B] mt-1">{box.title}</div>
                <div className="text-[14px] text-[#475569] mt-1">{box.desc}</div>
                {idx < 3 && (
                  <ArrowRight className="hidden lg:block w-4 h-4 text-slate-400 absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-[#F8FAFC] rounded-full" />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-blue-50/70 border border-blue-200 rounded-[8px] px-4 py-3 flex items-start gap-2.5">
              <Database className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
              <div>
                <div className="text-[14px] font-bold text-[#1E293B]">Dữ liệu thực hành</div>
                <div className="text-[14px] text-[#475569]">
                  Tích hợp sẵn 5 kỳ thi, 3 lớp, 135 học sinh để trải nghiệm mà không ảnh hưởng dữ liệu thật.
                </div>
              </div>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-[8px] px-4 py-3 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
              <div>
                <div className="text-[14px] font-bold text-[#1E293B]">Dữ liệu của tôi (IndexedDB)</div>
                <div className="text-[14px] text-[#475569]">
                  Lưu 100% cục bộ trên máy giáo viên, hoạt động ngoại tuyến và hoàn toàn tách biệt.
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'exams':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <span className="text-[15px] font-bold text-[#1E293B]">Biểu mẫu: Tạo kỳ kiểm tra</span>
              <span className="px-3 py-1 rounded bg-[#2563EB] text-white text-[13px] font-semibold">
                Lưu kỳ kiểm tra
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[14px]">
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                <div className="text-[#475569]">Tên kỳ kiểm tra *</div>
                <div className="font-semibold text-[#1E293B] mt-0.5">Kiểm tra Giữa kỳ I – Toán 12</div>
              </div>
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                <div className="text-[#475569]">Mẫu phiếu sử dụng</div>
                <div className="font-semibold text-[#2563EB] mt-0.5">Phiếu THPT từ năm 2025</div>
              </div>
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                <div className="text-[#475569]">Thang điểm / Ngưỡng đạt</div>
                <div className="font-semibold text-[#1E293B] mt-0.5 font-mono-num">10 / 5,0 điểm</div>
              </div>
              <div className="sm:col-span-2 border border-slate-200 rounded p-2.5 bg-slate-50">
                <div className="text-[#475569]">Danh sách mã đề (cách nhau bởi dấu phẩy)</div>
                <div className="font-semibold text-[#1E293B] mt-0.5 font-mono-num">101, 102, 103, 104</div>
              </div>
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                <div className="text-[#475569]">Các lớp tham gia</div>
                <div className="font-semibold text-[#16A34A] mt-0.5">☑ 12A1  ☑ 12A2  ☑ 12A3</div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'classes':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[14px] font-bold text-[#1E293B]">
              <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
              Cấu trúc tệp Excel mẫu (Cột SBD định dạng Text giữ số 0 ở đầu)
            </span>
            <span className="px-2.5 py-1 rounded bg-red-50 border border-red-200 text-[#DC2626] text-[13px] font-semibold">
              Cảnh báo tự động nếu trùng SBD
            </span>
          </div>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-[8px]">
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[#1E293B]">
                  <th className="py-2 px-3 font-semibold">Số báo danh</th>
                  <th className="py-2 px-3 font-semibold">Mã học sinh</th>
                  <th className="py-2 px-3 font-semibold">Họ và tên</th>
                  <th className="py-2 px-3 font-semibold">Lớp</th>
                  <th className="py-2 px-3 font-semibold">Đối chiếu bài thi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1E293B]">
                <tr>
                  <td className="py-2 px-3 font-mono-num font-bold text-[#2563EB]">010001</td>
                  <td className="py-2 px-3 font-mono-num">HS12001</td>
                  <td className="py-2 px-3 font-medium">Nguyễn Minh Anh</td>
                  <td className="py-2 px-3">12A1</td>
                  <td className="py-2 px-3 text-[#16A34A] font-semibold">Đã có bài thi</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono-num font-bold text-[#2563EB]">010002</td>
                  <td className="py-2 px-3 font-mono-num">HS12002</td>
                  <td className="py-2 px-3 font-medium">Trần Hoàng Bảo</td>
                  <td className="py-2 px-3">12A1</td>
                  <td className="py-2 px-3 text-[#16A34A] font-semibold">Đã có bài thi</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono-num font-bold text-[#2563EB]">010003</td>
                  <td className="py-2 px-3 font-mono-num">HS12003</td>
                  <td className="py-2 px-3 font-medium">Lê Thảo Chi</td>
                  <td className="py-2 px-3">12A1</td>
                  <td className="py-2 px-3 text-amber-700 font-medium">Chưa có bài</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'templates':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Valid */}
            <div className="bg-white border border-emerald-200 rounded-[8px] p-3 flex flex-col items-center text-center gap-2">
              <svg viewBox="0 0 120 44" className="w-full h-11" aria-hidden="true">
                <circle cx="22" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
                <circle cx="48" cy="22" r="11" fill="#1E293B" stroke="#1E293B" strokeWidth="2" />
                <circle cx="74" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
                <circle cx="100" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
              </svg>
              <div className="text-[14px] font-bold text-[#16A34A]">1. Tô đúng chuẩn</div>
              <div className="text-[13px] text-[#475569]">Tô tròn kín đều bên trong ô bằng chì đậm.</div>
            </div>

            {/* 2. Faint */}
            <div className="bg-white border border-amber-200 rounded-[8px] p-3 flex flex-col items-center text-center gap-2">
              <svg viewBox="0 0 120 44" className="w-full h-11" aria-hidden="true">
                <circle cx="22" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
                <circle cx="48" cy="22" r="11" fill="#CBD5E1" stroke="#D97706" strokeWidth="2" />
                <circle cx="74" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
                <circle cx="100" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
              </svg>
              <div className="text-[14px] font-bold text-amber-700">2. Tô quá mờ</div>
              <div className="text-[13px] text-[#475569]">Chuyển sang chờ kiểm duyệt để xác nhận.</div>
            </div>

            {/* 3. Multi-mark */}
            <div className="bg-white border border-red-200 rounded-[8px] p-3 flex flex-col items-center text-center gap-2">
              <svg viewBox="0 0 120 44" className="w-full h-11" aria-hidden="true">
                <circle cx="22" cy="22" r="11" fill="#1E293B" stroke="#DC2626" strokeWidth="2" />
                <circle cx="48" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
                <circle cx="74" cy="22" r="11" fill="#1E293B" stroke="#DC2626" strokeWidth="2" />
                <circle cx="100" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
              </svg>
              <div className="text-[14px] font-bold text-[#DC2626]">3. Tô 2 ô (sai)</div>
              <div className="text-[13px] text-[#475569]">Báo lỗi Tô nhiều đáp án để kiểm tra.</div>
            </div>

            {/* 4. Erased */}
            <div className="bg-white border border-amber-200 rounded-[8px] p-3 flex flex-col items-center text-center gap-2">
              <svg viewBox="0 0 120 44" className="w-full h-11" aria-hidden="true">
                <circle cx="22" cy="22" r="11" fill="#E2E8F0" stroke="#D97706" strokeWidth="2.5" strokeDasharray="3 2" />
                <circle cx="48" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
                <circle cx="74" cy="22" r="11" fill="#1E293B" stroke="#1E293B" strokeWidth="2" />
                <circle cx="100" cy="22" r="11" fill="#FFFFFF" stroke="#64748B" strokeWidth="2" />
              </svg>
              <div className="text-[14px] font-bold text-amber-700">4. Tẩy chưa sạch</div>
              <div className="text-[13px] text-[#475569]">Vết chì quanh viền kích hoạt cảnh báo tẩy xóa.</div>
            </div>

            {/* 5. Part III */}
            <div className="bg-white border border-blue-200 rounded-[8px] p-3 flex flex-col items-center text-center gap-2">
              <svg viewBox="0 0 120 44" className="w-full h-11" aria-hidden="true">
                <rect x="8" y="8" width="22" height="28" rx="3" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5" />
                <text x="19" y="27" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1E293B">-</text>
                <rect x="35" y="8" width="22" height="28" rx="3" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5" />
                <text x="46" y="27" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1E293B">3</text>
                <rect x="62" y="8" width="22" height="28" rx="3" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5" />
                <text x="73" y="27" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1E293B">,</text>
                <rect x="89" y="8" width="22" height="28" rx="3" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5" />
                <text x="100" y="27" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1E293B">5</text>
              </svg>
              <div className="text-[14px] font-bold text-[#2563EB]">5. Phần III TLN</div>
              <div className="text-[13px] text-[#475569]">Tô đủ cột dấu trừ (-), dấu phẩy (,) và các chữ số.</div>
            </div>
          </div>
        </div>
      );

    case 'designer':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-2">
              <div className="text-[15px] font-bold text-[#2563EB]">Chế độ 1: Thiết kế tự động</div>
              <div className="text-[14px] text-[#475569]">
                Tùy chỉnh trực tiếp thông số: Khổ giấy (A4/A5/A3), Ô SBD, Ô Mã đề, Câu Phần I, Phần II (Đ/S), Phần III (TLN) → Xem trước bản vẽ chuẩn từng milimet.
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-2">
              <div className="text-[15px] font-bold text-[#16A34A]">Chế độ 2: Đánh dấu mẫu tải lên</div>
              <div className="text-[14px] text-[#475569]">
                Nạp ảnh hoặc PDF mẫu phiếu sẵn có của trường → Chấm <strong>4 điểm định vị góc</strong> → Khoanh vùng <strong>Đặt ô tô</strong> → Lưu dùng cho mọi kỳ thi.
              </div>
            </div>
          </div>
        </div>
      );

    case 'answers':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-[#2563EB] text-white text-[13px] font-semibold">Mã 101 ✓</span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-[#1E293B] text-[13px] font-medium">Mã 102 ✓</span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-[#1E293B] text-[13px] font-medium">Mã 103</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[13px]">
                <span className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 font-medium">Dán clipboard / Nhập nhanh</span>
                <span className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 font-medium">Quét phiếu tô</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[14px]">
              <div className="border border-slate-200 rounded p-3">
                <div className="font-bold text-[#1E293B]">Phần I (Trắc nghiệm)</div>
                <div className="text-[#475569] mt-1">Điểm/câu: <strong className="font-mono-num">0,25đ</strong> · Chọn A/B/C/D</div>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <div className="font-bold text-[#1E293B]">Phần II (Đúng/Sai 2025)</div>
                <div className="text-[#2563EB] mt-1 font-medium">Lũy tiến: 0,10 · 0,25 · 0,50 · 1,00đ</div>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <div className="font-bold text-[#1E293B]">Phần III (Trả lời ngắn)</div>
                <div className="text-[#475569] mt-1">Hỗ trợ nhiều đáp án bằng <strong className="font-mono-num">|</strong> & sai số</div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'camera':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-7 bg-slate-900 rounded-[8px] p-4 relative text-white">
              <div className="flex items-center justify-between text-[13px] mb-2">
                <span className="px-2 py-0.5 rounded bg-[#16A34A] font-semibold">Định vị: 4/4</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono-num">Nghiêng: 0.4°</span>
              </div>
              <svg viewBox="0 0 320 200" className="w-full h-auto rounded bg-slate-800" aria-hidden="true">
                {/* Dark desk background & white sheet */}
                <rect x="44" y="16" width="232" height="168" rx="3" fill="#FFFFFF" />
                {/* 4 Green corner detection locks */}
                <rect x="48" y="20" width="14" height="14" fill="#1E293B" stroke="#16A34A" strokeWidth="3" />
                <rect x="258" y="20" width="14" height="14" fill="#1E293B" stroke="#16A34A" strokeWidth="3" />
                <rect x="48" y="166" width="14" height="14" fill="#1E293B" stroke="#16A34A" strokeWidth="3" />
                <rect x="258" y="166" width="14" height="14" fill="#1E293B" stroke="#16A34A" strokeWidth="3" />
                {/* Sheet schematic lines */}
                <rect x="74" y="26" width="172" height="14" rx="2" fill="#E2E8F0" />
                <rect x="74" y="50" width="52" height="44" rx="2" fill="#F1F5F9" stroke="#94A3B8" />
                <rect x="134" y="50" width="38" height="44" rx="2" fill="#F1F5F9" stroke="#94A3B8" />
                <rect x="180" y="50" width="66" height="44" rx="2" fill="#EFF6FF" stroke="#93C5FD" />
                <rect x="74" y="104" width="172" height="62" rx="2" fill="#F8FAFC" stroke="#CBD5E1" />
                <circle cx="96" cy="122" r="4" fill="#16A34A" />
                <circle cx="112" cy="122" r="4" fill="#CBD5E1" />
                <circle cx="128" cy="122" r="4" fill="#CBD5E1" />
                <circle cx="96" cy="142" r="4" fill="#CBD5E1" />
                <circle cx="112" cy="142" r="4" fill="#16A34A" />
                <circle cx="128" cy="142" r="4" fill="#CBD5E1" />
              </svg>
            </div>
            <div className="md:col-span-5 space-y-2.5 text-[14px]">
              <div className="bg-white border border-slate-200 rounded-[8px] p-3">
                <div className="font-bold text-[#16A34A]">1. Khóa đủ 4 góc xanh lá</div>
                <div className="text-[#475569] mt-0.5">Đặt phiếu trên nền bàn sẫm, để trọn 4 ô vuông góc trong khung hình.</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-[8px] p-3">
                <div className="font-bold text-[#2563EB]">2. Tự động chụp khi ổn định</div>
                <div className="text-[#475569] mt-0.5">Giữ tay yên tích tắc, máy tự chụp, cắt phẳng và đọc điểm ngay.</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-[8px] p-3">
                <div className="font-bold text-[#1E293B]">3. Chống chụp trùng SBD</div>
                <div className="text-[#475569] mt-0.5">Tự ngăn chụp đúp cùng một bài trong 4,5 giây khi bạn đổi tờ.</div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'batch':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5 space-y-3">
          <div className="bg-white border-2 border-dashed border-blue-300 rounded-[8px] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FolderUp className="w-6 h-6 text-[#2563EB]" />
              <div>
                <div className="text-[15px] font-bold text-[#1E293B]">12A1_Toan_GiuaKy1.pdf (45 trang) + ảnh rời</div>
                <div className="text-[14px] text-[#475569]">Hỗ trợ .pdf nhiều trang, .jpg, .png, .webp – chạy hoàn toàn trên máy</div>
              </div>
            </div>
            <span className="px-3.5 py-2 rounded bg-[#2563EB] text-white text-[14px] font-semibold">
              Bắt đầu chấm (45)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[14px]">
            <div className="bg-white border border-emerald-200 rounded-[8px] p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
              <span><strong>42 trang:</strong> Đã duyệt (rõ nét, khớp SBD & đáp án)</span>
            </div>
            <div className="bg-white border border-amber-200 rounded-[8px] p-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span><strong>2 trang:</strong> Chờ kiểm duyệt (1 tô mờ, 1 tẩy xóa)</span>
            </div>
            <div className="bg-white border border-red-200 rounded-[8px] p-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#DC2626] shrink-0" />
              <span><strong>1 trang:</strong> Thiếu định vị → bấm Thử lại trang lỗi</span>
            </div>
          </div>
        </div>
      );

    case 'scanner':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center text-[14px]">
            <div className="bg-white border border-slate-200 rounded-[8px] p-3.5">
              <div className="font-bold text-[#1E293B]">1. Ảnh gốc bị nghiêng & bóng</div>
              <div className="text-[#475569] mt-1">Chụp nghiêng trên bàn, có vệt bóng đèn hoặc lề thừa.</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-[8px] p-3.5">
              <div className="font-bold text-[#2563EB]">2. Cắt 4 góc & Khử bóng</div>
              <div className="text-[#1E293B] mt-1">Kéo 4 điểm góc → bật Khử bóng & làm trắng nền (giữ nét chì mờ).</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-[8px] p-3.5">
              <div className="font-bold text-[#16A34A]">3. Xuất PDF (N trang)</div>
              <div className="text-[#1E293B] mt-1">Ghép nhiều trang sạch nét thành 1 tệp PDF gọn nhẹ.</div>
            </div>
          </div>
        </div>
      );

    case 'review':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 bg-slate-900 rounded-[8px] p-3.5 text-white space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="px-2 py-0.5 rounded bg-[#2563EB]">Ảnh đã hiệu chỉnh + đánh dấu</span>
                <span className="font-mono-num">Zoom 175%</span>
              </div>
              <div className="bg-white rounded p-3 text-[#1E293B] space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Câu 6:</span>
                  <div className="flex gap-2">
                    <span className="w-6 h-6 rounded-full border border-slate-400 inline-flex items-center justify-center">A</span>
                    <span className="w-6 h-6 rounded-full bg-[#16A34A] text-white font-bold inline-flex items-center justify-center">B</span>
                    <span className="w-6 h-6 rounded-full border border-slate-400 inline-flex items-center justify-center">C</span>
                    <span className="w-6 h-6 rounded-full border border-slate-400 inline-flex items-center justify-center">D</span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-amber-50 p-1.5 rounded border border-amber-300">
                  <span className="font-bold text-amber-900">Câu 7:</span>
                  <div className="flex gap-2">
                    <span className="w-6 h-6 rounded-full border border-slate-400 inline-flex items-center justify-center">A</span>
                    <span className="w-6 h-6 rounded-full border border-slate-400 inline-flex items-center justify-center">B</span>
                    <span className="w-6 h-6 rounded-full bg-slate-400 text-white font-bold ring-2 ring-amber-500 inline-flex items-center justify-center">C</span>
                    <span className="w-6 h-6 rounded-full border border-slate-400 inline-flex items-center justify-center">D</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[8px] p-4 space-y-3 text-[14px]">
              <div className="px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                Vấn đề cần kiểm tra: Còn 1 câu tô mờ (P.I Câu 7)
              </div>
              <div className="border border-amber-300 bg-amber-50/50 rounded p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-[#1E293B]">P.I Câu 7</strong>
                  <span className="text-amber-700 font-semibold">Tô mờ</span>
                </div>
                <div className="font-mono-num text-[13px] text-[#475569]">
                  Mật độ ô: A:4% · B:5% · <strong className="text-[#2563EB]">C:28%</strong> · D:4%
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['A', 'B', 'C', 'D', 'Trống', 'Tô nhiều'].map((btn) => (
                    <span
                      key={btn}
                      className={`px-2.5 py-0.5 rounded text-[13px] font-semibold ${
                        btn === 'C' ? 'bg-[#2563EB] text-white' : 'bg-white border border-slate-300 text-[#1E293B]'
                      }`}
                    >
                      {btn}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded border border-slate-300 font-medium text-[#1E293B]">Chấm lại</span>
                <span className="px-3.5 py-1.5 rounded bg-[#16A34A] text-white font-semibold">Xác nhận cuối</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'gradebook':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="px-2.5 py-1 rounded bg-white border border-slate-300 font-medium text-[#1E293B]">
              Trạng thái: Tất cả trạng thái
            </span>
            <span className="px-3 py-1 rounded bg-[#16A34A] text-white font-semibold">Xuất Excel (.xlsx)</span>
          </div>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-[8px]">
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[#1E293B]">
                  <th className="py-2 px-3 font-semibold">SBD</th>
                  <th className="py-2 px-3 font-semibold">Họ và tên</th>
                  <th className="py-2 px-3 font-semibold">Mã đề</th>
                  <th className="py-2 px-3 font-semibold">Điểm</th>
                  <th className="py-2 px-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 px-3 font-mono-num">010001</td>
                  <td className="py-2 px-3 font-medium">Nguyễn Minh Anh</td>
                  <td className="py-2 px-3 font-mono-num">101</td>
                  <td className="py-2 px-3 font-mono-num font-bold text-[#16A34A]">8,75 (Chính thức)</td>
                  <td className="py-2 px-3 text-[#16A34A] font-semibold">Đã duyệt</td>
                </tr>
                <tr className="bg-amber-50/40">
                  <td className="py-2 px-3 font-mono-num">010002</td>
                  <td className="py-2 px-3 font-medium">Trần Hoàng Bảo</td>
                  <td className="py-2 px-3 font-mono-num">102</td>
                  <td className="py-2 px-3 font-mono-num font-semibold text-amber-700">6,50 (Dự kiến)</td>
                  <td className="py-2 px-3 text-amber-700 font-semibold">Chờ kiểm duyệt</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono-num">010003</td>
                  <td className="py-2 px-3 font-medium">Lê Thảo Chi</td>
                  <td className="py-2 px-3">—</td>
                  <td className="py-2 px-3">—</td>
                  <td className="py-2 px-3 text-slate-600 font-medium">Vắng thi (Nghỉ ốm)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'report_cards':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-3 text-[14px]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div>
                <div className="font-bold text-[#2563EB] text-[15px]">PHIẾU TRẢ BÀI KIỂM TRA – MẪU CHI TIẾT + ẢNH</div>
                <div className="text-[#475569]">Học sinh: <strong>Nguyễn Minh Anh</strong> · Lớp 12A1 · SBD 010001 · Mã 101</div>
              </div>
              <div className="px-3.5 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-[#16A34A] font-bold text-[16px] font-mono-num">
                8,75 điểm
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border border-slate-200 rounded p-3 space-y-1.5">
                <div className="font-bold text-[#1E293B]">1. Tỷ trọng từng phần</div>
                <div className="text-[#475569]">Phần I: 2,75 / 3,00</div>
                <div className="text-[#475569]">Phần II: 3,50 / 4,00</div>
                <div className="text-[#475569]">Phần III: 2,50 / 3,00</div>
              </div>
              <div className="border border-slate-200 rounded p-3 space-y-1.5">
                <div className="font-bold text-[#1E293B]">2. Ảnh đánh dấu kết quả</div>
                <div className="flex flex-wrap gap-2 text-[13px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#16A34A] font-semibold">Vòng xanh: Đúng</span>
                  <span className="px-2 py-0.5 rounded bg-red-50 text-[#DC2626] font-semibold">Vòng đỏ: Sai</span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">Vàng: Cần duyệt</span>
                </div>
              </div>
              <div className="border border-slate-200 rounded p-3 space-y-1.5">
                <div className="font-bold text-[#1E293B]">3. Nhận xét giáo viên</div>
                <div className="text-[#475569]">Tự động gợi ý theo khung điểm, có thể sửa và bấm "Khóa nhận xét".</div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'analytics':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Histogram Schematic */}
            <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-2">
              <div className="text-[15px] font-bold text-[#1E293B]">Biểu đồ phổ điểm (chỉ tính bài Đã duyệt)</div>
              <svg viewBox="0 0 320 140" className="w-full h-auto" aria-hidden="true">
                <line x1="28" y1="115" x2="305" y2="115" stroke="#94A3B8" strokeWidth="1.5" />
                <line x1="28" y1="15" x2="28" y2="115" stroke="#94A3B8" strokeWidth="1.5" />
                {/* Bars */}
                <rect x="40" y="102" width="22" height="13" fill="#94A3B8" rx="2" />
                <rect x="70" y="88" width="22" height="27" fill="#94A3B8" rx="2" />
                <rect x="100" y="68" width="22" height="47" fill="#2563EB" rx="2" />
                <rect x="130" y="42" width="22" height="73" fill="#2563EB" rx="2" />
                <rect x="160" y="28" width="22" height="87" fill="#2563EB" rx="2" />
                <rect x="190" y="34" width="22" height="81" fill="#16A34A" rx="2" />
                <rect x="220" y="58" width="22" height="57" fill="#16A34A" rx="2" />
                <rect x="250" y="85" width="22" height="30" fill="#16A34A" rx="2" />
                {/* Pass threshold line */}
                <line x1="96" y1="14" x2="96" y2="118" stroke="#DC2626" strokeWidth="1.8" strokeDasharray="4 3" />
                <text x="100" y="24" fontSize="11" fontWeight="bold" fill="#DC2626">Ngưỡng đạt (5,0)</text>
                <text x="42" y="130" fontSize="11" fill="#475569">0–3</text>
                <text x="132" y="130" fontSize="11" fill="#475569">6–7</text>
                <text x="192" y="130" fontSize="11" fill="#475569">8–9</text>
                <text x="250" y="130" fontSize="11" fill="#475569">9–10</text>
              </svg>
            </div>

            {/* Distractor Schematic */}
            <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-2.5 text-[14px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold text-[#1E293B]">Phân tích phương án nhiễu (Câu 10)</span>
                <span className="font-mono-num text-[13px] font-semibold text-[#2563EB]">p=0,64 · D=0,38</span>
              </div>
              {[
                { opt: 'A (Đáp án đúng)', pct: 64, color: 'bg-[#16A34A]' },
                { opt: 'B (Nhiễu tốt)', pct: 22, color: 'bg-slate-500' },
                { opt: 'C (Nhiễu trung bình)', pct: 14, color: 'bg-slate-400' },
                { opt: 'D (Nhiễu 0% - cần xem lại)', pct: 0, color: 'bg-[#DC2626]' },
              ].map((row) => (
                <div key={row.opt} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#1E293B] font-medium">{row.opt}</span>
                    <span className="font-mono-num font-semibold">{row.pct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color}`} style={{ width: `${Math.max(2, row.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'backup':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center text-[14px]">
            <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-[#2563EB]">
                <HardDrive className="w-5 h-5" />
                Máy hiện tại (IndexedDB)
              </div>
              <div className="text-[#475569]">
                Bấm <strong>Sao lưu toàn bộ dữ liệu</strong> hoặc <strong>Xuất kỳ thi</strong> để đóng gói thành tệp <code>.json</code>.
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-[8px] p-4 space-y-1.5 text-center">
              <div className="font-bold text-[#1E293B]">Tệp sao lưu chuẩn (.json)</div>
              <div className="text-[#475569]">Chép qua USB hoặc lưu trữ cá nhân. Kiểm tra hợp lệ tự động khi mở lại.</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-[#16A34A]">
                <Laptop className="w-5 h-5" />
                Khôi phục trên máy mới
              </div>
              <div className="text-[#475569]">
                Chọn <strong>Gộp thêm vào dữ liệu hiện tại (an toàn)</strong> hoặc <strong>Ghi đè toàn bộ</strong>.
              </div>
            </div>
          </div>
        </div>
      );

    case 'settings':
      return (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 sm:p-5 space-y-3 text-[14px]">
          <div className="bg-white border border-slate-200 rounded-[8px] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-[#1E293B] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#2563EB]" />
                Quản lý tách biệt hai kho dữ liệu
              </div>
              <div className="text-[#475569]">
                Có thể xóa sạch dữ liệu thực hành bất cứ lúc nào mà dữ liệu thật vẫn an toàn tuyệt đối.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <span className="px-3 py-1.5 rounded bg-red-50 border border-red-200 text-[#DC2626] font-semibold">
                Xóa dữ liệu thực hành
              </span>
              <span className="px-3 py-1.5 rounded bg-[#2563EB] text-white font-semibold">
                Sao lưu dữ liệu của tôi
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-[8px] p-3">
              <div className="font-bold text-[#1E293B]">Ngưỡng tô chắc chắn</div>
              <div className="text-[#475569] mt-0.5 font-mono-num">Mặc định: 0.34 (34% ô đen)</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[8px] p-3">
              <div className="font-bold text-[#1E293B]">Ngưỡng tô mờ & tẩy xóa</div>
              <div className="text-[#475569] mt-0.5 font-mono-num">Mờ: 0.21 · Viền tẩy: 0.22</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[8px] p-3">
              <div className="font-bold text-[#1E293B]">Bộ kiểm thử OpenCV</div>
              <div className="text-[#16A34A] mt-0.5 font-medium">Kiểm chứng ngay trên trình duyệt</div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};
