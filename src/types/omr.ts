export type NavPage =
  | 'overview'
  | 'exams'
  | 'classes'
  | 'templates'
  | 'designer'
  | 'answers'
  | 'camera'
  | 'batch'
  | 'scanner'
  | 'review'
  | 'gradebook'
  | 'report-cards'
  | 'analytics'
  | 'backup'
  | 'settings'
  | 'guide';

export type PaperSize = 'A4' | 'A5' | 'A3';
export type Orientation = 'portrait' | 'landscape';
export type TemplateCategory = 'thpt2025' | 'traditional' | 'paired_a5' | 'phach_a3' | 'custom';

export interface NormalizedPoint {
  x: number; // 0..1 relative to sheet width
  y: number; // 0..1 relative to sheet height
}

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BubbleGroupKind =
  | 'sbd'
  | 'exam_code'
  | 'phach_code'
  | 'part1'
  | 'part2'
  | 'part3';

export interface BubbleCoord {
  id: string;
  kind: BubbleGroupKind;
  // For sbd/exam_code/phach_code: col = digit index (0-based), option = '0'..'9'
  // For part1: question = 1..N, option = 'A'|'B'|'C'|'D'
  // For part2: question = 1..N, subItem = 'a'|'b'|'c'|'d', option = 'Đ'|'S'
  // For part3: question = 1..N, col = 0..3, option = '-'|','|'0'..'9'
  question?: number;
  subItem?: 'a' | 'b' | 'c' | 'd';
  col?: number;
  option: string;
  cx: number; // normalized 0..1 inside warped canonical frame (fiducial-bounded or full sheet)
  cy: number; // normalized 0..1
  rx: number; // normalized radius x
  ry: number; // normalized radius y
  pairedSlot?: 1 | 2;
}

export interface FiducialConfig {
  // Normalized coordinates (0..1) of the 4 corner black squares in the canonical template
  topLeft: NormalizedPoint;
  topRight: NormalizedPoint;
  bottomRight: NormalizedPoint;
  bottomLeft: NormalizedPoint;
  markerSizeNorm: number; // e.g., 0.022 of width
  // Secondary small orientation square near top-left to resolve 0/90/180/270 deg unambiguously
  orientationAnchor?: NormalizedPoint;
}

