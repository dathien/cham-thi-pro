import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  HelpCircle,
  List,
  Minus,
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GUIDE_FAQS, GUIDE_SECTIONS, type GuideFaqItem, type GuideSection } from '../data/guideSections';
import { GuideIllustration } from '../components/GuideIllustrations';
import { exportGuideToPDF } from '../engine/guidePdfExport';

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function sectionMatchesQuery(sec: GuideSection, normQuery: string): boolean {
  if (!normQuery) return true;
  const hay = [
    sec.number,
    sec.title,
    sec.category,
    sec.summary,
    sec.purpose,
    sec.howToOpen,
    ...sec.whenToUse,
    ...sec.prerequisites,
    ...sec.steps.flatMap((s) => [s.title, s.detail]),
    ...sec.controlsAndFields.flatMap((c) => [c.name, c.meaning]),
    sec.practicalExample.scenario,
    ...sec.practicalExample.walkthrough,
    sec.expectedResult,
    ...sec.importantNotes,
    ...sec.troubleshooting.flatMap((t) => [t.problem, t.cause, t.solution]),
    ...sec.searchKeywords,
  ].join(' ');
  return normalizeSearch(hay).includes(normQuery);
}

function faqMatchesQuery(faq: GuideFaqItem, normQuery: string): boolean {
  if (!normQuery) return true;
  const hay = [faq.question, ...faq.answerParagraphs, ...(faq.steps || [])].join(' ');
  return normalizeSearch(hay).includes(normQuery);
}

