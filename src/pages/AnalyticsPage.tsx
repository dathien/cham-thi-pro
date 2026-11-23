import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BarChart3,
  Download,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FilterX,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  buildFullAnalyticsReportData,
  type CodeAnalysisGroup,
  type Part1ItemAnalysis,
} from '../engine/analyticsEngine';
import {
  exportAnalyticsExcelXLSX,
  exportAnalyticsPdf,
  exportAnalyticsWordDocx,
  type ReportChartImage,
  type TeacherReportSections,
} from '../engine/reportExport';
import type { QuestionSpecMeta } from '../types/omr';

async function svgElementToPngDataUrl(svg: SVGSVGElement, width = 900, height = 380): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG render failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function triggerPngDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export const AnalyticsPage: React.FC = () => {
  const {
    dataScope,
    setDataScope,
    exams,
    activeExam,
    setActiveExamId,
    students,
    answerKeys,
    submissions,
    upsertExam,
    setActivePage,
  } = useApp();

  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [codeFilter, setCodeFilter] = useState<string>('all');
  const [passThresholdInput, setPassThresholdInput] = useState<number>(
    activeExam?.passThreshold ?? 5
  );

  // Selected code tab & clicked Part I distractor question
  const [activeCodeTab, setActiveCodeTab] = useState<string>('');
  const [selectedP1Question, setSelectedP1Question] = useState<number | null>(null);

  // Honor Board settings
  const [honorScope, setHonorScope] = useState<'exam' | 'class'>('exam');
  const [honorClass, setHonorClass] = useState<string>('all');
  const [honorTopN, setHonorTopN] = useState<3 | 5 | 10>(5);
  const [hideStudentNames, setHideStudentNames] = useState(false);

  // Spec editor
  const [showSpecEditor, setShowSpecEditor] = useState(false);
  const [draftSpecs, setDraftSpecs] = useState<QuestionSpecMeta[]>([]);

  // Teacher editable report fields
  const [teacherSections, setTeacherSections] = useState<TeacherReportSections>({
    generalComment: '',
    questionReviewNote: '',
    adjustmentRecommendation: '',
    reinforcementPlan: '',
  });
  const [busyExport, setBusyExport] = useState<string | null>(null);

  // SVG refs for PNG & Word/PDF embedding
  const histSvgRef = useRef<SVGSVGElement | null>(null);
  const passSvgRef = useRef<SVGSVGElement | null>(null);
  const partsSvgRef = useRef<SVGSVGElement | null>(null);
  const classSvgRef = useRef<SVGSVGElement | null>(null);
  const codeSvgRef = useRef<SVGSVGElement | null>(null);
  const qRateSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (activeExam) {
      setPassThresholdInput(activeExam.passThreshold);
      setDraftSpecs(activeExam.questionSpecs || []);
    }
  }, [activeExam?.id]);

  const availableSubjects = useMemo(
    () => Array.from(new Set(exams.map((e) => e.subject))).sort((a, b) => a.localeCompare(b, 'vi')),
    [exams]
  );
  const availableGrades = useMemo(
    () => Array.from(new Set(exams.map((e) => e.gradeLevel))).sort((a, b) => a.localeCompare(b, 'vi')),
    [exams]
  );
  const filteredExamChoices = useMemo(
    () =>
      exams.filter(
        (e) =>
          (subjectFilter === 'all' || e.subject === subjectFilter) &&
          (gradeFilter === 'all' || e.gradeLevel === gradeFilter)
      ),
    [exams, subjectFilter, gradeFilter]
  );

  useEffect(() => {
    if (
      filteredExamChoices.length > 0 &&
      activeExam &&
      !filteredExamChoices.some((e) => e.id === activeExam.id)
    ) {
      setActiveExamId(filteredExamChoices[0].id);
    }
  }, [filteredExamChoices, activeExam, setActiveExamId]);

  const examSubs = useMemo(
    () =>
      activeExam
        ? submissions.filter((s) => s.examId === activeExam.id && !s.isTestSample)
        : [],
    [submissions, activeExam]
  );

  const availableClasses = useMemo(() => {
    const set = new Set<string>(activeExam?.classNames || []);
    for (const s of examSubs) {
      const st = students.find((x) => x.id === s.studentId || (s.sbd && x.sbd === s.sbd));
      if (st?.className) set.add(st.className);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [activeExam, examSubs, students]);

  const availableCodes = useMemo(() => {
    const set = new Set<string>(activeExam?.examCodes || []);
    for (const s of examSubs) if (s.examCode) set.add(s.examCode);
    return Array.from(set).sort();
  }, [activeExam, examSubs]);

  const reportData = useMemo(() => {
    if (!activeExam) return null;
    return buildFullAnalyticsReportData({
      exam: activeExam,
      allSubmissions: submissions,
      students,
      answerKeys,
      classFilter,
      codeFilter,
      passThreshold: passThresholdInput,
    });
  }, [activeExam, submissions, students, answerKeys, classFilter, codeFilter, passThresholdInput]);

  useEffect(() => {
    if (!reportData || reportData.codeGroups.length === 0) {
      setActiveCodeTab('');
      return;
    }
    if (!reportData.codeGroups.some((g) => g.examCode === activeCodeTab)) {
      setActiveCodeTab(reportData.codeGroups[0].examCode);
      setSelectedP1Question(reportData.codeGroups[0].part1Items[0]?.question ?? null);
    }
  }, [reportData, activeCodeTab]);

  // Populate initial teacher commentary whenever exam/stats change if empty
  useEffect(() => {
    if (!reportData || !activeExam) return;
    const grp = reportData.codeGroups[0];
    const flaggedCount = grp
      ? grp.part1Items.filter((i) => i.warnings.length > 0).length +
        grp.part2Items.filter((i) => i.warnings.length > 0).length +
        grp.part3Items.filter((i) => i.warnings.length > 0).length
      : 0;
    setTeacherSections({
      generalComment:
        reportData.summary.presentCount > 0
          ? `Trên mẫu ${reportData.summary.presentCount} bài đã kiểm duyệt chính thức, điểm trung bình đạt ${reportData.summary.mean}/${activeExam.scoreScale}, tỉ lệ đạt ${reportData.summary.passRate}% (ngưỡng ≥ ${passThresholdInput}).`
          : 'Chưa có bài đã kiểm duyệt chính thức trong phạm vi bộ lọc hiện tại.',
      questionReviewNote:
        flaggedCount > 0
          ? `Có ${flaggedCount} câu hỏi ở mã đề ${grp?.examCode} xuất hiện cảnh báo phân tích thống kê cần giáo viên đối chiếu lại nội dung và đáp án.`
          : 'Các câu hỏi chưa ghi nhận bất thường theo ngưỡng thống kê hiện tại.',
      adjustmentRecommendation:
        'Giữ nguyên thang điểm và rà soát các phương án nhiễu có tỉ lệ chọn dưới 5% cho ngân hàng đề lần sau.',
      reinforcementPlan:
        reportData.failCount > 0
          ? `Tổ chức ôn tập củng cố kiến thức cơ bản cho ${reportData.failCount} học sinh dưới ngưỡng ${passThresholdInput} điểm và giao bài nâng cao cho nhóm đạt điểm giỏi.`
          : 'Tiếp tục duy trì tiến độ và mở rộng bài tập vận dụng cao.',
    });
  }, [activeExam?.id, reportData?.summary.presentCount, passThresholdInput]);

  const currentCodeGroup: CodeAnalysisGroup | undefined = useMemo(
    () => reportData?.codeGroups.find((g) => g.examCode === activeCodeTab) || reportData?.codeGroups[0],
    [reportData, activeCodeTab]
  );

  const selectedP1Item: Part1ItemAnalysis | undefined = useMemo(
    () =>
      currentCodeGroup?.part1Items.find((i) => i.question === selectedP1Question) ||
      currentCodeGroup?.part1Items[0],
    [currentCodeGroup, selectedP1Question]
  );

  // Honor board items
  const honorItems = useMemo(() => {
    if (!reportData) return [];
    let list = reportData.rankedSubmissions;
    if (honorScope === 'class' && honorClass !== 'all') {
      list = list.filter((r) => r.student?.className === honorClass);
    }
    return list.slice(0, honorTopN);
  }, [reportData, honorScope, honorClass, honorTopN]);

  const collectChartImages = async (): Promise<ReportChartImage[]> => {
    const imgs: ReportChartImage[] = [];
    const pairs: [React.RefObject<SVGSVGElement | null>, string][] = [
      [histSvgRef, 'Biểu đồ phổ điểm'],
      [partsSvgRef, 'Điểm trung bình theo từng phần'],
      [classSvgRef, 'So sánh điểm trung bình theo lớp'],
    ];
    for (const [ref, title] of pairs) {
      if (ref.current) {
        try {
          const dataUrl = await svgElementToPngDataUrl(ref.current);
          imgs.push({ title, dataUrl });
        } catch {
          // ignore
        }
      }
    }
    return imgs;
  };

  const handleSaveSpecs = async () => {
    if (!activeExam) return;
    await upsertExam({ ...activeExam, questionSpecs: draftSpecs, updatedAt: Date.now() });
    setShowSpecEditor(false);
  };

  const initSpecsFromKeys = () => {
    if (!activeExam) return;
    const ak = answerKeys.find((k) => k.examId === activeExam.id);
    if (!ak) return;
    const list: QuestionSpecMeta[] = [];
    for (let q = 1; q <= ak.part1Count; q++) {
      const existing = draftSpecs.find((s) => s.part === 'part1' && s.question === q);
      list.push(existing || { part: 'part1', question: q, topic: 'Chủ đề 1', cognitiveLevel: 'NB' });
    }
    for (let q = 1; q <= ak.part2Count; q++) {
      const existing = draftSpecs.find((s) => s.part === 'part2' && s.question === q);
      list.push(existing || { part: 'part2', question: q, topic: 'Chủ đề 2', cognitiveLevel: 'TH' });
    }
    for (let q = 1; q <= ak.part3Count; q++) {
      const existing = draftSpecs.find((s) => s.part === 'part3' && s.question === q);
      list.push(existing || { part: 'part3', question: q, topic: 'Chủ đề 3', cognitiveLevel: 'VD' });
    }
    setDraftSpecs(list);
  };

  if (!activeExam || !reportData) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-3">
        <h2 className="text-base font-semibold">Chưa có kỳ kiểm tra để phân tích</h2>
        <button
          type="button"
          onClick={() => setActivePage('exams')}
          className="px-4 py-2 bg-[#2563EB] text-white text-xs font-medium rounded-md"
        >
          Chọn kỳ kiểm tra
        </button>
      </div>
    );
  }

  const maxHistCount = Math.max(1, ...reportData.summary.histogram.map((b) => b.count));

  return (
    <div className="space-y-5">
      {/* Header & Common Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div>
            <h1 className="text-[21px] font-bold text-[#1E293B]">Thống kê & Phân tích chất lượng đề thi</h1>
            <p className="text-sm leading-relaxed text-slate-600 mt-1">
              Chỉ tổng hợp từ bài đã kiểm duyệt chính thức (N ={' '}
              <strong className="font-mono-num text-[#16A34A]">{reportData.summary.presentCount}</strong>). Bài chờ
              kiểm duyệt ({reportData.reviewCount}) và học sinh vắng ({reportData.summary.absentCount}) được tách riêng.
            </p>
            {reportData.summary.presentCount === 0 && (
              <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Chưa có bài đã duyệt để tính phổ điểm và các chỉ số thống kê. Hãy kiểm duyệt bài thi tại mục Kiểm duyệt trước khi sử dụng báo cáo.
              </p>
            )}
          </div>
          <div className="inline-flex rounded border border-slate-300 bg-slate-50 p-0.5 text-xs w-fit">
            <button
              type="button"
              onClick={() => setDataScope('practice')}
              className={`px-2.5 py-1 rounded ${dataScope === 'practice' ? 'bg-white text-[#2563EB] font-medium' : 'text-slate-600'}`}
            >
              Thực hành
            </button>
            <button
              type="button"
              onClick={() => setDataScope('official')}
              className={`px-2.5 py-1 rounded ${dataScope === 'official' ? 'bg-white text-[#16A34A] font-medium' : 'text-slate-600'}`}
            >
              Chính thức
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-slate-100">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
          >
            <option value="all">Tất cả môn</option>
            {availableSubjects.map((s) => (
              <option key={s} value={s}>
                Môn {s}
              </option>
            ))}
          </select>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
          >
            <option value="all">Tất cả khối</option>
            {availableGrades.map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </select>
          <select
            value={activeExam.id}
            onChange={(e) => setActiveExamId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium min-w-[220px]"
          >
            {filteredExamChoices.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
          >
            <option value="all">Tất cả lớp</option>
            {availableClasses.map((c) => (
              <option key={c} value={c}>
                Lớp {c}
              </option>
            ))}
          </select>
          <select
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
          >
            <option value="all">Tất cả mã đề</option>
            {availableCodes.map((c) => (
              <option key={c} value={c}>
                Mã đề {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-slate-600">Ngưỡng đạt:</span>
            <input
              type="number"
              step="0.5"
              value={passThresholdInput}
              onChange={(e) => setPassThresholdInput(Number(e.target.value) || 0)}
              className="w-16 px-2 py-1 border border-slate-300 rounded font-mono-num text-center"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSubjectFilter('all');
              setGradeFilter('all');
              setClassFilter('all');
              setCodeFilter('all');
              setPassThresholdInput(activeExam.passThreshold);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 ml-auto"
          >
            <FilterX className="w-3.5 h-3.5" />
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* 12 KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: 'Tổng học sinh', val: reportData.totalStudents, cls: 'text-[#1E293B]' },
          { label: 'Đã duyệt (Mẫu N)', val: reportData.summary.presentCount, cls: 'text-[#16A34A]' },
          { label: 'Chờ kiểm duyệt', val: reportData.reviewCount, cls: 'text-amber-600' },
          { label: 'Vắng thi (không tính 0)', val: reportData.summary.absentCount, cls: 'text-slate-600' },
          { label: 'Điểm trung bình', val: reportData.summary.mean, cls: 'text-[#2563EB]' },
          { label: 'Trung vị (Median)', val: reportData.summary.median, cls: 'text-[#1E293B]' },
          { label: 'Độ lệch chuẩn (SD)', val: reportData.summary.stdDev, cls: 'text-slate-700' },
          { label: 'Điểm cao nhất', val: reportData.summary.max, cls: 'text-[#16A34A]' },
          { label: 'Điểm thấp nhất', val: reportData.summary.min, cls: 'text-[#DC2626]' },
          {
            label: `Số đạt (≥ ${passThresholdInput}đ)`,
            val: `${reportData.summary.passCount} (${reportData.summary.passRate}%)`,
            cls: 'text-[#16A34A]',
          },
          {
            label: `Chưa đạt (< ${passThresholdInput}đ)`,
            val: `${reportData.failCount} (${reportData.failRate}%)`,
            cls: 'text-[#DC2626]',
          },
          {
            label: 'ĐTB Phần I / II / III',
            val: `${reportData.partAverages.part1Avg} / ${reportData.partAverages.part2Avg} / ${reportData.partAverages.part3Avg}`,
            cls: 'text-[#2563EB]',
          },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
            <div className="text-[11px] text-slate-500 truncate">{k.label}</div>
            <div className={`text-base font-bold font-mono-num mt-0.5 ${k.cls}`}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 1. Histogram */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#2563EB]" />
              Biểu đồ phổ điểm (N = {reportData.summary.presentCount})
            </h3>
            <button
              type="button"
              onClick={async () => {
                if (!histSvgRef.current) return;
                const url = await svgElementToPngDataUrl(histSvgRef.current);
                triggerPngDownload(url, `Pho-diem_${activeExam.subject}.png`);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> PNG
            </button>
          </div>
          <svg ref={histSvgRef} viewBox="0 0 640 240" className="w-full h-auto">
            {reportData.summary.histogram.map((b, idx) => {
              const bw = 44;
              const gap = 14;
              const x = 36 + idx * (bw + gap);
              const h = Math.round((b.count / maxHistCount) * 165);
              const y = 195 - h;
              return (
                <g key={b.label}>
                  <rect x={x} y={y} width={bw} height={h} rx={4} fill="#2563EB" opacity={0.88} />
                  <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1E293B">
                    {b.count}
                  </text>
                  <text x={x + bw / 2} y={214} textAnchor="middle" fontSize="10.5" fill="#475569">
                    {b.label}
                  </text>
                </g>
              );
            })}
            <line x1="28" y1="195" x2="625" y2="195" stroke="#CBD5E1" strokeWidth="1.2" />
          </svg>
        </div>

        {/* 2. Pass/Fail + Part Averages */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E293B]">Tỉ lệ Đạt / Chưa đạt (N = {reportData.summary.presentCount})</h3>
              <button
                type="button"
                onClick={async () => {
                  if (!passSvgRef.current) return;
                  const url = await svgElementToPngDataUrl(passSvgRef.current, 600, 140);
                  triggerPngDownload(url, `Ti-le-dat_${activeExam.subject}.png`);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                <Download className="w-3 h-3" /> PNG
              </button>
            </div>
            <svg ref={passSvgRef} viewBox="0 0 460 76" className="w-full h-auto">
              <rect x="10" y="16" width="440" height="24" rx="5" fill="#FEE2E2" />
              <rect
                x="10"
                y="16"
                width={Math.round((reportData.summary.passRate / 100) * 440)}
                height="24"
                rx="5"
                fill="#16A34A"
              />
              <text x="10" y="58" fontSize="12" fontWeight="bold" fill="#16A34A">
                Đạt: {reportData.summary.passCount} ({reportData.summary.passRate}%)
              </text>
              <text x="450" y="58" textAnchor="end" fontSize="12" fontWeight="bold" fill="#DC2626">
                Chưa đạt: {reportData.failCount} ({reportData.failRate}%)
              </text>
            </svg>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E293B]">Điểm trung bình từng phần</h3>
              <button
                type="button"
                onClick={async () => {
                  if (!partsSvgRef.current) return;
                  const url = await svgElementToPngDataUrl(partsSvgRef.current, 640, 220);
                  triggerPngDownload(url, `Diem-tung-phan_${activeExam.subject}.png`);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                <Download className="w-3 h-3" /> PNG
              </button>
            </div>
            <svg ref={partsSvgRef} viewBox="0 0 460 120" className="w-full h-auto">
              {[
                { label: 'Phần I', avg: reportData.partAverages.part1Avg, max: reportData.partAverages.part1Max, color: '#2563EB' },
                { label: 'Phần II', avg: reportData.partAverages.part2Avg, max: reportData.partAverages.part2Max, color: '#16A34A' },
                { label: 'Phần III', avg: reportData.partAverages.part3Avg, max: reportData.partAverages.part3Max, color: '#7C3AED' },
              ]
                .filter((p) => p.max > 0)
                .map((p, idx) => {
                  const y = 16 + idx * 34;
                  const pct = Math.min(1, p.avg / p.max);
                  return (
                    <g key={p.label}>
                      <text x="8" y={y + 13} fontSize="11.5" fontWeight="bold" fill="#334155">
                        {p.label}
                      </text>
                      <rect x="80" y={y} width="260" height="18" rx="4" fill="#F1F5F9" />
                      <rect x="80" y={y} width={Math.round(pct * 260)} height="18" rx="4" fill={p.color} />
                      <text x="350" y={y + 13} fontSize="11" fontWeight="bold" fill="#1E293B">
                        {p.avg}/{p.max} ({Math.round(pct * 100)}%)
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>
        </div>
      </div>

      {/* Class & ExamCode Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1E293B]">So sánh kết quả giữa các lớp</h3>
            <button
              type="button"
              onClick={async () => {
                if (!classSvgRef.current) return;
                const url = await svgElementToPngDataUrl(classSvgRef.current, 700, 260);
                triggerPngDownload(url, `So-sanh-lop_${activeExam.subject}.png`);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> PNG
            </button>
          </div>
          <svg ref={classSvgRef} viewBox="0 0 480 150" className="w-full h-auto">
            {reportData.classComparison.map((c, idx) => {
              const y = 14 + idx * 36;
              const pct = Math.min(1, c.mean / Math.max(1, activeExam.scoreScale));
              return (
                <g key={c.className}>
                  <text x="8" y={y + 14} fontSize="11.5" fontWeight="bold" fill="#1E293B">
                    {c.className}
                  </text>
                  <rect x="75" y={y} width="260" height="20" rx="4" fill="#F1F5F9" />
                  <rect x="75" y={y} width={Math.round(pct * 260)} height="20" rx="4" fill="#2563EB" />
                  <text x="344" y={y + 14} fontSize="11" fill="#334155">
                    TB {c.mean} · Đạt {c.passRate}% (N={c.gradedCount})
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1E293B]">So sánh giữa các mã đề</h3>
            <button
              type="button"
              onClick={async () => {
                if (!codeSvgRef.current) return;
                const url = await svgElementToPngDataUrl(codeSvgRef.current, 700, 260);
                triggerPngDownload(url, `So-sanh-ma-de_${activeExam.subject}.png`);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> PNG
            </button>
          </div>
          <svg ref={codeSvgRef} viewBox="0 0 480 150" className="w-full h-auto">
            {reportData.codeComparison.map((m, idx) => {
              const y = 14 + idx * 32;
              const pct = Math.min(1, m.mean / Math.max(1, activeExam.scoreScale));
              return (
                <g key={m.examCode}>
                  <text x="8" y={y + 13} fontSize="11.5" fontWeight="bold" fill="#1E293B">
                    Đề {m.examCode}
                  </text>
                  <rect x="75" y={y} width="260" height="18" rx="4" fill="#F1F5F9" />
                  <rect x="75" y={y} width={Math.round(pct * 260)} height="18" rx="4" fill="#16A34A" />
                  <text x="344" y={y + 13} fontSize="11" fill="#334155">
                    TB {m.mean} · {m.min}–{m.max} (N={m.gradedCount})
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Question Rate Chart & Topic/Cognitive Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#1E293B]">
              Phân tích chuyên đề, mức độ nhận thức & độ tin cậy đề thi
            </h3>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Info className="w-3.5 h-3.5 text-[#2563EB]" />
              {reportData.kr20OverallNote}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (draftSpecs.length === 0) initSpecsFromKeys();
              setShowSpecEditor((v) => !v);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs hover:bg-slate-50"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showSpecEditor ? 'Đóng ma trận câu hỏi' : 'Gán chuyên đề & mức độ (NB/TH/VD/VDC)'}
          </button>
        </div>

        {reportData.topicStats.length > 0 || reportData.cognitiveStats.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-700">Mức hoàn thành theo Chuyên đề</div>
              {reportData.topicStats.map((t) => (
                <div key={t.name} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>
                      {t.name} ({t.questionCount} câu)
                    </span>
                    <span className="font-mono-num font-bold text-[#2563EB]">{t.avgCompletionRate}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-[#2563EB]" style={{ width: `${t.avgCompletionRate}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-700">Mức hoàn thành theo Mức độ nhận thức</div>
              {reportData.cognitiveStats.map((c) => (
                <div key={c.name} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>
                      {c.name} ({c.questionCount} câu)
                    </span>
                    <span className="font-mono-num font-bold text-[#16A34A]">{c.avgCompletionRate}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-[#16A34A]" style={{ width: `${c.avgCompletionRate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
            Kỳ kiểm tra này chưa khai báo ma trận chuyên đề / mức độ nhận thức cho từng câu hỏi. Nhấn{' '}
            <strong>Gán chuyên đề & mức độ</strong> nếu muốn phân tích theo chuyên đề.
          </div>
        )}

        {showSpecEditor && (
          <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
            <div className="max-h-60 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
              {draftSpecs.map((sp, i) => (
                <div key={`${sp.part}_${sp.question}`} className="flex items-center gap-2 border border-slate-200 rounded px-2 py-1">
                  <span className="w-16 font-mono-num font-semibold">
                    {sp.part === 'part1' ? 'P.I' : sp.part === 'part2' ? 'P.II' : 'P.III'}.{sp.question}
                  </span>
                  <input
                    type="text"
                    value={sp.topic}
                    onChange={(e) =>
                      setDraftSpecs((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, topic: e.target.value } : x))
                      )
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded"
                    placeholder="Tên chuyên đề"
                  />
                  <select
                    value={sp.cognitiveLevel}
                    onChange={(e) =>
                      setDraftSpecs((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? { ...x, cognitiveLevel: e.target.value as QuestionSpecMeta['cognitiveLevel'] }
                            : x
                        )
                      )
                    }
                    className="px-2 py-1 border border-slate-300 rounded bg-white"
                  >
                    <option value="NB">NB</option>
                    <option value="TH">TH</option>
                    <option value="VD">VD</option>
                    <option value="VDC">VDC</option>
                  </select>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSaveSpecs}
              className="px-3 py-1.5 rounded bg-[#16A34A] text-white font-medium"
            >
              Lưu ma trận chuyên đề cho kỳ thi
            </button>
          </div>
        )}
      </div>

      {/* Per-ExamCode Detailed Item & Distractor Analysis */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#1E293B]">
              Phân tích chi tiết câu hỏi & phương án nhiễu theo từng mã đề
            </h3>
            <p className="text-[11px] text-slate-500">
              Tính độc lập cho từng mã đề để không trộn nhầm câu giữa các mã đề khác nhau.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reportData.codeGroups.map((g) => (
              <button
                key={g.examCode}
                type="button"
                onClick={() => {
                  setActiveCodeTab(g.examCode);
                  setSelectedP1Question(g.part1Items[0]?.question ?? null);
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium border ${
                  currentCodeGroup?.examCode === g.examCode
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Mã đề {g.examCode} (N={g.sampleCount})
              </button>
            ))}
          </div>
        </div>

        {!currentCodeGroup ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Chưa có bài đã kiểm duyệt chính thức để phân tích từng câu.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Độ tin cậy KR-20 (Phần I, mã đề {currentCodeGroup.examCode}):</strong>{' '}
                <strong className="font-mono-num text-[#2563EB]">
                  {currentCodeGroup.kr20 !== null ? currentCodeGroup.kr20 : 'Không áp dụng'}
                </strong>
              </span>
              <span className="text-slate-600">{currentCodeGroup.kr20Note}</span>
            </div>

            {/* Part I question bar chart (correct/wrong/blank rate) */}
            {currentCodeGroup.part1Items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#1E293B]">
                    Tỉ lệ Đúng / Sai / Bỏ trống từng câu Phần I (Mã đề {currentCodeGroup.examCode})
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!qRateSvgRef.current) return;
                      const url = await svgElementToPngDataUrl(qRateSvgRef.current, 900, 260);
                      triggerPngDownload(url, `Ty-le-cau-P1_De-${currentCodeGroup.examCode}.png`);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600"
                  >
                    <Download className="w-3 h-3" /> PNG
                  </button>
                </div>
                <svg ref={qRateSvgRef} viewBox="0 0 720 140" className="w-full h-auto">
                  {currentCodeGroup.part1Items.map((it, idx) => {
                    const colW = Math.max(14, Math.min(34, 680 / Math.max(1, currentCodeGroup.part1Items.length)));
                    const x = 24 + idx * colW;
                    const barW = Math.max(8, colW - 4);
                    const totalN = Math.max(1, it.correctCount + it.wrongCount + it.blankCount);
                    const hCorr = Math.round((it.correctCount / totalN) * 100);
                    const hWrong = Math.round((it.wrongCount / totalN) * 100);
                    const hBlank = Math.max(0, 100 - hCorr - hWrong);
                    return (
                      <g
                        key={it.question}
                        className="cursor-pointer"
                        onClick={() => setSelectedP1Question(it.question)}
                      >
                        <rect x={x} y={12} width={barW} height={hBlank} fill="#CBD5E1" />
                        <rect x={x} y={12 + hBlank} width={barW} height={hWrong} fill="#EF4444" />
                        <rect x={x} y={12 + hBlank + hWrong} width={barW} height={hCorr} fill="#16A34A" />
                        <text x={x + barW / 2} y={128} textAnchor="middle" fontSize="9.5" fill="#475569">
                          {it.question}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* Part I Table + Interactive Distractor Panel */}
            {currentCodeGroup.part1Items.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                <div className="xl:col-span-7 overflow-x-auto border border-slate-200 rounded max-h-[380px]">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-600">
                      <tr>
                        <th className="px-2.5 py-2 text-left">Câu</th>
                        <th className="px-2.5 py-2 text-center">ĐÁ</th>
                        <th className="px-2.5 py-2 text-right">Đúng (%)</th>
                        <th className="px-2.5 py-2 text-right">Độ khó p</th>
                        <th className="px-2.5 py-2 text-right">Phân biệt D</th>
                        <th className="px-2.5 py-2 text-right">r_ir</th>
                        <th className="px-2.5 py-2 text-left">Cảnh báo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentCodeGroup.part1Items.map((it) => {
                        const sel = selectedP1Item?.question === it.question;
                        return (
                          <tr
                            key={it.question}
                            onClick={() => setSelectedP1Question(it.question)}
                            className={`cursor-pointer ${
                              sel ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-2.5 py-1.5 font-semibold font-mono-num">{it.label}</td>
                            <td className="px-2.5 py-1.5 text-center font-bold text-[#16A34A] font-mono-num">
                              {it.correctValue || '-'}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono-num">{it.correctRate}%</td>
                            <td className="px-2.5 py-1.5 text-right font-mono-num">{it.difficulty}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono-num">
                              {it.discrimination !== null ? it.discrimination : '-'}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono-num">
                              {it.itemRestCorr !== null ? it.itemRestCorr : '-'}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11px] text-amber-700">
                              {it.warnings.length > 0 ? it.warnings.join('; ') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Selected Question Distractor Breakdown */}
                {selectedP1Item && (
                  <div className="xl:col-span-5 border border-slate-200 rounded p-3.5 space-y-3 text-xs bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-[#1E293B]">
                        Phân tích phương án nhiễu — {selectedP1Item.label} (ĐÁ đúng: {selectedP1Item.correctValue})
                      </div>
                      <span className="font-mono-num text-[11px] text-slate-500">
                        Đúng {selectedP1Item.correctCount} · Sai {selectedP1Item.wrongCount} · Trống{' '}
                        {selectedP1Item.blankCount}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {selectedP1Item.distractors.map((d) => (
                        <div key={d.option} className="space-y-0.5">
                          <div className="flex justify-between font-mono-num">
                            <span className={d.isCorrect ? 'font-bold text-[#16A34A]' : 'text-slate-700'}>
                              Phương án {d.option} {d.isCorrect ? '(Đúng)' : '(Nhiễu)'}
                            </span>
                            <span>
                              {d.count} HS ({d.rate}%) · Cao: {d.highCount} | Thấp: {d.lowCount}
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-200 rounded overflow-hidden">
                            <div
                              className={`h-full ${d.isCorrect ? 'bg-[#16A34A]' : 'bg-slate-500'}`}
                              style={{ width: `${d.rate}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedP1Item.warnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900">
                        <strong>Cảnh báo thống kê:</strong> {selectedP1Item.warnings.join(' · ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Part II Analysis */}
            {currentCodeGroup.part2Items.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#1E293B]">
                  Phần II — Phân tích Đúng/Sai theo từng ý (a, b, c, d) & điểm lũy tiến
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-2.5 py-2 text-left">Câu</th>
                        <th className="px-2.5 py-2 text-left">Tỉ lệ đúng từng ý a / b / c / d</th>
                        <th className="px-2.5 py-2 text-center">Phân bố 0→4 ý đúng</th>
                        <th className="px-2.5 py-2 text-right">ĐTB câu</th>
                        <th className="px-2.5 py-2 text-right">Phân biệt D</th>
                        <th className="px-2.5 py-2 text-left">Cảnh báo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentCodeGroup.part2Items.map((it) => (
                        <tr key={it.question}>
                          <td className="px-2.5 py-2 font-semibold font-mono-num">{it.label}</td>
                          <td className="px-2.5 py-2 font-mono-num">
                            {it.subItems
                              .map((s) => `${s.subItem}(${s.correctValue}): ${s.correctRate}%`)
                              .join(' · ')}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono-num">
                            {it.correctBucketCounts.join(' / ')}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono-num">
                            {it.avgPoints}/{it.maxPoints} ({Math.round(it.completionRatio * 100)}%)
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono-num">
                            {it.discrimination !== null ? it.discrimination : '-'}
                          </td>
                          <td className="px-2.5 py-2 text-[11px] text-amber-700">
                            {it.warnings.length > 0 ? it.warnings.join('; ') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Part III Analysis */}
            {currentCodeGroup.part3Items.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#1E293B]">
                  Phần III — Phân tích câu trả lời ngắn
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-2.5 py-2 text-left">Câu</th>
                        <th className="px-2.5 py-2 text-left">Đáp án</th>
                        <th className="px-2.5 py-2 text-right">Đúng (%)</th>
                        <th className="px-2.5 py-2 text-right">Sai / Trống / Lỗi</th>
                        <th className="px-2.5 py-2 text-right">Phân biệt D</th>
                        <th className="px-2.5 py-2 text-left">Giá trị sai phổ biến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentCodeGroup.part3Items.map((it) => (
                        <tr key={it.question}>
                          <td className="px-2.5 py-2 font-semibold font-mono-num">{it.label}</td>
                          <td className="px-2.5 py-2 font-mono-num font-bold text-[#16A34A]">
                            {it.correctValue || '-'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono-num">{it.correctRate}%</td>
                          <td className="px-2.5 py-2 text-right font-mono-num">
                            {it.wrongCount} / {it.blankCount} / {it.invalidCount + it.reviewCount}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono-num">
                            {it.discrimination !== null ? it.discrimination : '-'}
                          </td>
                          <td className="px-2.5 py-2 text-[11px] font-mono-num text-slate-600">
                            {it.commonWrongAnswers.length > 0
                              ? it.commonWrongAnswers.map((w) => `${w.value} (${w.count})`).join(', ')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Honor Board (Top 3 / 5 / 10) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Bảng vàng danh dự (học sinh đã kiểm duyệt chính thức)
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={honorScope}
              onChange={(e) => setHonorScope(e.target.value as 'exam' | 'class')}
              className="px-2 py-1 border border-slate-300 rounded bg-white"
            >
              <option value="exam">Toàn kỳ kiểm tra</option>
              <option value="class">Theo từng lớp</option>
            </select>
            {honorScope === 'class' && (
              <select
                value={honorClass}
                onChange={(e) => setHonorClass(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded bg-white"
              >
                <option value="all">Tất cả lớp</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    Lớp {c}
                  </option>
                ))}
              </select>
            )}
            <select
              value={honorTopN}
              onChange={(e) => setHonorTopN(Number(e.target.value) as 3 | 5 | 10)}
              className="px-2 py-1 border border-slate-300 rounded bg-white"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
            <button
              type="button"
              onClick={() => setHideStudentNames((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border ${
                hideStudentNames
                  ? 'bg-blue-50 border-blue-300 text-[#2563EB] font-medium'
                  : 'bg-white border-slate-300 text-slate-600'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              {hideStudentNames ? 'Đang ẩn họ tên' : 'Ẩn tên khi trình chiếu'}
            </button>
          </div>
        </div>

        {honorItems.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">
            Chưa có bài đã kiểm duyệt chính thức để lập bảng vàng.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {honorItems.map((item, idx) => {
              const medal =
                idx === 0
                  ? 'border-amber-300 bg-amber-50/70'
                  : idx === 1
                  ? 'border-slate-300 bg-slate-50'
                  : idx === 2
                  ? 'border-orange-300 bg-orange-50/60'
                  : 'border-slate-200 bg-white';
              const medalLabel =
                idx === 0 ? 'Vàng · Hạng 1' : idx === 1 ? 'Bạc · Hạng 2' : idx === 2 ? 'Đồng · Hạng 3' : `Hạng ${item.rank}`;
              return (
                <div key={item.submission.id} className={`border rounded-lg p-3 text-xs space-y-1 ${medal}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700">{medalLabel}</span>
                    <span className="text-sm font-bold font-mono-num text-[#16A34A]">
                      {item.submission.scoreBreakdown.total}đ
                    </span>
                  </div>
                  <div className="font-semibold text-[#1E293B] truncate">
                    {hideStudentNames
                      ? `Thí sinh SBD ${item.submission.sbd}`
                      : item.student?.fullName || '(Chưa đối chiếu)'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-num">
                    SBD {item.submission.sbd} · {item.student?.className || '---'} · Đề {item.submission.examCode}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editable Professional Report & Word/Excel/PDF Export */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#1E293B]">
              Xuất báo cáo chuyên môn hoàn chỉnh (Times New Roman 13pt)
            </h3>
            <p className="text-[11px] text-slate-500">
              Chỉnh sửa nội dung nhận xét trước khi xuất sang Word (.docx), Excel (.xlsx) hoặc PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!!busyExport}
              onClick={async () => {
                setBusyExport('Đang tạo Word...');
                try {
                  const chartImages = await collectChartImages();
                  await exportAnalyticsWordDocx({
                    exam: activeExam,
                    data: reportData,
                    classFilter,
                    codeFilter,
                    passThreshold: passThresholdInput,
                    teacherSections,
                    chartImages,
                  });
                } finally {
                  setBusyExport(null);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2563EB] text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              Xuất Word (.docx)
            </button>
            <button
              type="button"
              disabled={!!busyExport}
              onClick={async () => {
                setBusyExport('Đang tạo Excel...');
                try {
                  await exportAnalyticsExcelXLSX({
                    exam: activeExam,
                    data: reportData,
                    passThreshold: passThresholdInput,
                  });
                } finally {
                  setBusyExport(null);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#16A34A] text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Xuất Excel (.xlsx)
            </button>
            <button
              type="button"
              disabled={!!busyExport}
              onClick={async () => {
                setBusyExport('Đang tạo PDF...');
                try {
                  const chartImages = await collectChartImages();
                  await exportAnalyticsPdf({
                    exam: activeExam,
                    data: reportData,
                    classFilter,
                    codeFilter,
                    passThreshold: passThresholdInput,
                    teacherSections,
                    chartImages,
                  });
                } finally {
                  setBusyExport(null);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất PDF báo cáo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">1. Nhận xét chung</label>
            <textarea
              rows={2}
              value={teacherSections.generalComment}
              onChange={(e) =>
                setTeacherSections({ ...teacherSections, generalComment: e.target.value })
              }
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">2. Các câu cần rà soát</label>
            <textarea
              rows={2}
              value={teacherSections.questionReviewNote}
              onChange={(e) =>
                setTeacherSections({ ...teacherSections, questionReviewNote: e.target.value })
              }
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              3. Kiến nghị điều chỉnh đề / đáp án
            </label>
            <textarea
              rows={2}
              value={teacherSections.adjustmentRecommendation}
              onChange={(e) =>
                setTeacherSections({
                  ...teacherSections,
                  adjustmentRecommendation: e.target.value,
                })
              }
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              4. Định hướng phụ đạo & bồi dưỡng
            </label>
            <textarea
              rows={2}
              value={teacherSections.reinforcementPlan}
              onChange={(e) =>
                setTeacherSections({ ...teacherSections, reinforcementPlan: e.target.value })
              }
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
            />
          </div>
        </div>
        {busyExport && <div className="text-[11px] text-[#2563EB] font-medium">{busyExport}</div>}
      </div>
    </div>
  );
};
