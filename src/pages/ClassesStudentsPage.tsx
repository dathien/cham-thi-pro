import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  downloadStudentRosterSampleExcel,
  exportStudentRosterExcel,
  parseStudentsFromSpreadsheet,
} from '../engine/excelExport';
import type { ClassRoom, Student } from '../types/omr';

export const ClassesStudentsPage: React.FC = () => {
  const {
    classes,
    students,
    submissions,
    activeExam,
    upsertClass,
    removeClass,
    upsertStudent,
    upsertStudentsBulk,
    removeStudent,
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'sbd' | 'name' | 'class'>('sbd');

  // Inline Class creator
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('12');

  // Inline Student creator/editor (no popup!)
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editStudentId, setEditStudentId] = useState<string | null>(null);
  const [stCode, setStCode] = useState('');
  const [stSbd, setStSbd] = useState('');
  const [stName, setStName] = useState('');
  const [stClassName, setStClassName] = useState('');
  const [stNote, setStNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Batch class transfer
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [transferTargetClass, setTransferTargetClass] = useState('');

  // Duplicate SBD detection
  const duplicateSbds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      if (!s.sbd) continue;
      counts.set(s.sbd, (counts.get(s.sbd) || 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, v] of counts.entries()) {
      if (v > 1) dups.add(k);
    }
    return dups;
  }, [students]);

  // Cross-reference with active exam submissions
  const matchedSbdSet = useMemo(() => {
    const set = new Set<string>();
    for (const sub of submissions) {
      if (sub.isTestSample) continue;
      if (activeExam && sub.examId !== activeExam.id) continue;
      if (sub.sbd) set.add(sub.sbd);
    }
    return set;
  }, [submissions, activeExam]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    if (classes.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setNotice(`Lớp "${name}" đã tồn tại.`);
      return;
    }
    const cls: ClassRoom = {
      id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      gradeLevel: newClassGrade.trim() || '12',
      schoolYear: activeExam?.schoolYear || '2026-2027',
      teacherName: '',
      note: '',
      createdAt: Date.now(),
    };
    await upsertClass(cls);
    setNewClassName('');
    setNotice(`Đã thêm lớp ${name}.`);
  };

  const openAddStudent = () => {
    setEditStudentId(null);
    setStCode('');
    setStSbd('');
    setStName('');
    setStClassName(
      selectedClassId !== 'all'
        ? classes.find((c) => c.id === selectedClassId)?.name || ''
        : classes[0]?.name || ''
    );
    setStNote('');
    setShowStudentForm(true);
  };

  const openEditStudent = (st: Student) => {
    setEditStudentId(st.id);
    setStCode(st.studentCode);
    setStSbd(st.sbd);
    setStName(st.fullName);
    setStClassName(st.className);
    setStNote(st.note);
    setShowStudentForm(true);
  };

  const ensureClassByName = async (name: string): Promise<ClassRoom | null> => {
    const clean = name.trim();
    if (!clean) return null;
    const found = classes.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (found) return found;
    const created: ClassRoom = {
      id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: clean,
      gradeLevel: clean.match(/^\d+/)?.[0] || '12',
      schoolYear: activeExam?.schoolYear || '2026-2027',
      teacherName: '',
      note: '',
      createdAt: Date.now(),
    };
    await upsertClass(created);
    return created;
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stName.trim()) {
      setNotice('Vui lòng nhập họ và tên học sinh.');
      return;
    }
    const cls = await ensureClassByName(stClassName || 'Chưa phân lớp');
    const existing = editStudentId ? students.find((s) => s.id === editStudentId) : undefined;
    const student: Student = {
      id: editStudentId || `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      studentCode: stCode.trim(),
      sbd: stSbd.trim(), // keep leading zeros strictly as string!
      fullName: stName.trim(),
      classId: cls?.id || '',
      className: cls?.name || stClassName.trim(),
      note: stNote.trim(),
      absentExamIds: existing?.absentExamIds || [],
      createdAt: existing?.createdAt || Date.now(),
    };
    await upsertStudent(student);
    setShowStudentForm(false);
    setNotice(editStudentId ? 'Đã cập nhật thông tin học sinh.' : 'Đã thêm học sinh.');
  };

  const handleImportSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseStudentsFromSpreadsheet(file);
      if (rows.length === 0) {
        setNotice('Không đọc được dòng học sinh hợp lệ từ file Excel/CSV.');
        return;
      }
      const classCache = new Map(classes.map((c) => [c.name.toLowerCase(), c]));
      const toSave: Student[] = [];
      for (const r of rows) {
        const cName = r.className || 'Chưa phân lớp';
        let cls = classCache.get(cName.toLowerCase());
        if (!cls) {
          cls = {
            id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: cName,
            gradeLevel: cName.match(/^\d+/)?.[0] || '12',
            schoolYear: activeExam?.schoolYear || '2026-2027',
            teacherName: '',
            note: '',
            createdAt: Date.now(),
          };
          await upsertClass(cls);
          classCache.set(cName.toLowerCase(), cls);
        }
        toSave.push({
          id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          studentCode: r.studentCode,
          sbd: r.sbd,
          fullName: r.fullName,
          classId: cls.id,
          className: cls.name,
          note: r.note,
          absentExamIds: [],
          createdAt: Date.now(),
        });
      }
      await upsertStudentsBulk(toSave);
      setNotice(`Đã nhập thành công ${toSave.length} học sinh từ file "${file.name}".`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Lỗi đọc file danh sách.');
    } finally {
      e.target.value = '';
    }
  };

  const handleTransferSelected = async () => {
    if (selectedIds.size === 0 || !transferTargetClass.trim()) return;
    const cls = await ensureClassByName(transferTargetClass);
    if (!cls) return;
    const updated = students
      .filter((s) => selectedIds.has(s.id))
      .map((s) => ({ ...s, classId: cls.id, className: cls.name }));
    await upsertStudentsBulk(updated);
    setSelectedIds(new Set());
    setNotice(`Đã chuyển ${updated.length} học sinh sang lớp ${cls.name}.`);
  };

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    return students
      .filter((s) => {
        if (selectedClassId !== 'all' && s.classId !== selectedClassId) return false;
        if (!q) return true;
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.sbd.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'sbd') return a.sbd.localeCompare(b.sbd, 'vi');
        if (sortBy === 'class') return a.className.localeCompare(b.className, 'vi');
        return a.fullName.localeCompare(b.fullName, 'vi');
      });
  }, [students, selectedClassId, search, sortBy]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Quản lý lớp và học sinh</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Số báo danh được lưu dạng chuỗi (giữ nguyên số 0 ở đầu), tự động phát hiện trùng SBD và đối chiếu bài thi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadStudentRosterSampleExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            Tải Excel mẫu
          </button>
          <button
            type="button"
            onClick={() => {
              const clsName =
                selectedClassId === 'all'
                  ? 'tat_ca'
                  : classes.find((c) => c.id === selectedClassId)?.name || 'lop';
              exportStudentRosterExcel(filteredStudents, clsName);
              setNotice(`Đã xuất ${filteredStudents.length} học sinh ra file Excel.`);
            }}
            disabled={filteredStudents.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#16A34A]" />
            Xuất danh sách
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Nhập Excel / CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportSpreadsheet}
            className="hidden"
          />
          <button
            type="button"
            onClick={openAddStudent}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Thêm học sinh
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-3.5 py-2.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-blue-700 underline">
            Đóng
          </button>
        </div>
      )}

      {duplicateSbds.size > 0 && (
        <div className="px-3.5 py-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Phát hiện {duplicateSbds.size} số báo danh bị trùng: {Array.from(duplicateSbds).join(', ')}. Vui lòng kiểm tra và chỉnh sửa.
          </span>
        </div>
      )}

      {/* Class Manager Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#1E293B]">Danh sách lớp học ({classes.length})</h2>
          <form onSubmit={handleAddClass} className="flex items-center gap-2">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Tên lớp (vd: 12A1)"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md w-36"
            />
            <input
              type="text"
              value={newClassGrade}
              onChange={(e) => setNewClassGrade(e.target.value)}
              placeholder="Khối"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md w-16"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-md hover:bg-slate-900"
            >
              Tạo lớp
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedClassId('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedClassId === 'all'
                ? 'bg-[#2563EB] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả ({students.length})
          </button>
          {classes.map((c) => {
            const count = students.filter((s) => s.classId === c.id).length;
            const active = selectedClassId === c.id;
            return (
              <div key={c.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedClassId(c.id)}
                  className={`px-3 py-1.5 rounded-l-md text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {c.name} ({count})
                </button>
                {count === 0 && (
                  <button
                    type="button"
                    onClick={() => removeClass(c.id)}
                    className="px-1.5 py-1.5 rounded-r-md bg-slate-100 text-slate-400 hover:text-[#DC2626] border-l border-slate-200"
                    title="Xóa lớp trống"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline Add/Edit Student Form */}
      {showStudentForm && (
        <form
          onSubmit={handleSaveStudent}
          className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1E293B]">
              {editStudentId ? 'Chỉnh sửa thông tin học sinh' : 'Thêm học sinh mới'}
            </h3>
            <button
              type="button"
              onClick={() => setShowStudentForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Đóng
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mã học sinh</label>
              <input
                type="text"
                value={stCode}
                onChange={(e) => setStCode(e.target.value)}
                placeholder="HS001"
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Số báo danh (chuỗi)
              </label>
              <input
                type="text"
                value={stSbd}
                onChange={(e) => setStSbd(e.target.value)}
                placeholder="010001"
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Họ và tên *</label>
              <input
                type="text"
                required
                value={stName}
                onChange={(e) => setStName(e.target.value)}
                placeholder="Nguyễn Văn An"
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lớp</label>
              <input
                type="text"
                value={stClassName}
                onChange={(e) => setStClassName(e.target.value)}
                placeholder="12A1"
                list="class-suggestions"
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md"
              />
              <datalist id="class-suggestions">
                {classes.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ghi chú</label>
              <input
                type="text"
                value={stNote}
                onChange={(e) => setStNote(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowStudentForm(false)}
              className="px-3.5 py-1.5 text-xs border border-slate-300 rounded-md"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium bg-[#2563EB] text-white rounded-md hover:bg-blue-700"
            >
              Lưu học sinh
            </button>
          </div>
        </form>
      )}

      {/* Search, Sort & Transfer Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm họ tên, số báo danh, mã học sinh..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'sbd' | 'name' | 'class')}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
          >
            <option value="sbd">Sắp xếp: Số báo danh</option>
            <option value="name">Sắp xếp: Họ và tên</option>
            <option value="class">Sắp xếp: Lớp</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">
              Đã chọn {selectedIds.size} HS:
            </span>
            <input
              type="text"
              value={transferTargetClass}
              onChange={(e) => setTransferTargetClass(e.target.value)}
              placeholder="Lớp đích..."
              list="class-suggestions"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md w-28"
            />
            <button
              type="button"
              onClick={handleTransferSelected}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-md hover:bg-slate-900"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Chuyển lớp
            </button>
          </div>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chưa có học sinh nào trong danh sách. Bạn có thể thêm trực tiếp hoặc nhập từ file Excel/CSV.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredStudents.length > 0 &&
                        filteredStudents.every((s) => selectedIds.has(s.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold">STT</th>
                  <th className="py-2.5 px-3 font-semibold">Mã học sinh</th>
                  <th className="py-2.5 px-3 font-semibold">Số báo danh</th>
                  <th className="py-2.5 px-3 font-semibold">Họ và tên</th>
                  <th className="py-2.5 px-3 font-semibold">Lớp</th>
                  <th className="py-2.5 px-3 font-semibold">Đối chiếu bài thi</th>
                  <th className="py-2.5 px-3 font-semibold">Ghi chú</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const isDup = st.sbd && duplicateSbds.has(st.sbd);
                  const hasSheet = st.sbd && matchedSbdSet.has(st.sbd);
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(st.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(st.id);
                            else next.delete(st.id);
                            setSelectedIds(next);
                          }}
                        />
                      </td>
                      <td className="py-2 px-3 font-mono-num text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono-num">{st.studentCode || '—'}</td>
                      <td
                        className={`py-2 px-3 font-mono-num font-semibold ${
                          isDup ? 'text-[#DC2626]' : 'text-[#1E293B]'
                        }`}
                      >
                        {st.sbd || '—'}
                        {isDup && <span className="ml-1 text-[10px]">(Trùng)</span>}
                      </td>
                      <td className="py-2 px-3 font-medium text-[#1E293B]">{st.fullName}</td>
                      <td className="py-2 px-3">{st.className}</td>
                      <td className="py-2 px-3">
                        {hasSheet ? (
                          <span className="text-[#16A34A] font-medium">Đã có bài thi</span>
                        ) : (
                          <span className="text-slate-400">Chưa có bài</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{st.note || '—'}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditStudent(st)}
                          className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                          title="Sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStudent(st.id)}
                          className="p-1.5 rounded text-slate-500 hover:text-[#DC2626] hover:bg-red-50"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