export interface SheetTemplate {
  id: string;
  version: string;
  name: string;
  category: TemplateCategory;
  paperSize: PaperSize;
  orientation: Orientation;
  widthPx: number;  // canonical warped width, e.g., 1240
  heightPx: number; // canonical warped height, e.g., 1754
  fiducials: FiducialConfig;
  sbdDigits: number;
  examCodeDigits: number;
  phachDigits?: number;
  part1Count: number;
  part1Columns: number;
  part2Count: number;
  part3Count: number;
  part3ColsPerQuestion: number; // typically 4 columns: [-, , 0..9]
  headerConfig: {
    showSchoolName: boolean;
    showExamName: boolean;
    showSubject: boolean;
    showStudentInfoBox: boolean;
    showPhachStub: boolean;
    phachStubRect?: NormalizedRect;
    sbdRect: NormalizedRect;
    examCodeRect: NormalizedRect;
    phachCodeRect?: NormalizedRect;
    part1Rect?: NormalizedRect;
    part2Rect?: NormalizedRect;
    part3Rect?: NormalizedRect;
  };
  bubbles: BubbleCoord[];
  pairedSubSheets?: {
    slot: 1 | 2;
    bounds: NormalizedRect; // sub-region on the A4 landscape canvas
    fiducials: FiducialConfig;
  }[];
  backgroundImageDataUrl?: string;
  isBuiltIn: boolean;
  isOfficialVerified: boolean;
  compatibilityNote: string;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionSpecMeta {
  part: 'part1' | 'part2' | 'part3';
  question: number;
  topic: string;
  cognitiveLevel: 'NB' | 'TH' | 'VD' | 'VDC';
}

export interface Exam {
  id: string;
  schoolName: string; // default 'TRƯỜNG THPT'
  name: string;
  schoolYear: string;
  semester: string;
  subject: string;
  gradeLevel: string;
  classNames: string[];
  examDate: string;
  durationMinutes: number;
  teacherName: string;
  templateId: string;
  scoreScale: number; // e.g. 10
  passThreshold: number; // e.g. 5.0
  examCodes: string[];
  questionSpecs?: QuestionSpecMeta[];
  isArchived: boolean;
  isPractice?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ClassRoom {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYear: string;
  teacherName: string;
  note: string;
  isPractice?: boolean;
  createdAt: number;
}

export interface Student {
  id: string; // internal unique UUID
  studentCode: string;
  sbd: string; // string to preserve leading zeros!
  fullName: string;
  classId: string;
  className: string;
  note: string;
  absentExamIds: string[]; // track absence per exam without defaulting score to 0
  isPractice?: boolean;
  createdAt: number;
}

export type Part2SubKey = 'a' | 'b' | 'c' | 'd';
export type Part2AnswerMap = Record<Part2SubKey, boolean | null>; // true = Đúng, false = Sai

export interface AnswerKeyHistoryEntry {
  timestamp: number;
  reason: string;
  changedBy: string;
}

export interface AnswerKey {
  id: string;
  examId: string;
  examCode: string;
  templateId: string;
  part1Count: number;
  part1PointsPerQ: number;
  part1Answers: Record<number, string>; // 1 -> 'A' | 'B' | 'C' | 'D'
  part2Count: number;
  part2ScoringMode: 'progressive_2025' | 'custom';
  part2Progressive: [number, number, number, number, number]; // [0, 0.1, 0.25, 0.5, 1.0]
  part2CustomPerItem: number; // e.g. 0.25
  part2Answers: Record<number, Part2AnswerMap>;
  part3Count: number;
  part3PointsPerQ: number;
  part3AllowDotComma: boolean;
  part3AllowTolerance: boolean;
  part3Tolerance: number;
  part3RoundingMode: 'exact' | 'round_2';
  part3Answers: Record<number, string[]>; // multiple valid numeric strings allowed
  questionMapping?: Record<number, number>; // optional canonical question ID mapping across exam codes
  history: AnswerKeyHistoryEntry[];
  isPractice?: boolean;
  updatedAt: number;
}

export type BubbleMarkStatus =
  | 'correct'
  | 'wrong'
  | 'blank'
  | 'multi_mark'
  | 'faint'
  | 'erased'
  | 'unrecognized'
  | 'pending_review';

export interface BubbleDensity {
  bubbleId: string;
  option: string;
  fillRatio: number; // 0..1 dark pixel density inside core
  ringRatio: number; // 0..1 outer ring density (for erasure detection)
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  isMarked: boolean;
}

export interface QuestionRecognition {
  part: 'part1' | 'part2' | 'part3';
  question: number;
  subItem?: Part2SubKey; // for part2
  detectedValue: string; // e.g. 'A', 'Đ', '-1,5', ''
  correctValue: string;
  status: BubbleMarkStatus;
  confidence: number; // 0..1
  earnedPoints: number;
  maxPoints: number;
  bubbles: BubbleDensity[];
  note?: string;
}

export interface DigitRecognition {
  col: number;
  detectedDigit: string; // '0'..'9' or '?'
  confidence: number;
  status: 'ok' | 'blank' | 'multi_mark' | 'faint';
  bubbles: BubbleDensity[];
}

export interface RecognitionDetail {
  rotationDeg: 0 | 90 | 180 | 270;
  detectedFiducialsCount: number;
  templateMatched: boolean;
  sbd: string;
  sbdConfidence: number;
  sbdDigits: DigitRecognition[];
  examCode: string;
  examCodeConfidence: number;
  examCodeDigits: DigitRecognition[];
  phachCode?: string;
  phachConfidence?: number;
  phachDigits?: DigitRecognition[];
  questions: QuestionRecognition[];
  overallConfidence: number;
}

export interface QualityMetrics {
  brightness: number; // 0..255
  contrast: number;   // stdDev 0..128
  blurScore: number;  // Laplacian variance
  skewDeg: number;
  isLowLight: boolean;
  isBlurry: boolean;
  hasShadowWarning: boolean;
  detectedFiducials: number;
}

export interface ReviewEditEntry {
  timestamp: number;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export type SubmissionStatus = 'graded' | 'needs_review' | 'unprocessed' | 'error';

export interface ExamSubmission {
  id: string;
  examId: string;
  templateId: string;
  examCode: string;
  sbd: string;
  phachCode?: string;
  studentId?: string;
  pairedSlot?: 1 | 2;
  sourceFileName?: string;
  originalImageBlobId: string;
  warpedImageBlobId: string;
  qualityMetrics: QualityMetrics;
  recognition: RecognitionDetail;
  scoreBreakdown: {
    part1: number;
    part2: number;
    part3: number;
    total: number;
    maxPossible: number;
    correctCount: number;
    wrongCount: number;
    blankCount: number;
  };
  status: SubmissionStatus;
  reviewReasons: string[];
  editHistory: ReviewEditEntry[];
  teacherComment?: string;
  teacherCommentLocked?: boolean;
  isPractice?: boolean;
  practiceSheetId?: string;
  isTestSample?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type PracticeScenario =
  | 'standard_correct'
  | 'has_wrong'
  | 'has_blank'
  | 'multi_mark'
  | 'faint_mark'
  | 'erased_mark'
  | 'rotated_90'
  | 'skewed'
  | 'low_light'
  | 'shadow_gradient'
  | 'wrong_exam_code';

export interface PracticeSheetSpec {
  id: string;
  examId: string;
  templateId: string;
  studentId: string;
  studentName: string;
  className: string;
  sbd: string;
  examCode: string;
  scenario: PracticeScenario;
  scenarioLabel: string;
  expectedScore: number;
  expectedSummary: string;
}

export interface AppSettings {
  fillThreshold: number;       // default 0.34
  faintThreshold: number;      // default 0.21
  multiMarkDelta: number;      // default 0.12 (if top 2 marks are within delta, flag multi_mark/ambiguous)
  eraseRingThreshold: number;  // default 0.22
  blurMinScore: number;        // default 45
  darkMinBrightness: number;   // default 55
  autoCaptureFrames: number;   // default 4 stable frames
  soundEnabled: boolean;
  hideStudentInfoOnPhach: boolean;
  showRankingDefault: boolean;
  schoolLogoDataUrl?: string;
  reportCommentBands?: {
    minScore: number;
    title: string;
    commentTemplate: string;
  }[];
  vnEduColumnMap: Record<string, string>;
  smasColumnMap: Record<string, string>;
  googleDriveSyncEnabled: boolean;
  googleClientId: string;
}

export interface TestCaseResult {
  id: string;
  name: string;
  category: 'scoring' | 'omr' | 'storage' | 'pdf';
  passed: boolean;
  expected: string;
  actual: string;
  durationMs: number;
  details?: string;
}