export const GuidePage: React.FC = () => {
  const { setActivePage } = useApp();
  const topRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<string>(GUIDE_SECTIONS[0].id);
  const [searchText, setSearchText] = useState('');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [bodyFontSize, setBodyFontSize] = useState<number>(16);
  const [exportingPdf, setExportingPdf] = useState<'none' | 'section' | 'full'>('none');
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [expandedFaqIds, setExpandedFaqIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    GUIDE_FAQS.forEach((f) => {
      initial[f.id] = true;
    });
    return initial;
  });

  const normQuery = useMemo(() => normalizeSearch(searchText.trim()), [searchText]);

  const matchedFaqs = useMemo(
    () => GUIDE_FAQS.filter((faq) => faqMatchesQuery(faq, normQuery)),
    [normQuery]
  );

  const filteredSections = useMemo(() => {
    if (!normQuery) return GUIDE_SECTIONS;
    return GUIDE_SECTIONS.filter((sec) => {
      if (sec.id === 'faq') {
        return sectionMatchesQuery(sec, normQuery) || matchedFaqs.length > 0;
      }
      return sectionMatchesQuery(sec, normQuery);
    });
  }, [normQuery, matchedFaqs]);

  const currentSection = useMemo(
    () => GUIDE_SECTIONS.find((s) => s.id === selectedId) || GUIDE_SECTIONS[0],
    [selectedId]
  );

  const currentIndex = useMemo(
    () => GUIDE_SECTIONS.findIndex((s) => s.id === currentSection.id),
    [currentSection.id]
  );

  const prevSection = currentIndex > 0 ? GUIDE_SECTIONS[currentIndex - 1] : null;
  const nextSection =
    currentIndex >= 0 && currentIndex < GUIDE_SECTIONS.length - 1
      ? GUIDE_SECTIONS[currentIndex + 1]
      : null;

  const relatedSections = useMemo(
    () =>
      currentSection.relatedSectionIds
        .map((id) => GUIDE_SECTIONS.find((s) => s.id === id))
        .filter((s): s is GuideSection => Boolean(s)),
    [currentSection]
  );

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSection = (id: string, focusFaqId?: string) => {
    setSelectedId(id);
    setMobileTocOpen(false);
    if (focusFaqId) {
      setExpandedFaqIds((prev) => ({ ...prev, [focusFaqId]: true }));
      setTimeout(() => {
        const el = document.getElementById(focusFaqId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        scrollToTop();
      }, 60);
    } else {
      scrollToTop();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async (mode: 'section' | 'full') => {
    setExportingPdf(mode);
    setPdfNotice(null);
    try {
      await exportGuideToPDF(mode === 'section' ? currentSection : undefined);
      setPdfNotice(
        mode === 'section'
          ? `Đã tải xuống tệp PDF hướng dẫn mục "${currentSection.title}".`
          : 'Đã tải xuống trọn bộ Tài liệu Hướng dẫn sử dụng (PDF).'
      );
    } catch {
      setPdfNotice('Không tạo được tệp PDF lúc này. Bạn có thể dùng nút "In hướng dẫn" và chọn Lưu dưới dạng PDF.');
    } finally {
      setExportingPdf('none');
    }
  };

  const toggleFaq = (id: string) => {
    setExpandedFaqIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setAllFaqs = (open: boolean) => {
    const next: Record<string, boolean> = {};
    GUIDE_FAQS.forEach((f) => {
      next[f.id] = open;
    });
    setExpandedFaqIds(next);
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: `${bodyFontSize}px`,
    lineHeight: 1.7,
  };

  return (
    <div ref={topRef} className="space-y-5">
      {/* Top Page Title & Reading Utility Toolbar */}
      <header className="no-print bg-white border border-slate-200 rounded-[12px] p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[26px] font-bold text-[#1E293B] leading-tight">
              HƯỚNG DẪN SỬ DỤNG
            </h1>
            <p className="text-[15px] text-[#475569] leading-[1.6]">
              Trung tâm tài liệu tra cứu trực tiếp từng chức năng của CHẤM THI THÔNG MINH. Thầy cô có thể chọn nhanh bất kỳ mục nào cần dùng ở mục lục bên trái.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Font size adjuster */}
            <div
              className="inline-flex items-center border border-slate-200 rounded-[8px] bg-[#F8FAFC] p-1"
              role="group"
              aria-label="Điều chỉnh cỡ chữ đọc tài liệu"
            >
              <button
                type="button"
                onClick={() => setBodyFontSize((s) => Math.max(14, s - 1))}
                disabled={bodyFontSize <= 14}
                title="Thu nhỏ cỡ chữ"
                className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] text-[#1E293B] hover:bg-white disabled:opacity-40 cursor-pointer"
                aria-label="Giảm cỡ chữ"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-[14px] font-semibold font-mono-num text-[#1E293B] whitespace-nowrap">
                {bodyFontSize}px
              </span>
              <button
                type="button"
                onClick={() => setBodyFontSize((s) => Math.min(19, s + 1))}
                disabled={bodyFontSize >= 19}
                title="Phóng to cỡ chữ"
                className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] text-[#1E293B] hover:bg-white disabled:opacity-40 cursor-pointer"
                aria-label="Tăng cỡ chữ"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-[8px] border border-slate-300 bg-white hover:bg-slate-50 text-[#1E293B] text-[14px] font-semibold whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>In hướng dẫn</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPdf('section')}
              disabled={exportingPdf !== 'none'}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-[8px] border border-blue-200 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-[14px] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{exportingPdf === 'section' ? 'Đang tạo PDF...' : 'Tải PDF mục này'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPdf('full')}
              disabled={exportingPdf !== 'none'}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-[8px] bg-[#2563EB] hover:bg-blue-700 text-white text-[14px] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{exportingPdf === 'full' ? 'Đang xuất trọn bộ...' : 'Tải trọn bộ PDF'}</span>
            </button>
          </div>
        </div>

        {pdfNotice && (
          <div className="px-4 py-2.5 rounded-[8px] bg-blue-50 border border-blue-200 text-[14px] text-[#1E293B] flex items-center justify-between gap-3">
            <span>{pdfNotice}</span>
            <button
              type="button"
              onClick={() => setPdfNotice(null)}
              className="text-[14px] font-semibold text-[#2563EB] underline whitespace-nowrap"
            >
              Đóng
            </button>
          </div>
        )}
      </header>

      {/* Main Two-Column Documentation Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN – MỤC LỤC HƯỚNG DẪN */}
        <aside className="no-print lg:col-span-4 xl:col-span-3 lg:sticky lg:top-[4.5rem]">
          {/* Mobile Collapsible Bar */}
          <div className="lg:hidden mb-3">
            <button
              type="button"
              onClick={() => setMobileTocOpen((v) => !v)}
              className="w-full bg-white border border-slate-200 rounded-[10px] px-4 py-3 flex items-center justify-between gap-3 text-left"
              aria-expanded={mobileTocOpen}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <List className="w-5 h-5 text-[#2563EB] shrink-0" />
                <span className="text-[14px] font-bold text-[#1E293B] truncate">
                  Mục lục: {currentSection.number}. {currentSection.shortTitle}
                </span>
              </span>
              {mobileTocOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
              )}
            </button>
          </div>

          <div
            className={`${
              mobileTocOpen ? 'block' : 'hidden'
            } lg:block bg-white border border-slate-200 rounded-[12px] overflow-hidden`}
          >
            {/* Search Box inside ToC */}
            <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-[#F8FAFC]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-[#1E293B] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#2563EB]" />
                  Mục lục hướng dẫn
                </span>
                <span className="text-[14px] text-[#475569] font-mono-num">
                  {filteredSections.length}/16
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Tìm kiếm chức năng, nút bấm..."
                  aria-label="Tìm kiếm nội dung hướng dẫn"
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-[8px] text-[14px] text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText('')}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1E293B]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ToC List (14px) */}
            <nav
              aria-label="Mục lục tài liệu hướng dẫn"
              className="p-2.5 space-y-1 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto"
            >
              {filteredSections.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <p className="text-[14px] text-[#475569]">
                    Không tìm thấy mục nào phù hợp với từ khóa "{searchText}".
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchText('')}
                    className="text-[14px] font-semibold text-[#2563EB] underline"
                  >
                    Hiển thị lại cả 16 mục
                  </button>
                </div>
              ) : (
                filteredSections.map((sec) => {
                  const isActive = sec.id === currentSection.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleSelectSection(sec.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-[8px] text-[14px] flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-blue-200'
                          : 'text-[#1E293B] hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <span
                        className={`font-mono-num text-[14px] shrink-0 ${
                          isActive ? 'text-[#2563EB] font-bold' : 'text-[#475569]'
                        }`}
                      >
                        {sec.number}.
                      </span>
                      <span className="leading-snug">{sec.shortTitle}</span>
                    </button>
                  );
                })
              )}

              {/* Direct FAQ Matches while searching */}
              {normQuery && matchedFaqs.length > 0 && (
                <div className="pt-2.5 mt-2 border-t border-slate-200 space-y-1.5">
                  <div className="px-2 text-[14px] font-bold text-[#1E293B]">
                    Câu hỏi khớp ({matchedFaqs.length})
                  </div>
                  {matchedFaqs.slice(0, 5).map((faq) => (
                    <button
                      key={faq.id}
                      type="button"
                      onClick={() => handleSelectSection('faq', faq.id)}
                      className="w-full text-left px-2.5 py-2 rounded-[8px] text-[14px] text-[#475569] hover:bg-slate-50 hover:text-[#2563EB] flex items-start gap-2 cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                      <span className="leading-snug">{faq.question}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* RIGHT COLUMN – NỘI DUNG HƯỚNG DẪN CHI TIẾT */}
        <article className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-[12px] p-5 sm:p-7 space-y-7">
          {/* Section Title Band */}
          <div className="pb-5 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[14px] font-bold text-[#2563EB] uppercase tracking-wide">
                Mục {currentSection.number} · {currentSection.category}
              </span>

              {currentSection.targetNavPage && (
                <button
                  type="button"
                  onClick={() => setActivePage(currentSection.targetNavPage!)}
                  className="no-print inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-[8px] bg-[#16A34A] hover:bg-green-700 text-white text-[14px] font-semibold whitespace-nowrap cursor-pointer"
                >
                  <span>{currentSection.targetNavLabel || 'Mở chức năng'}</span>
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </button>
              )}
            </div>

            <h2 className="text-[22px] font-bold text-[#1E293B] leading-snug">
              {currentSection.title}
            </h2>

            <p className="text-[#475569]" style={bodyStyle}>
              {currentSection.summary}
            </p>
          </div>

          {/* 1. Purpose & When to Use */}
          <section className="space-y-[12px]">
            <h3 className="text-[18px] font-semibold text-[#1E293B]">
              1. Chức năng này dùng để làm gì và khi nào nên sử dụng?
            </h3>
            <p className="text-[#1E293B]" style={bodyStyle}>
              {currentSection.purpose}
            </p>
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 space-y-[10px]">
              <div className="text-[16px] font-semibold text-[#1E293B]">
                Khi nào thầy cô nên mở chức năng này?
              </div>
              <ul className="list-disc pl-5 space-y-2 text-[#1E293B]" style={bodyStyle}>
                {currentSection.whenToUse.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* 2. How to Open & Prerequisites */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 space-y-[10px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                2. Cách mở chức năng
              </h3>
              <p className="text-[#1E293B]" style={bodyStyle}>
                {currentSection.howToOpen}
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 space-y-[10px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                3. Điều kiện cần chuẩn bị trước
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-[#1E293B]" style={bodyStyle}>
                {currentSection.prerequisites.map((pre, idx) => (
                  <li key={idx}>{pre}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* 3. Visual Illustration */}
          {currentSection.illustrationId && (
            <figure className="space-y-2.5">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                Minh họa trực quan
              </h3>
              <GuideIllustration id={currentSection.illustrationId} />
              {currentSection.illustrationCaption && (
                <figcaption className="text-[14px] text-[#475569] leading-[1.6]">
                  {currentSection.illustrationCaption}
                </figcaption>
              )}
            </figure>
          )}

          {/* 4. Step-by-step Instructions (for Sections 1-15) */}
          {currentSection.steps.length > 0 && (
            <section className="space-y-[12px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                4. Hướng dẫn thao tác từng bước
              </h3>
              <div className="space-y-3">
                {currentSection.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-[10px] p-4 bg-white space-y-1.5"
                  >
                    <h4 className="text-[16px] font-semibold text-[#1E293B]">
                      <span className="text-[#2563EB] font-mono-num mr-2">Bước {idx + 1}:</span>
                      {st.title}
                    </h4>
                    <p className="text-[#475569]" style={bodyStyle}>
                      {st.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 5. Buttons and Fields Table (for Sections 1-15) */}
          {currentSection.controlsAndFields.length > 0 && (
            <section className="space-y-[12px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                5. Ý nghĩa các nút bấm và trường nhập liệu
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-slate-200">
                      <th className="py-3 px-4 text-[15px] font-semibold text-[#1E293B] w-[36%]">
                        Tên nút / Trường thông tin
                      </th>
                      <th className="py-3 px-4 text-[15px] font-semibold text-[#1E293B]">
                        Chức năng và cách sử dụng
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentSection.controlsAndFields.map((cf, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-3 px-4 text-[15px] font-semibold text-[#2563EB]">
                          {cf.name}
                        </td>
                        <td className="py-3 px-4 text-[#1E293B]" style={bodyStyle}>
                          {cf.meaning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 6. Practical Example & Expected Result */}
          <section className="space-y-4">
            <div className="bg-blue-50/50 border border-blue-200 rounded-[10px] p-5 space-y-[12px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                {currentSection.id === 'faq' ? 'Ví dụ tra cứu nhanh' : '6. Ví dụ thực tế minh họa'}
              </h3>
              <p className="text-[#1E293B] font-semibold" style={bodyStyle}>
                Tình huống: {currentSection.practicalExample.scenario}
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-[#1E293B]" style={bodyStyle}>
                {currentSection.practicalExample.walkthrough.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ol>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-[10px] p-5 space-y-[10px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                {currentSection.id === 'faq'
                  ? 'Kết quả sau khi xử lý'
                  : '7. Kết quả nhận được sau khi thực hiện'}
              </h3>
              <p className="text-[#1E293B]" style={bodyStyle}>
                {currentSection.expectedResult}
              </p>
            </div>
          </section>

          {/* 7. FAQ Section Full Interactive List (when Section 16 is active) */}
          {currentSection.id === 'faq' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[18px] font-semibold text-[#1E293B]">
                  Danh sách 14 câu hỏi thường gặp ({matchedFaqs.length}/14)
                </h3>
                <div className="no-print flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAllFaqs(true)}
                    className="px-3 py-1.5 rounded-[8px] border border-slate-300 bg-white hover:bg-slate-50 text-[14px] font-semibold text-[#1E293B] cursor-pointer"
                  >
                    Mở rộng tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllFaqs(false)}
                    className="px-3 py-1.5 rounded-[8px] border border-slate-300 bg-white hover:bg-slate-50 text-[14px] font-semibold text-[#1E293B] cursor-pointer"
                  >
                    Thu gọn tất cả
                  </button>
                </div>
              </div>

              {/* Quick Question Index */}
              <div className="no-print bg-[#F8FAFC] border border-slate-200 rounded-[10px] p-4 space-y-2.5">
                <div className="text-[15px] font-semibold text-[#1E293B]">
                  Chọn nhanh câu hỏi cần giải đáp:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {matchedFaqs.map((faq, idx) => (
                    <button
                      key={faq.id}
                      type="button"
                      onClick={() => handleSelectSection('faq', faq.id)}
                      className="text-left px-3 py-2 rounded-[8px] bg-white border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-[14px] font-medium text-[#1E293B] cursor-pointer"
                    >
                      <span className="font-mono-num font-bold text-[#2563EB] mr-1.5">
                        {idx + 1}.
                      </span>
                      {faq.question}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed 14 FAQ Cards */}
              <div className="space-y-3.5">
                {matchedFaqs.map((faq, idx) => {
                  const isOpen = Boolean(expandedFaqIds[faq.id]);
                  const faqRelated = (faq.relatedSectionIds || [])
                    .map((id) => GUIDE_SECTIONS.find((s) => s.id === id))
                    .filter((s): s is GuideSection => Boolean(s));

                  return (
                    <div
                      key={faq.id}
                      id={faq.id}
                      className="border border-slate-200 rounded-[10px] overflow-hidden bg-white scroll-mt-20"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(faq.id)}
                        aria-expanded={isOpen}
                        className="w-full text-left px-4 sm:px-5 py-3.5 bg-[#F8FAFC] hover:bg-slate-100/80 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <h4 className="text-[16px] font-semibold text-[#1E293B]">
                          <span className="text-[#2563EB] font-mono-num mr-2">
                            Câu {idx + 1}:
                          </span>
                          {faq.question}
                        </h4>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="p-4 sm:p-5 space-y-[12px] border-t border-slate-200">
                          {faq.answerParagraphs.map((para, pIdx) => (
                            <p key={pIdx} className="text-[#1E293B]" style={bodyStyle}>
                              {para}
                            </p>
                          ))}

                          {faq.steps && faq.steps.length > 0 && (
                            <div className="bg-[#F8FAFC] border border-slate-200 rounded-[8px] p-3.5 space-y-2">
                              <div className="text-[15px] font-semibold text-[#1E293B]">
                                Cách xử lý từng bước:
                              </div>
                              <ol
                                className="list-decimal pl-5 space-y-1.5 text-[#1E293B]"
                                style={bodyStyle}
                              >
                                {faq.steps.map((s, sIdx) => (
                                  <li key={sIdx}>{s}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {faqRelated.length > 0 && (
                            <div className="no-print flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[14px] font-medium text-[#475569]">
                                Xem thêm hướng dẫn chi tiết:
                              </span>
                              {faqRelated.map((rel) => (
                                <button
                                  key={rel.id}
                                  type="button"
                                  onClick={() => handleSelectSection(rel.id)}
                                  className="px-3 py-1 rounded-[8px] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-[14px] font-semibold cursor-pointer"
                                >
                                  {rel.number}. {rel.shortTitle}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 8. Important Notes */}
          {currentSection.importantNotes.length > 0 && (
            <section className="bg-amber-50/60 border border-amber-200 rounded-[10px] p-5 space-y-[10px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                {currentSection.id === 'faq' ? 'Lưu ý chung' : '8. Lưu ý quan trọng khi sử dụng'}
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-[#1E293B]" style={bodyStyle}>
                {currentSection.importantNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          {/* 9. Troubleshooting */}
          {currentSection.troubleshooting.length > 0 && (
            <section className="space-y-[12px]">
              <h3 className="text-[18px] font-semibold text-[#1E293B]">
                9. Lỗi thường gặp và cách xử lý
              </h3>
              <div className="space-y-3">
                {currentSection.troubleshooting.map((item, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-[10px] p-4 bg-[#F8FAFC] space-y-2"
                  >
                    <h4 className="text-[16px] font-semibold text-[#DC2626]">
                      Hiện tượng: {item.problem}
                    </h4>
                    <p className="text-[#475569]" style={bodyStyle}>
                      <strong className="text-[#1E293B]">Nguyên nhân:</strong> {item.cause}
                    </p>
                    <p className="text-[#1E293B]" style={bodyStyle}>
                      <strong className="text-[#16A34A]">Cách xử lý:</strong> {item.solution}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Sections & Bottom Reading Navigation */}
          <footer className="no-print pt-5 border-t border-slate-200 space-y-5">
            {relatedSections.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[16px] font-semibold text-[#1E293B]">
                  Tài liệu liên quan nên xem thêm
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {relatedSections.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => handleSelectSection(rel.id)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] border border-blue-200 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-[14px] font-semibold cursor-pointer"
                    >
                      <span>
                        {rel.number}. {rel.shortTitle}
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2.5">
                {prevSection && (
                  <button
                    type="button"
                    onClick={() => handleSelectSection(prevSection.id)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-[8px] border border-slate-300 bg-white hover:bg-slate-50 text-[#1E293B] text-[14px] font-semibold cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                    <span>
                      Mục trước: {prevSection.number}. {prevSection.shortTitle}
                    </span>
                  </button>
                )}

                {nextSection && (
                  <button
                    type="button"
                    onClick={() => handleSelectSection(nextSection.id)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-[8px] border border-slate-300 bg-white hover:bg-slate-50 text-[#1E293B] text-[14px] font-semibold cursor-pointer"
                  >
                    <span>
                      Mục tiếp theo: {nextSection.number}. {nextSection.shortTitle}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={scrollToTop}
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-[8px] bg-slate-100 hover:bg-slate-200 text-[#1E293B] text-[14px] font-semibold whitespace-nowrap cursor-pointer"
              >
                <ArrowUp className="w-4 h-4 shrink-0" />
                <span>Quay lại đầu trang</span>
              </button>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};
