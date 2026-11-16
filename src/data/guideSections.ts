import type { NavPage } from '../types/omr';

export type GuideIllustrationId =
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
  | 'report_cards'
  | 'analytics'
  | 'backup'
  | 'settings';

export interface GuideControlField {
  name: string;
  meaning: string;
}

export interface GuideTroubleItem {
  problem: string;
  cause: string;
  solution: string;
}

export interface GuideFaqItem {
  id: string;
  question: string;
  answerParagraphs: string[];
  steps?: string[];
  relatedSectionIds?: string[];
}

export interface GuideSection {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  category: string;
  targetNavPage?: NavPage;
  targetNavLabel?: string;
  summary: string;
  purpose: string;
  whenToUse: string[];
  howToOpen: string;
  prerequisites: string[];
  steps: { title: string; detail: string }[];
  controlsAndFields: GuideControlField[];
  practicalExample: {
    scenario: string;
    walkthrough: string[];
  };
  expectedResult: string;
  importantNotes: string[];
  troubleshooting: GuideTroubleItem[];
  illustrationId?: GuideIllustrationId;
  illustrationCaption?: string;
  relatedSectionIds: string[];
  searchKeywords: string[];
}

export const GUIDE_FAQS: GuideFaqItem[] = [
  {
    id: 'faq-camera',
    question: 'Tại sao Camera không mở được?',
    answerParagraphs: [
      'Trình duyệt chỉ cho phép truy cập Camera khi trang web chạy trên kết nối bảo mật (HTTPS hoặc localhost) và người dùng đã bấm "Cho phép" (Allow) quyền Camera.',
      'Nếu trước đó bạn từng bấm "Chặn" (Block) quyền Camera, hoặc có một phần mềm khác (như Zoom, Teams, Zalo video, ứng dụng Camera mặc định của Windows) đang chiếm dụng ống kính, trình duyệt sẽ báo không mở được thiết bị.',
    ],
    steps: [
      'Kiểm tra biểu tượng ổ khóa hoặc biểu tượng máy ảnh trên thanh địa chỉ trình duyệt và chuyển quyền Camera sang "Cho phép", sau đó tải lại trang.',
      'Đóng các phần mềm gọi video hoặc tab trình duyệt khác đang dùng Camera rồi nhấn lại nút "Bật Camera".',
      'Nếu máy có nhiều ống kính (ví dụ Camera trước/sau trên điện thoại hoặc Webcam rời trên laptop), nhấn nút "Đổi Camera" để chuyển sang ống kính phù hợp.',
      'Trong trường hợp máy tính để bàn không có Webcam, bạn có thể chụp ảnh bằng điện thoại hoặc quét thành PDF rồi dùng chức năng "Chấm PDF và ảnh".',
    ],
    relatedSectionIds: ['camera', 'batch'],
  },
  {
    id: 'faq-sheet-not-detected',
    question: 'Tại sao phiếu thi không được nhận diện?',
    answerParagraphs: [
      'Hệ thống nhận dạng OMR dựa vào 4 ô vuông đen định vị nằm ở 4 góc của khung phiếu thi để căn thẳng và xác định tọa độ từng câu trả lời. Nếu thiếu 1 trong 4 góc, bị mất mép khi chụp/scan, hoặc phiếu đang chọn khác với mẫu phiếu thực tế, hệ thống không thể căn chỉnh chính xác.',
      'Ngoài ra, ánh sáng quá tối, bóng tay/bóng điện thoại che lên góc định vị, hoặc ảnh bị nhòe do rung tay cũng làm chỉ số "Định vị: X/4" không đạt mức 4/4.',
    ],
    steps: [
      'Kiểm tra lại ô chọn mẫu phiếu ở góc trên màn hình chấm thi để chắc chắn đang chọn đúng mẫu phiếu đã phát cho học sinh (ví dụ Mẫu THPT 2025 hay Mẫu 50 câu truyền thống).',
      'Đảm bảo cả 4 dấu vuông đen ở 4 góc nằm trọn bên trong khung hình Camera hoặc trang PDF/ảnh, không bị kẹp ghim che mất và không bị cắt xén sát mép.',
      'Đặt phiếu trên nền bàn sẫm màu hơn tờ giấy trắng, tránh ánh đèn chiếu thẳng gây lóa bóng trên giấy.',
      'Nếu phiếu bị chụp nghiêng hoặc thiếu góc ở bản scan cũ, hãy mở "Kiểm duyệt bài thi" để chọn lại mẫu phiếu đúng hoặc chỉnh sửa thủ công rồi xác nhận.',
    ],
    relatedSectionIds: ['camera', 'batch', 'templates'],
  },
  {
    id: 'faq-sbd-unreadable',
    question: 'Tại sao ứng dụng không đọc được số báo danh?',
    answerParagraphs: [
      'Trên phiếu trắc nghiệm, mỗi chữ số của Số báo danh (SBD) tương ứng với một cột ô tròn từ 0 đến 9. Hệ thống sẽ trả về dấu "?" tại cột nào học sinh tô quá mờ, bỏ trống, hoặc tô nhầm 2 ô trong cùng một cột dọc.',
      'Một nguyên nhân phổ biến khác là học sinh chỉ viết số bằng chữ ở ô trên đầu mà quên tô kín các ô tròn phía dưới, hoặc dùng mẫu phiếu có số chữ số SBD khác với thiết lập (ví dụ phiếu 6 cột SBD nhưng thí sinh tô lệch cột).',
    ],
    steps: [
      'Mở mục "Kiểm duyệt bài thi", chọn bài đang có SBD chứa dấu "?" (ví dụ "010?25").',
      'Quan sát ảnh bài thi phóng to ở khung giữa để đọc chữ viết tay hoặc ô tô mờ của học sinh.',
      'Gõ lại đúng chuỗi Số báo danh vào ô "Số báo danh" ở cột phải (giữ đầy đủ số 0 ở đầu nếu có, ví dụ "010025").',
      'Nhấn "Chấm lại" hoặc "Xác nhận cuối" để hệ thống tự động đối chiếu lại đúng tên học sinh trong danh sách lớp.',
    ],
    relatedSectionIds: ['review', 'classes'],
  },
  {
    id: 'faq-needs-review',
    question: 'Tại sao bài thi chuyển sang chờ kiểm duyệt?',
    answerParagraphs: [
      'Đây là cơ chế bảo vệ độ chính xác của phần mềm: hệ thống không tự suy đoán hay chấm bừa khi phát hiện tín hiệu không chắc chắn. Mọi bài thi có điểm bất thường đều được gắn trạng thái "Chờ kiểm duyệt" và liệt kê rõ lý do để giáo viên quyết định cuối cùng.',
    ],
    steps: [
      'Số báo danh có chứa dấu "?" hoặc chưa khớp với học sinh nào trong danh sách kỳ kiểm tra.',
      'Mã đề chưa đọc được rõ ràng hoặc chưa nhập đáp án cho mã đề đó trong mục "Đáp án và thang điểm".',
      'Có ít nhất một câu trả lời rơi vào trạng thái: "Tô nhiều" (tô từ 2 đáp án trở lên), "Tô mờ" (mật độ mực nằm giữa ngưỡng trống và ngưỡng chắc chắn), hoặc "Tẩy xóa" (viền ngoài ô còn nhiều vết chì bẩn).',
      'Ảnh chụp bị mờ hoặc không tìm đủ 4/4 điểm định vị góc.',
    ],
    relatedSectionIds: ['review', 'settings'],
  },
  {
    id: 'faq-multi-mark',
    question: 'Học sinh tô nhiều đáp án thì xử lý thế nào?',
    answerParagraphs: [
      'Khi một câu trắc nghiệm có từ 2 ô tròn được tô đậm xấp xỉ nhau (khoảng chênh lệch mật độ mực nhỏ hơn ngưỡng quy định), máy sẽ đánh dấu câu đó là "Tô nhiều" (multi_mark) và đưa bài vào hàng chờ kiểm duyệt thay vì tự chọn bừa một đáp án.',
      'Điều này giúp giáo viên phân biệt hai tình huống thực tế: học sinh cố tình tô 2 đáp án (không được tính điểm câu đó) hoặc học sinh đã tẩy một đáp án nhưng vết chì còn hơi đậm khiến máy nghi ngờ.',
    ],
    steps: [
      'Vào "Kiểm duyệt bài thi" và chọn bài có cảnh báo tô nhiều đáp án.',
      'Phóng to vùng câu bị tô (hệ thống khoanh tròn màu vàng cam quanh các ô nghi ngờ và hiển thị phần trăm mật độ từng ô, ví dụ A:74% B:42% C:4% D:3%).',
      'Nếu học sinh thực sự tô 2 ô không tẩy: giữ nguyên trạng thái "Tô nhiều" (câu này sẽ tính 0 điểm).',
      'Nếu một ô là đáp án chọn còn ô kia chỉ là vết tẩy còn sót: bấm trực tiếp nút chữ cái đúng của học sinh (ví dụ A) rồi bấm "Xác nhận cuối".',
    ],
    relatedSectionIds: ['review', 'settings'],
  },
  {
    id: 'faq-edit-answer-key',
    question: 'Cách sửa đáp án sau khi đã chấm?',
    answerParagraphs: [
      'Trong quá trình coi thi hoặc sau khi chấm xong, nếu phát hiện một câu trong đề có sai sót hoặc cần điều chỉnh đáp án chính thức cho một mã đề, bạn có thể sửa trực tiếp ngay trong mục "Đáp án và thang điểm" mà không cần chụp lại phiếu của học sinh.',
      'Mọi thay đổi đáp án đều được lưu kèm phiên bản và lý do chỉnh sửa để đảm bảo tính minh bạch khi tra soát.',
    ],
    steps: [
      'Vào mục "Đáp án và thang điểm", chọn đúng kỳ kiểm tra và tab mã đề cần sửa (ví dụ "Mã 101").',
      'Bấm chọn lại đáp án đúng ở câu muốn thay đổi hoặc điều chỉnh mức điểm từng phần.',
      'Nhấn nút "Lưu đáp án", sau đó nhập "Lý do chỉnh sửa..." (nếu cần lưu vết lịch sử) và bấm nút "Chấm lại bài".',
      'Hệ thống sẽ tính điểm lại toàn bộ các bài đã nộp thuộc mã đề đó dựa trên dữ liệu nhận dạng gốc đã lưu.',
    ],
    relatedSectionIds: ['answers', 'gradebook'],
  },
  {
    id: 'faq-regrade',
    question: 'Cách chấm lại bài thi?',
    answerParagraphs: [
      'Bạn có thể chấm lại từng bài thi riêng lẻ hoặc chấm lại hàng loạt nhiều bài cùng lúc tùy theo nguyên nhân cần cập nhật (do vừa nhập thêm đáp án, vừa sửa đáp án, hay vừa điều chỉnh ngưỡng OMR trong Cài đặt).',
    ],
    steps: [
      'Chấm lại từng bài kèm kiểm tra ảnh: Mở "Kiểm duyệt bài thi" hoặc mở "Chi tiết" ngay trong "Bảng điểm", kiểm tra/sửa câu trả lời hoặc mã đề rồi bấm "Chấm lại" (hoặc "Lưu & Chấm lại").',
      'Chấm lại hàng loạt nhiều bài trong Bảng điểm: Tích chọn các bài cần tính lại điểm, sau đó bấm nút "Chấm lại" trên thanh thao tác hàng loạt.',
      'Chấm lại khi vừa sửa đáp án: Bấm "Chấm lại bài" ngay tại trang "Đáp án và thang điểm" để cập nhật toàn bộ bài thuộc mã đề đang mở.',
    ],
    relatedSectionIds: ['gradebook', 'review', 'answers'],
  },
  {
    id: 'faq-gradebook-empty',
    question: 'Tại sao bảng điểm chưa có kết quả?',
    answerParagraphs: [
      'Nguyên nhân hay gặp nhất là bạn đang chọn nhầm chế độ dữ liệu ("Dữ liệu thực hành" so với "Dữ liệu của tôi") hoặc đang chọn sai "Kỳ kiểm tra" trên thanh tiêu đề phía trên.',
      'Ngoài ra, nếu các bài thi vừa chấm đều đang ở trạng thái "Chờ kiểm duyệt", cột "Điểm chính thức" sẽ chưa chốt và phần "Thống kê và phân tích" sẽ không lấy điểm dự kiến đó làm số liệu chính thức cho đến khi bạn xác nhận duyệt.',
    ],
    steps: [
      'Kiểm tra nút chuyển ở thanh trên cùng: chọn đúng "Dữ liệu thực hành" (nếu đang thử nghiệm) hoặc "Dữ liệu của tôi" (nếu đang chấm lớp thật).',
      'Kiểm tra lại mục "Kỳ kiểm tra:" ở góc trên bên trái xem có đúng kỳ thi bạn vừa chấm không.',
      'Tại trang "Bảng điểm", bấm nút "Xóa bộ lọc" và đảm bảo bộ lọc trạng thái đang để "Tất cả trạng thái" để thấy cả bài "Chờ kiểm duyệt" lẫn bài "Đã duyệt".',
      'Nếu thấy bài đang ở trạng thái "Chờ kiểm duyệt", hãy bấm vào kiểm duyệt để chốt thành "Đã duyệt" (điểm chính thức).',
    ],
    relatedSectionIds: ['gradebook', 'review', 'analytics'],
  },
  {
    id: 'faq-export-excel-pdf',
    question: 'Cách xuất Excel và PDF?',
    answerParagraphs: [
      'Hầu hết các trang đầu ra của phần mềm đều hỗ trợ xuất tệp Excel (.xlsx chuẩn font Times New Roman), CSV, Word (.docx) hoặc PDF tiếng Việt có dấu hoạt động hoàn toàn ngoại tuyến.',
    ],
    steps: [
      'Xuất Bảng điểm tổng hợp & mẫu vnEdu/SMAS: Vào mục "Bảng điểm", lọc lớp/kỳ thi cần xuất rồi bấm "Xuất Excel (.xlsx)", "CSV", "Xuất PDF" hoặc "In bảng điểm".',
      'Xuất Phiếu trả bài cho từng học sinh hoặc cả lớp: Vào mục "Phiếu trả bài", tùy chỉnh mẫu phiếu ở cột trái rồi bấm "Xuất PDF học sinh này", "PDF cả lớp", "PDF đã chọn" hoặc "Xuất ZIP".',
      'Xuất Báo cáo phân tích đề thi: Vào mục "Thống kê và phân tích", kéo xuống thanh công cụ xuất để chọn "Xuất Word (.docx)", "Xuất Excel (.xlsx)" hoặc "Xuất PDF báo cáo".',
      'Xuất Phiếu thi trống để in phát cho học sinh: Vào mục "Mẫu phiếu thi" và bấm "Tải PDF" hoặc "In phiếu".',
    ],
    relatedSectionIds: ['gradebook', 'report-cards', 'analytics', 'templates'],
  },
  {
    id: 'faq-offline',
    question: 'Cách sử dụng khi không có Internet?',
    answerParagraphs: [
      'Chấm Thi Thông Minh được thiết kế theo chuẩn ứng dụng web ngoại tuyến (PWA) với thư viện nhận dạng ảnh OpenCV.js WebAssembly, bộ đọc/xuất PDF, Excel và font chữ tiếng Việt đều đóng gói cục bộ ngay trong trình duyệt.',
      'Sau lần truy cập đầu tiên khi có mạng để trình duyệt lưu bộ nhớ đệm (hoặc sau khi bấm "Cài đặt App"), bạn có thể ngắt hoàn toàn Wi-Fi / 4G và mang máy tính hoặc điện thoại vào phòng thi để chấm bài bình thường.',
    ],
    steps: [
      'Mở ứng dụng một lần khi có kết nối mạng ổn định cho đến khi thanh thông báo tải OpenCV biến mất và góc trên báo sẵn sàng.',
      'Nhấn nút "Cài đặt App" ở thanh tiêu đề trên máy tính/Android (hoặc nút Chia sẻ -> "Thêm vào MH chính" trên iPhone/iPad Safari) để ghim ứng dụng thành phần mềm độc lập.',
      'Khi mất mạng, góc trên màn hình sẽ hiển thị trạng thái "Ngoại tuyến", nhưng mọi tính năng chấm Camera, chấm PDF/ảnh, kiểm duyệt, xuất Excel/PDF và lưu dữ liệu đều hoạt động bình thường.',
    ],
    relatedSectionIds: ['intro', 'camera', 'backup'],
  },
  {
    id: 'faq-storage',
    question: 'Dữ liệu bài thi được lưu ở đâu?',
    answerParagraphs: [
      'Toàn bộ danh sách kỳ kiểm tra, lớp học, học sinh, mẫu phiếu, đáp án, điểm số, lịch sử chỉnh sửa và ảnh bài thi đều được lưu trực tiếp trên thiết bị của bạn thông qua cơ sở dữ liệu trình duyệt IndexedDB (kho lưu trữ "chamthi_smart_db").',
      'Ứng dụng không gửi dữ liệu học sinh hay ảnh bài thi lên máy chủ bên ngoài mặc định. Nhờ vậy, thông tin học sinh và điểm số được bảo mật tuyệt đối ngay trên máy tính hoặc điện thoại của giáo viên.',
    ],
    steps: [
      'Bạn có thể kiểm tra dung lượng thực tế đang chiếm dụng ngay tại trang "Sao lưu và khôi phục" ở thanh "Dung lượng lưu trữ cục bộ (IndexedDB)".',
      'Lưu ý quan trọng: Nếu bạn xóa dữ liệu duyệt web (Clear Site Data / Cookies & Storage) hoặc dùng chế độ Ẩn danh (Incognito), trình duyệt sẽ xóa kho IndexedDB. Vì vậy hãy định kỳ tải file sao lưu JSON để bảo toàn dữ liệu.',
    ],
    relatedSectionIds: ['backup', 'settings'],
  },
  {
    id: 'faq-transfer-pc',
    question: 'Cách chuyển dữ liệu sang máy tính khác?',
    answerParagraphs: [
      'Vì dữ liệu nằm cục bộ trên từng thiết bị/trình duyệt để bảo mật, khi muốn chuyển sang máy tính khác (ví dụ từ máy ở trường về máy ở nhà, hoặc sang máy của giáo viên bộ môn khác), bạn chỉ cần xuất ra tệp sao lưu .json rồi nhập sang máy mới.',
    ],
    steps: [
      'Trên máy tính cũ: Vào "Sao lưu và khôi phục", bấm "Sao lưu toàn bộ dữ liệu" (hoặc chọn riêng một kỳ thi rồi bấm "Xuất kỳ thi"). Nếu chỉ muốn chuyển dữ liệu dạy học của riêng bạn mà không kèm dữ liệu thực hành mẫu, có thể vào "Cài đặt" -> bấm "Sao lưu dữ liệu của tôi".',
      'Chuyển tệp .json vừa tải về sang máy tính mới qua USB, dây cáp hoặc gửi qua thư/nhắn tin nội bộ.',
      'Trên máy tính mới: Mở "Sao lưu và khôi phục" -> bấm "Chọn tệp sao lưu (.json)" -> chọn chế độ "Gộp thêm vào dữ liệu hiện tại (an toàn)" nếu muốn giữ lại các kỳ thi sẵn có trên máy mới, rồi bấm "Xác nhận khôi phục".',
    ],
    relatedSectionIds: ['backup', 'settings'],
  },
  {
    id: 'faq-delete-practice',
    question: 'Cách xóa dữ liệu thực hành?',
    answerParagraphs: [
      'Ứng dụng tích hợp sẵn bộ dữ liệu thực hành (gồm 3 lớp, 135 học sinh, 5 kỳ kiểm tra và 20 mã đáp án) để thầy cô làm quen ngay lập tức. Bộ dữ liệu này hoàn toàn tách biệt với "Dữ liệu của tôi" nên sẽ không làm lẫn lộn bảng điểm thật.',
      'Khi không còn nhu cầu dùng dữ liệu mẫu hoặc muốn giải phóng dung lượng, bạn có thể xóa sạch bộ dữ liệu thực hành chỉ bằng hai lần bấm xác nhận.',
    ],
    steps: [
      'Mở mục "Cài đặt" trong nhóm "HỆ THỐNG" ở thanh menu bên trái.',
      'Tại khung "Quản lý dữ liệu thực hành và dữ liệu của tôi", bấm nút màu đỏ "Xóa dữ liệu thực hành".',
      'Bấm "Xác nhận xóa" để hoàn tất. Sau khi xóa, dữ liệu thật của bạn vẫn được giữ nguyên vẹn và hệ thống sẽ không tự tạo lại dữ liệu mẫu khi tải lại trang.',
      'Nếu sau này muốn dùng lại để tập huấn hoặc hướng dẫn đồng nghiệp, bạn chỉ cần quay lại trang "Cài đặt" và bấm "Khôi phục bộ dữ liệu thực hành".',
    ],
    relatedSectionIds: ['settings', 'intro'],
  },
  {
    id: 'faq-restore-backup',
    question: 'Cách khôi phục dữ liệu đã sao lưu?',
    answerParagraphs: [
      'Tệp sao lưu có định dạng .json được tạo từ chính Chấm Thi Thông Minh chứa cấu trúc đã được kiểm tra phiên bản, giúp khôi phục lại nguyên trạng từ danh sách học sinh, mẫu phiếu, đáp án cho tới ảnh bài thi và lịch sử chấm.',
    ],
    steps: [
      'Vào mục "Sao lưu và khôi phục" ở nhóm "HỆ THỐNG".',
      'Nhấn nút "Chọn tệp sao lưu (.json)" và tìm đến tệp sao lưu trên máy của bạn.',
      'Xem phần tóm tắt ngày xuất, số kỳ thi, số học sinh, số bài thi hiện ra trong khung xác nhận.',
      'Chọn một trong hai chế độ: "Gộp thêm vào dữ liệu hiện tại (an toàn)" để bổ sung mà không mất dữ liệu đang có, hoặc "Ghi đè toàn bộ dữ liệu hiện tại (không thể hoàn tác)" nếu muốn đưa máy về đúng trạng thái của bản sao lưu.',
      'Nhấn "Xác nhận khôi phục" và đợi hệ thống nạp lại dữ liệu.',
    ],
    relatedSectionIds: ['backup', 'settings'],
  },
];

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'intro',
    number: '01',
    title: 'Giới thiệu ứng dụng',
    shortTitle: 'Giới thiệu ứng dụng',
    category: 'Tổng quan hệ thống',
    targetNavPage: 'overview',
    targetNavLabel: 'Mở trang Tổng quan',
    summary:
      'Làm quen với không gian làm việc, cách tách biệt dữ liệu thực hành – dữ liệu chính thức và nguyên tắc chấm thi bảo mật ngoại tuyến.',
    purpose:
      'CHẤM THI THÔNG MINH là hệ thống chấm bài trắc nghiệm OMR trực tiếp trên trình duyệt, quản lý kỳ kiểm tra, kiểm duyệt kết quả, xuất bảng điểm – phiếu trả bài và phân tích chất lượng đề thi hoàn toàn miễn phí, không phụ thuộc kết nối Internet sau lần mở đầu tiên.',
    whenToUse: [
      'Khi mới mở ứng dụng lần đầu và muốn nắm bắt cấu trúc 5 nhóm chức năng chính.',
      'Khi cần chuyển đổi giữa môi trường thử nghiệm ("Dữ liệu thực hành") và môi trường chấm điểm thật ("Dữ liệu của tôi").',
      'Khi muốn theo dõi nhanh tiến độ chấm, danh sách bài chờ kiểm duyệt và phổ điểm trên trang Tổng quan.',
    ],
    howToOpen: 'Chọn mục "Tổng quan" ở đầu thanh menu bên trái hoặc bấm vào logo "CHẤM THI THÔNG MINH" trên thanh tiêu đề.',
    prerequisites: [
      'Sử dụng trình duyệt hiện đại (Chrome, Edge, Safari, Firefox phiên bản mới).',
      'Đợi vài giây trong lần mở đầu để bộ máy nhận dạng ảnh cục bộ (OpenCV WebAssembly) khởi tạo xong.',
    ],
    steps: [
      {
        title: 'Chọn chế độ dữ liệu làm việc trên thanh tiêu đề',
        detail:
          'Ngay bên cạnh tên ứng dụng có 2 nút chuyển đổi: "Dữ liệu thực hành" (chứa sẵn 5 kỳ thi và 135 học sinh mẫu để trải nghiệm) và "Dữ liệu của tôi" (dành cho các kỳ thi thật của trường/lớp bạn). Hai kho dữ liệu này tách biệt hoàn toàn.',
      },
      {
        title: 'Chọn "Kỳ kiểm tra:" đang làm việc',
        detail:
          'Ô chọn kỳ kiểm tra ở thanh tiêu đề đồng bộ cho toàn bộ các trang Đáp án, Chấm thi, Kiểm duyệt, Bảng điểm, Phiếu trả bài và Thống kê. Đổi kỳ kiểm tra tại đây sẽ cập nhật ngay dữ liệu hiển thị.',
      },
      {
        title: 'Cài đặt App để dùng ngoại tuyến (tùy chọn)',
        detail:
          'Nếu trình duyệt hiển thị nút "Cài đặt App" (hoặc "Cài trên iOS"), hãy cài đặt để mở ứng dụng như một phần mềm độc lập ngay cả khi mang máy vào phòng thi không có Wi-Fi.',
      },
      {
        title: 'Tra cứu tự do theo nhu cầu',
        detail:
          'Bạn không nhất thiết phải thao tác cứng nhắc theo thứ tự 1–2–3. Nếu đã có sẵn ảnh bài thi, có thể vào ngay mục "Chấm PDF và ảnh" sau khi tạo kỳ thi và đáp án; hoặc vào thẳng "Mẫu phiếu thi" để tải phiếu in trước.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Dữ liệu thực hành / Dữ liệu của tôi',
        meaning: 'Chuyển đổi qua lại giữa kho dữ liệu mẫu để tập huấn và kho dữ liệu kỳ thi chính thức của giáo viên.',
      },
      {
        name: 'Kỳ kiểm tra: (danh sách thả xuống)',
        meaning: 'Xác định kỳ thi hiện hành mà các chức năng chấm bài, kiểm duyệt và xuất báo cáo đang xử lý.',
      },
      {
        name: 'Trực tuyến / Ngoại tuyến',
        meaning: 'Báo trạng thái kết nối mạng hiện tại. Ở trạng thái Ngoại tuyến, mọi chức năng chấm thi và xuất tệp vẫn hoạt động bình thường.',
      },
      {
        name: 'Cài đặt App / Toàn màn hình',
        meaning: 'Cài ứng dụng ra màn hình chính (PWA) hoặc mở rộng toàn màn hình để dễ quan sát bảng điểm và ảnh bài thi.',
      },
      {
        name: 'Thanh menu 5 nhóm bên trái',
        meaning: 'Gồm Quản lý, Chuẩn bị chấm thi, Chấm thi, Kết quả và Hệ thống; có thể bấm tiêu đề từng nhóm để thu gọn hoặc mở rộng.',
      },
    ],
    practicalExample: {
      scenario: 'Thầy Minh lần đầu sử dụng phần mềm trước kỳ kiểm tra Giữa kỳ I môn Toán 12.',
      walkthrough: [
        'Mở trang Tổng quan ở chế độ "Dữ liệu thực hành" để xem trước biểu đồ phổ điểm, bảng xếp hạng và thử bấm vào một bài thi mẫu ở mục "Cần kiểm duyệt".',
        'Khi bắt đầu làm thật, thầy bấm chuyển sang "Dữ liệu của tôi" ở thanh trên cùng để không bị lẫn danh sách học sinh mẫu.',
      ],
    },
    expectedResult:
      'Nắm rõ vị trí các chức năng chính, biết cách phân biệt dữ liệu thực hành và dữ liệu thật, sẵn sàng thiết lập kỳ kiểm tra hoặc chấm thử ngay.',
    importantNotes: [
      'Số đỏ hiển thị bên cạnh mục "Kiểm duyệt bài thi" trên menu chính là số bài đang chờ xác nhận trong kỳ kiểm tra hiện hành.',
      'Toàn bộ dữ liệu được lưu trực tiếp trong trình duyệt (IndexedDB) trên thiết bị của bạn, không tự ý tải dữ liệu học sinh lên mạng.',
    ],
    troubleshooting: [
      {
        problem: 'Thấy dữ liệu không phải của lớp mình vừa nhập',
        cause: 'Đang bật chế độ "Dữ liệu thực hành" hoặc đang chọn nhầm kỳ kiểm tra khác ở thanh tiêu đề.',
        solution: 'Chuyển sang tab "Dữ liệu của tôi" và chọn đúng kỳ kiểm tra tại ô thả xuống trên cùng.',
      },
      {
        problem: 'Hiện thông báo vàng đang tải thư viện nhận dạng ảnh',
        cause: 'Lần đầu mở trang hoặc thiết bị vừa xóa bộ nhớ đệm cần vài giây nạp mô-đun OpenCV WebAssembly.',
        solution: 'Chờ 3–5 giây đến khi thanh thông báo tự tắt; nếu gặp lỗi, bấm nút "Thử lại".',
      },
    ],
    illustrationId: 'overview',
    illustrationCaption: 'Hình 1: Sơ đồ tổng thể 4 nhóm chức năng và luồng tách biệt giữa Dữ liệu thực hành và Dữ liệu của tôi.',
    relatedSectionIds: ['exams', 'settings', 'faq'],
    searchKeywords: ['giới thiệu', 'tổng quan', 'dữ liệu thực hành', 'dữ liệu của tôi', 'offline', 'pwa'],
  },
  {
    id: 'exams',
    number: '02',
    title: 'Quản lý kỳ kiểm tra',
    shortTitle: 'Quản lý kỳ kiểm tra',
    category: 'QUẢN LÝ',
    targetNavPage: 'exams',
    targetNavLabel: 'Mở Kỳ kiểm tra',
    summary:
      'Tạo lập, sao chép, lưu trữ và cấu hình kỳ kiểm tra gồm mẫu phiếu sử dụng, thang điểm, ngưỡng đạt, mã đề và danh sách lớp tham gia.',
    purpose:
      'Mỗi kỳ kiểm tra đóng vai trò hồ sơ gốc liên kết chặt chẽ giữa các lớp tham gia, mẫu phiếu phát ra, bộ đáp án theo mã đề, bài chấm OMR và thống kê đầu ra.',
    whenToUse: [
      'Trước khi tổ chức một bài kiểm tra 15 phút, 1 tiết, giữa kỳ, cuối kỳ hoặc thi thử THPT.',
      'Khi muốn nhân bản nhanh cấu hình của kỳ kiểm tra cũ để tạo đợt thi mới mà không phải gõ lại.',
      'Khi kết thúc học kỳ và muốn cất gọn các kỳ thi cũ vào mục lưu trữ.',
    ],
    howToOpen: 'Vào nhóm "QUẢN LÝ" trên thanh menu trái -> chọn "Kỳ kiểm tra".',
    prerequisites: [
      'Xác định trước môn học, thang điểm (thường là 10), ngưỡng đạt (ví dụ 5) và mẫu phiếu sẽ in cho học sinh.',
      'Nếu đang làm thật, kiểm tra thanh tiêu đề đang ở chế độ "Dữ liệu của tôi".',
    ],
    steps: [
      {
        title: 'Mở biểu mẫu tạo kỳ mới',
        detail: 'Nhấn nút màu xanh "Tạo kỳ kiểm tra" ở góc trên bên phải màn hình.',
      },
      {
        title: 'Điền thông tin hành chính và cấu hình chấm',
        detail:
          'Nhập "Tên trường (có thể sửa)", "Tên kỳ kiểm tra *", chọn "Năm học", "Học kỳ", "Môn học" (nếu môn đặc thù chọn "Môn khác..."), "Khối lớp", "Ngày kiểm tra", "Thời gian làm bài (phút)" và "Giáo viên phụ trách".',
      },
      {
        title: 'Gắn mẫu phiếu, thang điểm và mã đề',
        detail:
          'Chọn "Mẫu phiếu sử dụng", nhập "Thang điểm" (mặc định 10) và "Ngưỡng đạt" (mặc định 5), điền "Danh sách mã đề (cách nhau bởi dấu phẩy)" như "101, 102, 103, 104".',
      },
      {
        title: 'Chọn các lớp tham gia và lưu',
        detail:
          'Đánh dấu các lớp có sẵn hoặc gõ tên lớp mới vào ô bên cạnh rồi bấm "Thêm" để gắn vào kỳ kiểm tra. Cuối cùng nhấn "Lưu kỳ kiểm tra".',
      },
      {
        title: 'Chọn kỳ thi làm việc hiện hành',
        detail:
          'Trên thẻ kỳ thi vừa tạo, bấm nút "Chọn làm việc" (thẻ đang hoạt động sẽ hiển thị trạng thái "Đang chọn · Đáp án").',
      },
    ],
    controlsAndFields: [
      {
        name: 'Tạo kỳ kiểm tra',
        meaning: 'Mở khung nhập thông tin kỳ kiểm tra mới.',
      },
      {
        name: 'Hiện kỳ đã lưu trữ',
        meaning: 'Bật/tắt hiển thị các kỳ kiểm tra cũ đã chuyển sang trạng thái lưu trữ để tránh rối danh sách.',
      },
      {
        name: 'Mẫu phiếu sử dụng',
        meaning: 'Quy định loại phiếu trắc nghiệm mặc định khi chấm Camera, chấm PDF/ảnh và nhập đáp án cho kỳ này.',
      },
      {
        name: 'Danh sách mã đề (cách nhau bởi dấu phẩy)',
        meaning: 'Khai báo trước các mã đề của kỳ thi để phần mềm tạo sẵn khung nhập đáp án tương ứng.',
      },
      {
        name: 'Các lớp tham gia / nút Thêm',
        meaning: 'Liên kết học sinh của các lớp được chọn vào bảng điểm, danh sách vắng thi và thống kê so sánh giữa các lớp.',
      },
      {
        name: 'Chọn làm việc / Đang chọn · Đáp án',
        meaning: 'Kích hoạt kỳ thi làm ngữ cảnh hiện tại hoặc mở nhanh sang trang Đáp án và thang điểm.',
      },
      {
        name: 'Sao chép / Lưu trữ / Xóa hẳn',
        meaning: 'Nhân bản nhanh kỳ thi, ẩn kỳ thi cũ không dùng tới, hoặc xóa vĩnh viễn kỳ thi kèm dữ liệu liên quan.',
      },
    ],
    practicalExample: {
      scenario: 'Tạo kỳ "Kiểm tra Giữa kỳ I – Toán 12" cho 3 lớp 12A1, 12A2, 12A3 với 4 mã đề.',
      walkthrough: [
        'Bấm "Tạo kỳ kiểm tra", nhập Tên kỳ kiểm tra: "Kiểm tra Giữa kỳ I – Toán 12", Môn học: "Toán", Khối lớp: "12".',
        'Chọn Mẫu phiếu sử dụng: "Phiếu THPT từ năm 2025 (Chuẩn BGD)", Thang điểm: 10, Ngưỡng đạt: 5.',
        'Điền Danh sách mã đề: "101, 102, 103, 104", tích chọn các lớp 12A1, 12A2, 12A3 rồi bấm "Lưu kỳ kiểm tra".',
      ],
    },
    expectedResult:
      'Thẻ kỳ kiểm tra xuất hiện trong danh sách và tự động hiển thị trong ô "Kỳ kiểm tra:" ở thanh tiêu đề, sẵn sàng cho bước nhập đáp án và chấm bài.',
    importantNotes: [
      'Thay đổi "Mẫu phiếu sử dụng" hoặc "Các lớp tham gia" sau khi đã chấm sẽ ảnh hưởng đến việc đối chiếu học sinh, nên hãy kiểm tra kỹ trước khi phát phiếu.',
      'Thao tác "Lưu trữ" chỉ ẩn kỳ thi cho gọn giao diện chứ không làm mất điểm đã chấm; chỉ nút "Xóa hẳn" mới xóa vĩnh viễn.',
    ],
    troubleshooting: [
      {
        problem: 'Tạo kỳ kiểm tra xong nhưng Bảng điểm không thấy tên lớp nào',
        cause: 'Chưa tích chọn lớp nào trong mục "Các lớp tham gia" hoặc các lớp đó chưa có danh sách học sinh.',
        solution: 'Bấm biểu tượng chỉnh sửa trên thẻ kỳ kiểm tra để tích chọn lớp, sau đó kiểm tra lại danh sách trong mục "Lớp và học sinh".',
      },
      {
        problem: 'Không tìm thấy kỳ kiểm tra cũ từng chấm',
        cause: 'Kỳ kiểm tra đã được chuyển sang trạng thái lưu trữ.',
        solution: 'Tích vào ô "Hiện kỳ đã lưu trữ" ở phía trên danh sách kỳ kiểm tra.',
      },
    ],
    illustrationId: 'exams',
    illustrationCaption: 'Hình 2: Biểu mẫu Tạo kỳ kiểm tra với các trường cấu hình thang điểm, mẫu phiếu, mã đề và lớp tham gia.',
    relatedSectionIds: ['classes', 'answers', 'templates'],
    searchKeywords: ['kỳ kiểm tra', 'tạo kỳ thi', 'mã đề', 'ngưỡng đạt', 'lưu trữ', 'lớp tham gia'],
  },
  {
    id: 'classes',
    number: '03',
    title: 'Lớp và học sinh',
    shortTitle: 'Lớp và học sinh',
    category: 'QUẢN LÝ',
    targetNavPage: 'classes',
    targetNavLabel: 'Mở Lớp và học sinh',
    summary:
      'Quản lý danh sách lớp học, nhập nhanh học sinh từ Excel/CSV, giữ nguyên số 0 ở đầu số báo danh và phát hiện trùng SBD.',
    purpose:
      'Giúp phần mềm tự động gắn đúng Họ tên, Lớp và Mã học sinh ngay khi đọc được Số báo danh (SBD) từ bài thi OMR, đồng thời liệt kê chính xác những em vắng thi.',
    whenToUse: [
      'Đầu năm học khi thiết lập danh sách lớp giảng dạy.',
      'Trước kỳ thi để nhập danh sách SBD theo phòng thi hoặc theo lớp hành chính.',
      'Khi cần kiểm tra xem học sinh nào đã có bài chấm, em nào chưa có bài hoặc cần chuyển lớp cho một nhóm học sinh.',
    ],
    howToOpen: 'Vào nhóm "QUẢN LÝ" trên thanh menu trái -> chọn "Lớp và học sinh".',
    prerequisites: [
      'Nếu nhập hàng loạt, chuẩn bị sẵn tệp Excel (.xlsx) hoặc CSV có cột Số báo danh, Họ và tên, Lớp.',
    ],
    steps: [
      {
        title: 'Tạo lớp học (nếu chưa có)',
        detail: 'Nhấn nút "Tạo lớp" để thêm lớp mới kèm khối lớp và năm học tương ứng.',
      },
      {
        title: 'Tải Excel mẫu hoặc nhập danh sách học sinh',
        detail:
          'Bấm "Tải Excel mẫu" để xem đúng định dạng cột chuẩn, điền danh sách học sinh vào tệp rồi bấm "Nhập Excel / CSV" để đưa toàn bộ lên hệ thống trong một lần.',
      },
      {
        title: 'Thêm hoặc sửa lẻ từng học sinh',
        detail:
          'Nhấn "Thêm học sinh" để nhập thủ công Số báo danh, Mã học sinh, Họ và tên, Lớp, Ngày sinh và bấm "Lưu học sinh".',
      },
      {
        title: 'Kiểm tra cảnh báo trùng SBD và đối chiếu bài thi',
        detail:
          'Nếu có hai học sinh cùng SBD trong hệ thống, thanh cảnh báo màu đỏ sẽ hiện lên để bạn sửa kịp thời. Cột "Đối chiếu bài thi" cho biết em nào "Đã có bài thi" hay "Chưa có bài" trong kỳ thi đang chọn.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Tải Excel mẫu',
        meaning: 'Tải xuống tệp Excel mẫu có sẵn tiêu đề chuẩn giúp nhập dữ liệu không bị lệch cột.',
      },
      {
        name: 'Nhập Excel / CSV',
        meaning: 'Đọc danh sách học sinh từ tệp bảng tính và tự động tạo lớp nếu tên lớp chưa tồn tại.',
      },
      {
        name: 'Xuất danh sách',
        meaning: 'Xuất toàn bộ danh sách học sinh (hoặc lớp đang lọc) ra tệp Excel để lưu trữ hoặc chia sẻ.',
      },
      {
        name: 'Thêm học sinh / Tạo lớp',
        meaning: 'Thêm mới một học sinh hoặc một lớp học trực tiếp trên giao diện web.',
      },
      {
        name: 'Thanh lọc theo lớp (Tất cả / từng lớp)',
        meaning: 'Thu gọn bảng chỉ hiện học sinh thuộc lớp được chọn.',
      },
      {
        name: 'Lớp đích... & Chuyển lớp',
        meaning: 'Tích chọn nhiều học sinh trên bảng rồi chuyển nhanh sang lớp khác chỉ với một lần bấm.',
      },
      {
        name: 'Cột Đối chiếu bài thi',
        meaning: 'So sánh trực tiếp với các bài đã chấm trong kỳ kiểm tra đang kích hoạt ("Đã có bài thi" / "Chưa có bài").',
      },
    ],
    practicalExample: {
      scenario: 'Nhập 45 học sinh lớp 12A1 có SBD từ 010001 đến 010045 từ sổ điểm Excel.',
      walkthrough: [
        'Bấm "Tải Excel mẫu", dán cột Họ tên, Lớp ("12A1") và định dạng cột SBD kiểu Text để giữ số 0 ở đầu ("010001").',
        'Quay lại trang "Lớp và học sinh", bấm "Nhập Excel / CSV" và chọn tệp vừa lưu.',
        'Kiểm tra lại danh sách hiện ra: SBD giữ nguyên "010001", không có thông báo đỏ trùng SBD.',
      ],
    },
    expectedResult:
      'Danh sách lớp và học sinh được lưu bền vững vào IndexedDB. Khi chấm phiếu tô SBD 010001, bảng điểm và phiếu trả bài tự động hiển thị đầy đủ Họ tên và Lớp.',
    importantNotes: [
      'Hệ thống lưu Số báo danh dưới dạng chuỗi ký tự để không bị mất chữ số 0 đứng đầu (ví dụ "00125"). Khi gõ vào Excel, thầy cô cũng nên định dạng cột SBD là Text.',
      'Mỗi học sinh nên có SBD duy nhất; nếu hai em trùng SBD, kết quả chấm sẽ không thể khớp đúng người.',
    ],
    troubleshooting: [
      {
        problem: 'Khi nhập từ Excel bị mất số 0 ở đầu SBD',
        cause: 'Excel tự chuyển giá trị thành kiểu số (Number) trước khi lưu tệp.',
        solution: 'Định dạng cột SBD trong Excel sang kiểu Text hoặc thêm dấu nháy đơn phía trước khi nhập (hoặc dùng nút sửa trực tiếp trên web).',
      },
      {
        problem: 'Bài thi đã chấm xong nhưng bảng điểm chỉ hiện SBD, không hiện Họ tên',
        cause: 'SBD trên phiếu tô khác với SBD trong danh sách học sinh (ví dụ thiếu số 0 đầu hoặc học sinh chưa thuộc danh sách lớp).',
        solution: 'Kiểm tra lại SBD trong "Lớp và học sinh", hoặc sửa SBD bài thi trong "Kiểm duyệt bài thi".',
      },
    ],
    illustrationId: 'classes',
    illustrationCaption: 'Hình 3: Định dạng bảng tính Excel mẫu với cột SBD giữ số 0 ở đầu và trạng thái Đối chiếu bài thi.',
    relatedSectionIds: ['exams', 'review', 'gradebook'],
    searchKeywords: ['lớp', 'học sinh', 'excel', 'csv', 'số báo danh', 'trùng sbd', 'chuyển lớp'],
  },
  {
    id: 'templates',
    number: '04',
    title: 'Mẫu phiếu thi',
    shortTitle: 'Mẫu phiếu thi',
    category: 'CHUẨN BỊ CHẤM THI',
    targetNavPage: 'templates',
    targetNavLabel: 'Mở Mẫu phiếu thi',
    summary:
      'Thư viện các mẫu phiếu trắc nghiệm dựng sẵn (THPT 2025, truyền thống 10–100 câu, ghép đôi A5, rọc phách A3) để xem trước, tải PDF/PNG, in phát cho học sinh và chấm thử.',
    purpose:
      'Cung cấp các mẫu phiếu in đạt chuẩn OMR có sẵn 4 điểm định vị rõ nét, khoảng trắng an toàn và cấu trúc ô tô tối ưu cho máy quét lẫn Camera điện thoại.',
    whenToUse: [
      'Khi cần chọn và in phiếu trả lời trắc nghiệm phát cho học sinh làm bài.',
      'Khi cần tạo nhanh một mẫu phiếu truyền thống theo số câu bất kỳ (ví dụ 25, 40 hoặc 50 câu).',
      'Khi muốn tự in thử một phiếu đã tô sẵn đáp án mẫu để kiểm tra độ chính xác của bộ máy chấm OpenCV.',
    ],
    howToOpen: 'Vào nhóm "CHUẨN BỊ CHẤM THI" trên thanh menu trái -> chọn "Mẫu phiếu thi".',
    prerequisites: [
      'Xác định cấu trúc đề kiểm tra (đề thi THPT mới 3 phần I–II–III hay đề chỉ có câu A/B/C/D truyền thống).',
    ],
    steps: [
      {
        title: 'Lọc nhóm mẫu phiếu phù hợp',
        detail:
          'Chọn các tab phân loại: "Tất cả mẫu", "THPT từ 2025", "Truyền thống (10–100 câu)", "Ghép đôi A5", "Rọc phách A3" hoặc "Mẫu tự thiết kế".',
      },
      {
        title: 'Tạo nhanh mẫu theo số câu tùy chỉnh (nếu cần)',
        detail: 'Nhập số câu vào ô "Số câu tùy chỉnh:" và bấm "Tạo nhanh" để sinh mẫu phiếu truyền thống đúng số câu mong muốn.',
      },
      {
        title: 'Xem thử phiếu trống hoặc phiếu đã tô mẫu',
        detail:
          'Bấm vào mẫu để xem hình ảnh xem trước ở khung bên phải. Bạn có thể chuyển đổi qua lại giữa "Xem thử: Phiếu trống" và "Đang xem: Phiếu đã tô".',
      },
      {
        title: 'Chọn sử dụng và xuất bản in PDF/PNG',
        detail:
          'Bấm "Chọn sử dụng" để gắn vào công việc hiện tại, rồi bấm "Tải PDF", "Tải PNG" hoặc "In phiếu" để in phát cho học sinh. Sau khi in thử bản đầu, có thể bấm "Xác nhận đã đối chiếu bản in" để đánh dấu mẫu tin cậy.',
      },
      {
        title: 'Chấm thử OpenCV ngay (tùy chọn)',
        detail:
          'Bấm "Tạo phiếu đã tô để thử chấm" hoặc "Chấm thử OpenCV ngay" để phần mềm tự chấm thử ảnh phiếu mẫu và xác nhận độ khớp tọa độ.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Các tab nhóm mẫu',
        meaning: 'Lọc nhanh giữa mẫu THPT từ 2025 (3 phần), mẫu truyền thống, phiếu ghép đôi A5 (2 bài/tờ), phiếu rọc phách A3 và mẫu tự thiết kế.',
      },
      {
        name: 'Số câu tùy chỉnh: + Tạo nhanh',
        meaning: 'Sinh ngay một mẫu phiếu truyền thống với đúng số câu giáo viên nhập (từ 10 đến 100 câu).',
      },
      {
        name: 'Mở trình thiết kế phiếu',
        meaning: 'Chuyển sang công cụ Thiết kế phiếu để chỉnh sửa chi tiết bố cục hoặc tải lên phiếu giấy riêng.',
      },
      {
        name: 'Xem thử: Phiếu trống / Đang xem: Phiếu đã tô',
        meaning: 'Chuyển đổi giữa bản trắng dùng để in và bản minh họa có tô sẵn ô SBD/Mã đề/Đáp án.',
      },
      {
        name: 'Tải PDF / Tải PNG / In phiếu',
        meaning: 'Xuất tệp in chuẩn kích thước (A4/A5/A3) giữ nguyên tỉ lệ tọa độ các dấu định vị 4 góc.',
      },
      {
        name: 'Sao chép & sửa',
        meaning: 'Nhân bản mẫu sẵn có thành bản riêng để tùy chỉnh lại thông tin trường hoặc số câu.',
      },
      {
        name: 'Tạo phiếu đã tô để thử chấm / Chấm thử OpenCV ngay',
        meaning: 'Kiểm chứng ngay khả năng nhận diện tọa độ của mẫu phiếu trước khi in hàng loạt.',
      },
    ],
    practicalExample: {
      scenario: 'Chuẩn bị phiếu in cho đề kiểm tra 1 tiết Vật lý gồm 40 câu trắc nghiệm A/B/C/D.',
      walkthrough: [
        'Mở "Mẫu phiếu thi", chọn tab "Truyền thống (10–100 câu)".',
        'Nhập "40" vào ô "Số câu tùy chỉnh:" rồi bấm "Tạo nhanh" (hoặc chọn sẵn mẫu 40 câu).',
        'Bấm "Tải PDF" để lưu tệp A4 chuẩn mang đi photo cho cả lớp.',
      ],
    },
    expectedResult:
      'Có tệp PDF phiếu trắc nghiệm rõ nét, đúng tỉ lệ, đầy đủ 4 điểm định vị ở góc và khung SBD/Mã đề tương thích 100% với bộ máy chấm.',
    importantNotes: [
      'Khi in PDF từ trình duyệt hoặc phần mềm đọc PDF, hãy chọn tỉ lệ in 100% (Actual Size / Không co giãn mất mép) để đảm bảo 4 ô vuông đen định vị ở 4 góc không bị mất khi photo.',
      'Quy tắc tô đúng: Dùng bút chì đen (2B hoặc 3B) hoặc bút bi sẫm màu tô kín tròn đều bên trong vòng, không gạch chéo, không tô lem ra viền và tẩy thật sạch nếu đổi ý.',
    ],
    troubleshooting: [
      {
        problem: 'Photo xong thấy mất dấu vuông đen ở mép dưới hoặc mép phải',
        cause: 'Máy photo/máy in đang để chế độ phóng to hoặc đặt lề không căn giữa.',
        solution: 'In lại bản gốc với tùy chọn "Fit to printable area" hoặc giữ nguyên lề an toàn khi photo hàng loạt.',
      },
    ],
    illustrationId: 'templates',
    illustrationCaption: 'Hình 4: Hướng dẫn quy tắc tô ô hợp lệ, ô tô quá mờ, tô nhiều đáp án, vết tẩy xóa và cách tô Phần III.',
    relatedSectionIds: ['designer', 'exams', 'camera'],
    searchKeywords: ['mẫu phiếu', 'in phiếu', 'tải pdf', 'thpt 2025', 'ghép đôi a5', 'rọc phách', 'tô ô'],
  },
  {
    id: 'designer',
    number: '05',
    title: 'Thiết kế phiếu',
    shortTitle: 'Thiết kế phiếu',
    category: 'CHUẨN BỊ CHẤM THI',
    targetNavPage: 'designer',
    targetNavLabel: 'Mở Thiết kế phiếu',
    summary:
      'Tự tùy biến cấu trúc phiếu thi theo ý muốn hoặc tải lên mẫu phiếu giấy sẵn có (JPG/PNG/PDF) và tự đánh dấu tọa độ 4 góc định vị cùng các vùng tô.',
    purpose:
      'Giúp giáo viên chủ động tạo mẫu phiếu riêng mang tên trường/kỳ thi của mình, hoặc tận dụng mẫu phiếu giấy đang lưu hành ở trường bằng cách ánh xạ vùng nhận dạng.',
    whenToUse: [
      'Khi các mẫu dựng sẵn chưa khớp số câu Phần I, Phần II (Đúng/Sai), Phần III (Trả lời ngắn) hoặc số cột SBD/Mã đề bạn cần.',
      'Khi nhà trường đã in sẵn một mẫu phiếu riêng từ trước và muốn phần mềm đọc được mẫu phiếu đó.',
    ],
    howToOpen: 'Vào nhóm "CHUẨN BỊ CHẤM THI" -> chọn "Thiết kế phiếu", hoặc bấm "Mở trình thiết kế phiếu" từ trang Mẫu phiếu thi.',
    prerequisites: [
      'Nếu dùng chế độ tải mẫu ngoài, cần chuẩn bị sẵn 1 ảnh chụp thẳng rõ nét hoặc tệp PDF trang đầu của mẫu phiếu giấy đó.',
    ],
    steps: [
      {
        title: 'Chọn một trong hai chế độ thiết kế',
        detail:
          'Chọn "Thiết kế tự động" để tùy biến từ thông số có sẵn, hoặc chọn "Đánh dấu mẫu tải lên" nếu muốn nhập phiếu giấy riêng.',
      },
      {
        title: 'Trường hợp 1 – Thiết kế tự động',
        detail:
          'Có thể nạp nhanh khung từ ô "Nạp từ mẫu có sẵn", đặt "Tên mẫu phiếu", chọn "Khổ giấy" (A4/A5/A3), "Hướng giấy", tùy chỉnh số lượng "Ô SBD", "Ô Mã đề", "Ô Phách", "Câu Phần I", "Số cột P.I", "Câu Phần II (Đ/S)", "Câu Phần III (TLN)" và "Kích thước ô tô". Xem bản vẽ cập nhật trực tiếp bên phải.',
      },
      {
        title: 'Trường hợp 2 – Đánh dấu mẫu tải lên',
        detail:
          'Bấm "Tải mẫu ngoài (JPG/PNG/PDF)" để đưa ảnh phiếu lên khung vẽ. Sau đó bấm "Đặt 4 điểm định vị (x/4)" và chấm lần lượt 4 góc chuẩn trên phiếu; tiếp tục bấm "Đặt ô tô" để khoanh vùng SBD, Mã đề và các câu hỏi (có nút "Hoàn tác ô cuối" hoặc "Xóa hết" nếu chấm nhầm).',
      },
      {
        title: 'Lưu và xuất bản in',
        detail:
          'Nhấn "Lưu mẫu phiếu" để lưu vào kho IndexedDB (xuất hiện ngay ở tab Mẫu tự thiết kế), sau đó có thể bấm "Xuất PDF" hoặc "In".',
      },
    ],
    controlsAndFields: [
      {
        name: 'Tải mẫu ngoài (JPG/PNG/PDF)',
        meaning: 'Nạp ảnh hoặc trang PDF mẫu phiếu riêng của trường để tự định vị tọa độ nhận dạng.',
      },
      {
        name: 'Thiết kế tự động / Đánh dấu mẫu tải lên',
        meaning: 'Chuyển đổi giữa trình sinh phiếu tự động theo tham số và trình chấm tọa độ thủ công trên ảnh tải lên.',
      },
      {
        name: 'Nạp từ mẫu có sẵn',
        meaning: 'Lấy cấu trúc một mẫu chuẩn làm nền rồi chỉnh sửa lại số câu hoặc tiêu đề để tiết kiệm thời gian.',
      },
      {
        name: 'Đặt 4 điểm định vị (x/4) & Đặt ô tô',
        meaning: 'Công cụ chấm tọa độ 4 góc định vị và vùng câu hỏi trên phiếu tải lên.',
      },
      {
        name: 'Hoàn tác ô cuối / Xóa hết',
        meaning: 'Xóa bước đánh dấu vừa thao tác sai hoặc làm lại toàn bộ các điểm trên khung vẽ.',
      },
      {
        name: 'Lưu mẫu phiếu / Xuất PDF / In',
        meaning: 'Lưu mẫu vào hệ thống để chọn khi tạo kỳ kiểm tra và xuất tệp in.',
      },
    ],
    practicalExample: {
      scenario: 'Thiết kế mẫu phiếu kiểm tra Toán 10 gồm 12 câu Phần I, 4 câu Đúng/Sai Phần II và 6 câu Trả lời ngắn Phần III mang tên trường.',
      walkthrough: [
        'Mở "Thiết kế phiếu" ở chế độ "Thiết kế tự động", chọn "Nạp từ mẫu có sẵn" để lấy khung THPT 2025.',
        'Đổi "Tên mẫu phiếu" thành "Phiếu Toán 10 – THPT Nguyễn Du", sửa tên trường trên tiêu đề và kiểm tra "Câu Phần I: 12", "Câu Phần II: 4", "Câu Phần III: 6".',
        'Bấm "Lưu mẫu phiếu" rồi bấm "Xuất PDF".',
      ],
    },
    expectedResult:
      'Mẫu phiếu tự thiết kế được lưu thành công trong danh mục mẫu phiếu, sẵn sàng chọn làm mẫu chính thức cho kỳ kiểm tra và chấm OMR.',
    importantNotes: [
      'Khi dùng chế độ "Đánh dấu mẫu tải lên", 4 điểm định vị chấm trên ảnh phải là 4 góc có dấu in rõ ràng trên tờ phiếu giấy để Camera tìm lại đúng vị trí đó lúc chấm thật.',
      'Tránh đặt các câu hỏi quá sát mép trang giấy để không bị cắt mất khi máy in tự động chừa lề.',
    ],
    troubleshooting: [
      {
        problem: 'Không bấm lưu được mẫu tải lên',
        cause: 'Chưa chấm đủ 4/4 điểm định vị góc trên ảnh phiếu.',
        solution: 'Kiểm tra bộ đếm "Đặt 4 điểm định vị (x/4)" và chấm đủ cả 4 góc theo thứ tự trên-trái, trên-phải, dưới-phải, dưới-trái.',
      },
    ],
    relatedSectionIds: ['templates', 'exams', 'answers'],
    searchKeywords: ['thiết kế phiếu', 'tải mẫu ngoài', 'định vị', 'tùy chỉnh', 'phần i', 'phần ii', 'phần iii'],
  },
  {
    id: 'answers',
    number: '06',
    title: 'Đáp án và thang điểm',
    shortTitle: 'Đáp án và thang điểm',
    category: 'CHUẨN BỊ CHẤM THI',
    targetNavPage: 'answers',
    targetNavLabel: 'Mở Đáp án và thang điểm',
    summary:
      'Tạo hàng loạt mã đề, nhập đáp án qua bảng tương tác, dán nhanh, nhập Excel hoặc quét từ phiếu tô sẵn, thiết lập thang điểm THPT 2025 và chấm lại bài.',
    purpose:
      'Lưu giữ bộ đáp án chính xác cho từng mã đề và quy tắc tính điểm của Phần I, Phần II (lũy tiến 0,10 – 0,25 – 0,50 – 1,00 hoặc tùy chỉnh) và Phần III (trả lời ngắn).',
    whenToUse: [
      'Trước khi chấm bài để phần mềm có căn cứ tính điểm tự động ngay khi đưa phiếu vào.',
      'Sau khi chấm nếu phát hiện sai sót trong đáp án một mã đề nào đó và cần cập nhật rồi chấm lại toàn bộ bài.',
    ],
    howToOpen: 'Vào nhóm "CHUẨN BỊ CHẤM THI" trên thanh menu trái -> chọn "Đáp án và thang điểm" (hoặc bấm "Đang chọn · Đáp án" tại trang Kỳ kiểm tra).',
    prerequisites: [
      'Đã có ít nhất một Kỳ kiểm tra đang được chọn làm việc.',
      'Đảm bảo đúng Mẫu phiếu gắn với kỳ kiểm tra để số câu Phần I/II/III khớp với bộ đáp án.',
    ],
    steps: [
      {
        title: 'Kiểm tra mã đề hoặc tạo thêm hàng loạt mã đề',
        detail:
          'Các mã đề của kỳ kiểm tra hiển thị thành các tab như "Mã 101 ✓". Nếu cần thêm nhanh (ví dụ 105, 106, 107), nhập vào ô "Tạo mã đề:" rồi bấm "Tạo nhiều mã".',
      },
      {
        title: 'Cấu hình thang điểm từng phần',
        detail:
          'Thiết lập "Thang điểm chuẩn", điểm mỗi câu Phần I, quy tắc Phần II ("Lũy tiến 2025 (0,10 · 0,25 · 0,50 · 1,00)" hay "Tùy chỉnh theo từng ý đúng"), và tùy chọn Phần III ("Điểm/câu", "Chuẩn hóa dấu phẩy/chấm", "Cho phép sai số", dùng dấu "|" để ngăn cách nhiều đáp án cùng đúng).',
      },
      {
        title: 'Nhập đáp án bằng một trong 4 cách tiện lợi',
        detail:
          'Cách 1: Bấm trực tiếp các nút A/B/C/D, Đ/S hoặc gõ số Phần III trên bảng. Cách 2: Bấm "Dán clipboard / Nhập nhanh" để dán chuỗi đáp án có sẵn (ví dụ 1A 2B 3C...). Cách 3: Bấm "Nhập Excel". Cách 4: Bấm "Quét phiếu tô" để chụp thẳng một phiếu giáo viên đã tô sẵn đáp án chuẩn.',
      },
      {
        title: 'Lưu đáp án và chấm lại (nếu đã có bài nộp)',
        detail:
          'Nhấn "Lưu đáp án". Nếu kỳ thi đã có bài thi chấm trước đó, nhập "Lý do chỉnh sửa..." (nếu có chỉnh sửa) rồi bấm "Chấm lại bài" để cập nhật điểm ngay.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Tạo mã đề: + Tạo nhiều mã',
        meaning: 'Sinh nhanh một hoặc nhiều mã đề cùng lúc (nhập danh sách cách nhau dấu phẩy).',
      },
      {
        name: 'Dán clipboard / Nhập nhanh',
        meaning: 'Dán nhanh bảng đáp án copy từ Word/Excel (hỗ trợ cả dạng ABCD liền nhau hoặc 1.A 2.B...) mà không cần bấm từng câu.',
      },
      {
        name: 'Nhập Excel / Xuất Excel',
        meaning: 'Đưa đáp án nhiều mã đề vào cùng lúc từ bảng tính hoặc xuất bộ đáp án ra Excel để lưu trữ.',
      },
      {
        name: 'Quét phiếu tô',
        meaning: 'Cho phép tải ảnh một phiếu thi đã tô đáp án gốc để máy tự điền đáp án cho mã đề đang mở.',
      },
      {
        name: 'Sao chép từ mã...',
        meaning: 'Chép thang điểm hoặc cấu trúc đáp án từ một mã đề khác sang mã đang chỉnh.',
      },
      {
        name: 'Lũy tiến 2025 (0,10 · 0,25 · 0,50 · 1,00)',
        meaning: 'Áp dụng quy chuẩn tính điểm Phần II Đúng/Sai của Bộ GD&ĐT từ năm 2025 (đúng 1 ý được 0,1; 2 ý được 0,25; 3 ý được 0,5; đủ 4 ý được 1,0 điểm).',
      },
      {
        name: 'Lưu đáp án & Chấm lại bài',
        meaning: 'Lưu đáp án xuống IndexedDB kèm lịch sử phiên bản và kích hoạt chấm lại tất cả bài nộp có mã đề tương ứng.',
      },
    ],
    practicalExample: {
      scenario: 'Nhập đáp án cho mã đề 101 gồm 12 câu Phần I (0,25đ/câu), 4 câu Phần II lũy tiến 2025 và 6 câu Phần III (0,5đ/câu).',
      walkthrough: [
        'Mở "Đáp án và thang điểm", chọn tab "Mã 101".',
        'Bấm "Dán clipboard / Nhập nhanh", dán đáp án Phần I và Phần II, sau đó nhập giá trị số Phần III (ví dụ "-12,5" hoặc "3,14 | 3,15").',
        'Bấm "Lưu đáp án". Tab chuyển thành "Mã 101 ✓".',
      ],
    },
    expectedResult:
      'Mỗi mã đề đều có dấu kiểm màu xanh (✓), lưu đầy đủ lịch sử phiên bản đáp án. Khi chấm bài có mã đề tương ứng, điểm số được tính ngay lập tức.',
    importantNotes: [
      'Với Phần III (Trả lời ngắn), bật "Chuẩn hóa dấu phẩy/chấm" để học sinh tô 1.5 hay 1,5 đều được chấm đúng như nhau.',
      'Nếu một câu Phần III chấp nhận nhiều cách viết (ví dụ "0,5 | 0.50 | 1/2" hoặc sai số làm tròn), hãy tách bằng dấu "|" hoặc điền ô "Cho phép sai số".',
    ],
    troubleshooting: [
      {
        problem: 'Bài thi đã chấm xong nhưng báo lý do "Chưa có đáp án mã đề..."',
        cause: 'Mã đề trên bài thi (ví dụ 104) chưa được nhập và lưu trong trang Đáp án và thang điểm, hoặc học sinh tô nhầm sang mã khác.',
        solution: 'Kiểm tra lại mã đề trên bài thi tại Kiểm duyệt bài thi, hoặc tạo và lưu đáp án cho mã đề 104 rồi bấm "Chấm lại bài".',
      },
    ],
    illustrationId: 'answers',
    illustrationCaption: 'Hình 5: Khu vực nhập đáp án theo mã đề, thang điểm lũy tiến Phần II và chuẩn hóa Phần III.',
    relatedSectionIds: ['exams', 'review', 'gradebook'],
    searchKeywords: ['đáp án', 'thang điểm', 'mã đề', 'lũy tiến 2025', 'dán nhanh', 'chấm lại', 'phần iii'],
  },
  {
    id: 'camera',
    number: '07',
    title: 'Chấm bằng Camera',
    shortTitle: 'Chấm bằng Camera',
    category: 'CHẤM THI',
    targetNavPage: 'camera',
    targetNavLabel: 'Mở Chấm bằng Camera',
    summary:
      'Chấm bài trực tiếp qua Webcam hoặc Camera điện thoại: tự động nhận diện 4 điểm định vị, đo độ nghiêng/độ nét và tự chụp khi giữ ổn định.',
    purpose:
      'Biến điện thoại, máy tính bảng hoặc laptop có webcam thành máy chấm trắc nghiệm tốc độ cao ngay tại bàn làm việc mà không cần máy scan.',
    whenToUse: [
      'Khi muốn chấm trực tiếp từng tờ bài thi vừa thu xong tại lớp hoặc ở nhà.',
      'Khi sử dụng điện thoại gắn trên giá đỡ cố định để lướt từng tập bài của học sinh.',
    ],
    howToOpen: 'Vào nhóm "CHẤM THI" trên thanh menu trái -> chọn "Chấm bằng Camera".',
    prerequisites: [
      'Kỳ kiểm tra đang chọn đã có đáp án (hoặc sẵn sàng chấm lưu ảnh trước).',
      'Trình duyệt đã được cấp quyền Camera (HTTPS hoặc localhost) và không bị ứng dụng khác chiếm camera.',
      'Chọn đúng mẫu phiếu ở thanh công cụ phía trên trước khi soi bài.',
    ],
    steps: [
      {
        title: 'Khởi động Camera và căn ánh sáng',
        detail:
          'Bấm nút "Bật Camera" (hoặc "Mở Camera ngay"). Đặt phiếu thi phẳng trên mặt bàn có nền sẫm hơn giấy, tránh ánh đèn chiếu xiên gây lóa.',
      },
      {
        title: 'Canh đủ 4 dấu góc xanh lá',
        detail:
          'Đưa toàn bộ tờ phiếu vào giữa khung hình sao cho 4 dấu vuông đen ở 4 góc phiếu hiện vòng khung định vị màu xanh lá và thanh chỉ báo hiện "Định vị: 4/4" cùng độ nghiêng nhỏ.',
      },
      {
        title: 'Chụp tự động hoặc chụp thủ công',
        detail:
          'Khi đánh dấu ô "Tự động chụp", chỉ cần giữ yên phiếu trong vài tích tắc là hệ thống tự chụp và phát tiếng bíp xác nhận. Nếu muốn chủ động hoàn toàn, bỏ tích Tự động chụp và bấm "Chụp & chấm ngay".',
      },
      {
        title: 'Xem kết quả tức thì và chuyển sang tờ tiếp theo',
        detail:
          'Khung bên phải lập tức hiển thị ảnh đã cắt phẳng kèm SBD, Mã đề, tổng điểm, trạng thái ("Đã duyệt" hoặc "Chờ kiểm duyệt"). Nếu thấy chưa chuẩn, bấm "Chấm lại" hoặc "Mở kiểm duyệt" để rà soát ngay.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Bật Camera / Tạm dừng / Tiếp tục / Tắt Camera',
        meaning: 'Điều khiển luồng hình ảnh từ thiết bị camera mà không làm mất danh sách các bài đã chấm trong phiên.',
      },
      {
        name: 'Đổi Camera / Đèn Flash / Lấy nét / Toàn màn hình',
        meaning: 'Chuyển đổi giữa camera trước/sau, bật đèn trợ sáng (nếu thiết bị hỗ trợ), ép lấy nét lại và mở rộng khung soi.',
      },
      {
        name: 'Tự động chụp (checkbox)',
        meaning: 'Tự kích hoạt chụp và chấm ngay khi hệ thống khóa đủ 4/4 điểm định vị và độ nét ổn định qua nhiều khung hình liên tiếp.',
      },
      {
        name: 'Chụp & chấm ngay',
        meaning: 'Chụp thủ công khung hình hiện tại và đưa vào bộ máy OMR xử lý ngay lập tức.',
      },
      {
        name: 'Chỉ báo Định vị: X/4 & Nghiêng: X°',
        meaning: 'Cho biết thời gian thực camera đã bắt được bao nhiêu góc phiếu và góc lệch hiện tại.',
      },
      {
        name: 'Chấm lại / Mở kiểm duyệt',
        meaning: 'Chấm lại tờ vừa chụp hoặc chuyển thẳng tờ này sang màn hình Kiểm duyệt bài thi.',
      },
    ],
    practicalExample: {
      scenario: 'Dùng điện thoại gắn giá kẹp bàn để chấm liên tục 40 bài thi lớp 12A1.',
      walkthrough: [
        'Mở "Chấm bằng Camera", bấm "Bật Camera", chọn Camera sau và bật "Toàn màn hình".',
        'Tích chọn "Tự động chụp", đặt xấp bài thi vào đúng vùng căn lề trên bàn.',
        'Cứ mỗi lần nghe tiếng bíp xác nhận chấm xong một tờ, rút tờ trên cùng ra để lộ tờ tiếp theo (hệ thống tự chặn trùng cùng một SBD trong vòng 4,5 giây tránh chụp đúp).',
      ],
    },
    expectedResult:
      'Mỗi tờ bài thi được chụp phẳng, đọc SBD, mã đề, chấm điểm và lưu ảnh gốc + ảnh đã xử lý vào IndexedDB trong tích tắc.',
    importantNotes: [
      'Hệ thống có cơ chế chống chụp trùng liên tiếp cùng một Số báo danh trong 4,5 giây khi bật "Tự động chụp"; nếu muốn chấm lại chính tờ đó ngay, bấm "Chấm lại" hoặc rút phiếu ra khỏi khung hình rồi đưa lại.',
      'Đặt tờ phiếu trên nền bàn tối/xám nhẹ giúp máy phân biệt ranh giới mép giấy trắng tốt hơn nhiều so với đặt trên nền trắng.',
    ],
    troubleshooting: [
      {
        problem: 'Bật Camera báo lỗi hoặc màn hình đen',
        cause: 'Chưa cấp quyền Camera trên trình duyệt hoặc phần mềm khác đang dùng Webcam.',
        solution: 'Mở quyền Camera tại biểu tượng ổ khóa trên thanh địa chỉ trình duyệt, tắt ứng dụng gọi video khác rồi bấm "Bật Camera" lại.',
      },
      {
        problem: 'Định vị chỉ hiện 2/4 hoặc 3/4, không tự chụp',
        cause: 'Góc phiếu bị tay cầm che mất, mặt giấy bị quăn gập hoặc bóng đèn rọi làm chói góc.',
        solution: 'Vuốt phẳng 4 góc tờ phiếu, di chuyển camera ra xa một chút để chừa lề trắng quanh 4 góc định vị.',
      },
    ],
    illustrationId: 'camera',
    illustrationCaption: 'Hình 6: Khung hình Chấm bằng Camera khi khóa đủ 4/4 điểm định vị góc xanh lá và sẵn sàng tự động chụp.',
    relatedSectionIds: ['batch', 'review', 'settings'],
    searchKeywords: ['camera', 'webcam', 'tự động chụp', 'định vị', '4 góc', 'flash', 'lấy nét'],
  },
  {
    id: 'batch',
    number: '08',
    title: 'Chấm PDF và ảnh',
    shortTitle: 'Chấm PDF và ảnh',
    category: 'CHẤM THI',
    targetNavPage: 'batch',
    targetNavLabel: 'Mở Chấm PDF và ảnh',
    summary:
      'Tải lên hàng loạt tệp ảnh (JPG, PNG, WEBP) hoặc tệp PDF nhiều trang từ máy scan để phần mềm tự tách từng trang và chấm nối tiếp hoàn toàn ngoại tuyến.',
    purpose:
      'Phục vụ chấm nhanh hàng chục đến hàng trăm bài thi cùng lúc sau khi giáo viên quét cả tập bài thành một tệp PDF hoặc chụp sẵn một thư mục ảnh.',
    whenToUse: [
      'Khi nhà trường hoặc tổ bộ môn có máy scan tốc độ cao xuất ra tệp PDF nhiều trang.',
      'Khi bạn chụp sẵn toàn bộ xấp bài thi bằng điện thoại rồi tải cả lô ảnh vào máy tính để chấm một lượt.',
      'Khi muốn thử nghiệm ngay bộ máy OpenCV OMR trên bộ 225 phiếu thực hành tích hợp sẵn.',
    ],
    howToOpen: 'Vào nhóm "CHẤM THI" trên thanh menu trái -> chọn "Chấm PDF và ảnh".',
    prerequisites: [
      'Chọn đúng "Kỳ kiểm tra:" đang làm việc và chọn đúng mẫu phiếu áp dụng trên giao diện.',
      'Các trang PDF/ảnh cần chụp rõ trọn vẹn 4 dấu vuông định vị ở 4 góc.',
    ],
    steps: [
      {
        title: 'Đưa tệp PDF hoặc nhiều ảnh vào hàng đợi',
        detail:
          'Kéo thả hoặc bấm vào vùng tải tệp (hỗ trợ .pdf, .jpg, .jpeg, .png, .webp). Nếu tải PDF nhiều trang, phần mềm tự động tách từng trang thành từng mục trong danh sách.',
      },
      {
        title: 'Kiểm tra mẫu phiếu và bắt đầu chấm',
        detail:
          'Xác nhận lại mẫu phiếu ở ô chọn phía trên, sau đó bấm nút "Bắt đầu chấm (N)".',
      },
      {
        title: 'Theo dõi tiến trình xử lý theo thời gian thực',
        detail:
          'Thanh tiến trình cập nhật từng bài: bài rõ nét khớp đáp án sẽ nhận trạng thái "Đã duyệt"; bài có vấn đề (tô mờ, tô nhiều, sai mã đề, thiếu định vị...) chuyển sang "Chờ kiểm duyệt" kèm lý do.',
      },
      {
        title: 'Tạm dừng, thử lại trang lỗi hoặc mở kiểm duyệt',
        detail:
          'Có thể bấm "Tạm dừng" / "Tiếp tục", "Hủy hàng đợi", hoặc sau khi chạy xong bấm "Thử lại X trang lỗi" nếu vừa chọn nhầm mẫu phiếu ở trang nào đó.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Vùng tải tệp (.pdf, .jpg, .png, .webp)',
        meaning: 'Cho phép chọn cùng lúc nhiều ảnh hoặc nhiều tệp PDF nhiều trang.',
      },
      {
        name: 'Chọn mẫu phiếu áp dụng',
        meaning: 'Quy định cấu trúc tọa độ ô tô được sử dụng cho toàn bộ hàng đợi sắp chấm.',
      },
      {
        name: 'Bắt đầu chấm (N) / Tạm dừng / Hủy hàng đợi',
        meaning: 'Khởi chạy, tạm ngưng giữa chừng hoặc hủy phần việc còn lại trong hàng đợi.',
      },
      {
        name: 'Thử lại X trang lỗi / Xóa danh sách',
        meaning: 'Chạy lại riêng những trang gặp lỗi định vị hoặc dọn sạch hàng đợi hiện tại cho đợt mới.',
      },
      {
        name: 'Tải bộ phiếu thực hành / Chấm thử (N phiếu)',
        meaning: 'Nạp bộ phiếu thực hành có sẵn của hệ thống để trải nghiệm trực tiếp tốc độ và độ chính xác của thuật toán OMR.',
      },
    ],
    practicalExample: {
      scenario: 'Scan 45 bài thi lớp 12A1 thành một tệp "12A1_Toan_GK1.pdf" rồi chấm tự động.',
      walkthrough: [
        'Mở "Chấm PDF và ảnh", kéo tệp "12A1_Toan_GK1.pdf" vào khung tải tệp.',
        'Đợi vài giây để hệ thống tách thành 45 trang trong danh sách, kiểm tra mẫu phiếu đúng là "Phiếu THPT từ năm 2025".',
        'Bấm "Bắt đầu chấm (45)" -> sau khoảng nửa phút có 42 bài "Đã duyệt" và 3 bài "Chờ kiểm duyệt" để rà soát tiếp.',
      ],
    },
    expectedResult:
      'Toàn bộ các trang PDF và ảnh được chấm xong, lưu ảnh gốc và kết quả từng câu vào IndexedDB, đồng thời cập nhật ngay sang Kiểm duyệt bài thi và Bảng điểm.',
    importantNotes: [
      'Nếu máy scan xuất ra trang xoay ngang 90° hoặc bị lộn ngược 180°, thuật toán vẫn tự nhận dạng hướng của 4 góc định vị để xoay thẳng lại đúng chiều.',
      'Không đóng tab trình duyệt khi tiến trình đang chạy dở danh sách hàng trăm trang.',
    ],
    troubleshooting: [
      {
        problem: 'Tất cả các trang trong tệp PDF đều báo lỗi không tìm thấy điểm định vị',
        cause: 'Chọn nhầm mẫu phiếu, hoặc khi scan đặt chế độ thu nhỏ quá mức khiến mật độ điểm ảnh quá thấp.',
        solution: 'Chọn đúng mẫu phiếu tương ứng với tờ giấy thi; khi scan nên đặt độ phân giải tối thiểu 150–200 DPI (cỡ A4 nét rõ).',
      },
    ],
    illustrationId: 'batch',
    illustrationCaption: 'Hình 7: Giao diện hàng đợi Chấm PDF và ảnh tách trang tự động và phân loại kết quả Đã duyệt / Chờ kiểm duyệt.',
    relatedSectionIds: ['camera', 'review', 'scanner'],
    searchKeywords: ['pdf', 'ảnh', 'hàng loạt', 'scan', 'hàng đợi', '225 phiếu'],
  },
  {
    id: 'scanner',
    number: '09',
    title: 'Scan tài liệu',
    shortTitle: 'Scan tài liệu',
    category: 'CHẤM THI',
    targetNavPage: 'scanner',
    targetNavLabel: 'Mở Scan tài liệu',
    summary:
      'Công cụ phụ trợ chụp hoặc chọn ảnh đề thi, biên bản, phiếu bài bị nghiêng/tối để cắt phẳng 4 góc, khử bóng đèn, tăng nét giữ nét chì mờ và ghép xuất thành PDF nhiều trang.',
    purpose:
      'Chuẩn hóa ảnh tài liệu giấy hoặc những tờ phiếu thi chụp trong điều kiện ánh sáng không đều thành trang văn bản sạch, phẳng, dễ đọc và gọn nhẹ trước khi lưu trữ hay đưa đi chấm.',
    whenToUse: [
      'Khi bạn cần số hóa đề thi gốc, đáp án viết tay, biên bản coi thi hoặc giấy kiểm tra thành tệp PDF nhiều trang sắc nét.',
      'Khi ảnh chụp tờ phiếu bị bàn cong, bóng râm che ngang và bạn muốn chỉnh lại 4 góc cùng bộ lọc khử bóng trước khi xuất PDF.',
    ],
    howToOpen: 'Vào nhóm "CHẤM THI" trên thanh menu trái -> chọn "Scan tài liệu".',
    prerequisites: [
      'Chuẩn bị ảnh chụp sẵn trên máy hoặc sử dụng Camera thiết bị để chụp trực tiếp.',
    ],
    steps: [
      {
        title: 'Nạp ảnh tài liệu',
        detail:
          'Bấm "Chụp tài liệu" để dùng Camera hoặc "Chọn ảnh có sẵn" để mở ảnh từ máy tính/điện thoại.',
      },
      {
        title: 'Cắt phẳng 4 góc và xoay đúng chiều',
        detail:
          'Dùng chuột/ngón tay kéo "Chỉnh lại 4 góc" khớp vào 4 mép tờ giấy, bấm "Xoay (0°/90°/180°/270°)" nếu ảnh bị ngang/ngược rồi bấm "Cắt & làm nét".',
      },
      {
        title: 'Chọn bộ lọc màu và khử bóng',
        detail:
          'Tùy chọn "Chế độ màu" ("Màu", "Xám" hoặc "Đen trắng"), bật "Khử bóng & làm trắng nền (giữ nét chì mờ)", điều chỉnh "Giảm nhiễu hạt" và thanh "Độ tương phản". Bấm "So sánh ảnh gốc" / "Xem ảnh đã xử lý" để kiểm tra.',
      },
      {
        title: 'Ghép nhiều trang và xuất PDF',
        detail:
          'Nhấn "Thêm vào tệp PDF nhiều trang" cho từng trang đã chỉnh xong, sau đó bấm "Xuất PDF (N trang)" để tải trọn bộ về máy.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Chụp tài liệu / Chọn ảnh có sẵn',
        meaning: 'Mở camera chụp mới hoặc chọn ảnh có sẵn từ thư viện máy.',
      },
      {
        name: 'Chỉnh lại 4 góc & Cắt & làm nét',
        meaning: 'Biến đổi phối cảnh cắt bỏ phần mặt bàn xung quanh và kéo thẳng tờ giấy về khung chữ nhật chuẩn.',
      },
      {
        name: 'Chế độ màu (Màu / Xám / Đen trắng)',
        meaning: 'Tùy chọn tông màu đầu ra phù hợp tài liệu văn bản, ảnh màu hay phiếu OMR.',
      },
      {
        name: 'Khử bóng & làm trắng nền (giữ nét chì mờ)',
        meaning: 'Cân bằng sáng cục bộ để xóa vệt bóng bàn tay hay ánh đèn mà không làm mất nét chữ/nét chì nhạt.',
      },
      {
        name: 'So sánh ảnh gốc / Xem ảnh đã xử lý',
        meaning: 'Chuyển nhanh để đối chiếu trước và sau khi áp dụng bộ lọc.',
      },
      {
        name: 'Thêm vào tệp PDF nhiều trang & Xuất PDF',
        meaning: 'Gom nhiều trang đã làm sạch vào chung một tệp PDF duy nhất để lưu trữ hoặc đưa sang mục Chấm PDF và ảnh.',
      },
    ],
    practicalExample: {
      scenario: 'Chụp 4 trang đề kiểm tra in giấy bị tối góc thành 1 tệp PDF trắng sạch để phát lên nhóm lớp.',
      walkthrough: [
        'Mở "Scan tài liệu", lần lượt chọn từng ảnh, kéo 4 điểm góc khớp mép trang giấy.',
        'Chọn chế độ "Đen trắng" kèm "Khử bóng & làm trắng nền (giữ nét chì mờ)", bấm "Cắt & làm nét" rồi "Thêm vào tệp PDF nhiều trang".',
        'Khi đủ 4 trang, bấm "Xuất PDF (4 trang)".',
      ],
    },
    expectedResult:
      'Nhận được tệp PDF gồm nhiều trang phẳng, nền trắng sạch, chữ rõ nét sẵn sàng lưu hồ sơ hoặc đưa qua bước chấm hàng loạt.',
    importantNotes: [
      'Khi xuất PDF dùng lại cho mục "Chấm PDF và ảnh", hãy giữ nguyên khoảng lề bao gồm cả 4 dấu vuông đen định vị của phiếu khi kéo 4 góc cắt.',
    ],
    troubleshooting: [
      {
        problem: 'Chữ mảnh hoặc nét chì bị đứt sau khi chọn chế độ Đen trắng',
        cause: 'Mức Độ tương phản đang kéo quá cao hoặc trang gốc chụp thiếu sáng.',
        solution: 'Chuyển sang chế độ "Xám" hoặc giảm nhẹ "Độ tương phản" và bật "Khử bóng & làm trắng nền (giữ nét chì mờ)".',
      },
    ],
    relatedSectionIds: ['batch', 'camera'],
    searchKeywords: ['scan', 'cắt 4 góc', 'khử bóng', 'làm nét', 'xuất pdf nhiều trang'],
  },
  {
    id: 'review',
    number: '10',
    title: 'Kiểm duyệt bài thi',
    shortTitle: 'Kiểm duyệt bài thi',
    category: 'CHẤM THI',
    targetNavPage: 'review',
    targetNavLabel: 'Mở Kiểm duyệt bài thi',
    summary:
      'Rà soát trực quan từng bài thi có cảnh báo (tô mờ, tô nhiều, tẩy xóa, sai SBD, thiếu mã đề): phóng to kéo xem ảnh gốc/ảnh hiệu chỉnh, đọc mật độ phần trăm từng ô tô và xác nhận kết quả chính thức.',
    purpose:
      'Đảm bảo mọi trường hợp nhập nhằng đều được chính giáo viên đối chiếu trực tiếp trên ảnh chụp thật trước khi chốt điểm chính thức vào Bảng điểm và Thống kê.',
    whenToUse: [
      'Khi mục "Kiểm duyệt bài thi" trên menu hiển thị số lượng bài chờ xử lý màu đỏ.',
      'Khi học sinh có thắc mắc phúc khảo hoặc bạn muốn kiểm tra lại chi tiết từng câu của một bài bất kỳ (chuyển sang tab "Tất cả bài thi").',
    ],
    howToOpen: 'Vào nhóm "CHẤM THI" trên thanh menu trái -> chọn "Kiểm duyệt bài thi", hoặc bấm vào một bài chờ duyệt ở Trang chủ / Bảng điểm.',
    prerequisites: [
      'Đã chấm ít nhất một bài thi qua Camera hoặc PDF/Ảnh.',
    ],
    steps: [
      {
        title: 'Chọn bài trong danh sách chờ bên trái',
        detail:
          'Mặc định hiển thị tab "Cần kiểm duyệt". Bấm vào từng bài để xem ngay lý do cảnh báo ở hộp màu vàng phía trên cột phải (ví dụ: "SBD chưa rõ", "Còn 2 câu chưa xác nhận").',
      },
      {
        title: 'Phóng to và kiểm tra ảnh bài thi ở khung giữa',
        detail:
          'Dùng nút phóng to/thu nhỏ (+/-) và kéo rê chuột để soi sát vùng câu bị đánh dấu vòng tròn màu vàng cam. Có thể chuyển qua lại giữa "Ảnh đã hiệu chỉnh + đánh dấu" và "Ảnh gốc".',
      },
      {
        title: 'Đọc mật độ tô từng ô và chỉnh sửa câu nghi ngờ',
        detail:
          'Ở cột bên phải, mỗi câu đều hiển thị tỷ lệ mật độ mực (ví dụ "Mật độ ô: A:68% B:11% C:4% D:3%"). Nếu xác định đúng đáp án học sinh tô, bấm chọn nút A/B/C/D (hoặc Đ/S, Trống, Tô nhiều, gõ số Phần III).',
      },
      {
        title: 'Chỉnh SBD, Mã đề hoặc đổi Mẫu phiếu (nếu sai)',
        detail:
          'Sửa trực tiếp vào ô "Số báo danh", "Mã đề" hoặc chọn lại "Mẫu phiếu áp dụng" nếu lúc chấm chọn nhầm mẫu.',
      },
      {
        title: 'Ghi lý do (tùy chọn) và xác nhận',
        detail:
          'Có thể nhập "Lý do điều chỉnh (tùy chọn)...", sau đó bấm "Chấm lại" để xem điểm mới tạm thời hoặc bấm nút xanh "Xác nhận cuối" để duyệt chính thức bài thi.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Cần kiểm duyệt / Tất cả bài thi',
        meaning: 'Lọc chỉ các bài đang chờ xác nhận hoặc xem toàn bộ các bài đã chấm trong kỳ thi.',
      },
      {
        name: 'Ảnh đã hiệu chỉnh + đánh dấu / Ảnh gốc',
        meaning: 'Chuyển giữa ảnh đã cắt phẳng kèm vòng tròn khoanh (Xanh = Đúng, Đỏ = Sai, Vàng cam = Nghi ngờ) và ảnh chụp gốc ban đầu chưa can thiệp.',
      },
      {
        name: 'Nút Zoom (+/-) và kéo thả ảnh',
        meaning: 'Phóng to từ 50% đến 300% để quan sát rõ vết bút chì hoặc vết tẩy trên giấy.',
      },
      {
        name: 'Mật độ ô: A:% B:% C:% D:%',
        meaning: 'Hiển thị phần trăm độ đậm bên trong mỗi ô tròn giúp giáo viên đánh giá khách quan ngay cả khi ánh sáng hơi tối.',
      },
      {
        name: 'Chấm lại / Xác nhận cuối',
        meaning: '"Chấm lại" cập nhật điểm và giữ nguyên trạng thái nếu còn cảnh báo; "Xác nhận cuối" chốt bài sang trạng thái Đã duyệt chính thức khi mọi thông tin đã hợp lệ.',
      },
      {
        name: 'Lịch sử kiểm duyệt',
        meaning: 'Tự động lưu thời gian, giá trị cũ -> mới và lý do mỗi lần giáo viên chỉnh sửa.',
      },
    ],
    practicalExample: {
      scenario: 'Kiểm duyệt bài thi SBD "010012" bị cảnh báo câu 7 Phần I có dấu hiệu tô mờ.',
      walkthrough: [
        'Bấm vào bài trong cột "Cần kiểm duyệt", phóng to khung ảnh giữa tới 175% và kéo tới vùng câu 7.',
        'Thấy học sinh tô chì nhạt ở ô C (Mật độ ô: A:4% B:5% C:28% D:4%), các ô khác hoàn toàn sạch.',
        'Bấm chọn nút "C" ở dòng P.I Câu 7, nhập lý do "Xác nhận câu 7 tô C hơi nhạt", rồi bấm "Xác nhận cuối".',
      ],
    },
    expectedResult:
      'Bài thi chuyển từ "Chờ kiểm duyệt" sang "Đã duyệt", tổng điểm trở thành điểm chính thức trong Bảng điểm, Phiếu trả bài và Thống kê, đồng thời giảm số đếm chờ duyệt trên menu.',
    importantNotes: [
      'Ảnh chụp gốc ban đầu luôn được bảo toàn nguyên vẹn trong IndexedDB để đối chiếu khi cần phúc khảo.',
      'Nếu bấm "Xác nhận cuối" nhưng bài vẫn còn SBD chứa dấu "?", chưa có đáp án mã đề hoặc còn câu chưa xác nhận, hệ thống vẫn giữ trạng thái chờ kiểm duyệt và thông báo lý do còn thiếu.',
    ],
    troubleshooting: [
      {
        problem: 'Bấm "Xác nhận cuối" mà bài vẫn báo chưa chuyển sang Đã duyệt',
        cause: 'Vẫn còn câu khác trong bài ở trạng thái "Tô mờ", "Tẩy xóa" hoặc "Số báo danh" đang chứa dấu "?" hay mã đề chưa có đáp án.',
        solution: 'Đọc hộp vàng "Vấn đề cần kiểm tra:" ở đầu cột phải và cuộn xuống tìm các câu được tô nền vàng để xác nhận hết.',
      },
    ],
    illustrationId: 'review',
    illustrationCaption: 'Hình 8: Giao diện Kiểm duyệt bài thi 3 cột: danh sách chờ, ảnh phóng to khoanh vùng và mật độ phần trăm từng ô.',
    relatedSectionIds: ['gradebook', 'camera', 'batch'],
    searchKeywords: ['kiểm duyệt', 'tô mờ', 'tô nhiều', 'tẩy xóa', 'mật độ ô', 'xác nhận cuối', 'lịch sử'],
  },
  {
    id: 'gradebook',
    number: '11',
    title: 'Bảng điểm',
    shortTitle: 'Bảng điểm',
    category: 'KẾT QUẢ',
    targetNavPage: 'gradebook',
    targetNavLabel: 'Mở Bảng điểm',
    summary:
      'Tra cứu toàn bộ điểm thi theo từng lớp/mã đề/trạng thái, phân biệt rõ điểm chính thức và điểm dự kiến chờ duyệt, đánh dấu vắng thi, xem chi tiết bài làm và xuất Excel/CSV/PDF.',
    purpose:
      'Là trung tâm tổng hợp kết quả toàn kỳ kiểm tra: kết nối danh sách học sinh với bài thi đã chấm, hiển thị minh bạch mọi trạng thái và xuất bảng điểm chuẩn hành chính hoặc mẫu vnEdu/SMAS.',
    whenToUse: [
      'Ngay sau khi chấm và kiểm duyệt để rà soát toàn lớp.',
      'Khi cần lọc học sinh theo khoảng điểm, theo lớp, tìm học sinh vắng thi hoặc thiếu bài.',
      'Khi cần xuất bảng điểm Excel 6 trang tính, CSV hoặc PDF nộp cho nhà trường/tổ chuyên môn.',
    ],
    howToOpen: 'Vào nhóm "KẾT QUẢ" trên thanh menu trái -> chọn "Bảng điểm".',
    prerequisites: [
      'Đã chọn đúng "Kỳ kiểm tra:" và đúng chế độ dữ liệu ("Dữ liệu thực hành" hoặc "Dữ liệu của tôi").',
    ],
    steps: [
      {
        title: 'Lọc theo nhu cầu bằng thanh công cụ đa điều kiện',
        detail:
          'Mặc định bộ lọc trạng thái là "Tất cả trạng thái" để bạn nhìn thấy đủ cả bài "Đã duyệt", "Chờ kiểm duyệt", "Chưa chấm", "Có lỗi" và "Vắng thi". Bạn có thể lọc thêm theo Môn học, Khối, Kỳ kiểm tra, Lớp, Mã đề, Đạt / Chưa đạt, khoảng "Điểm từ ... đến ..." hoặc gõ SBD/họ tên vào ô tìm kiếm.',
      },
      {
        title: 'Phân biệt điểm chính thức và điểm dự kiến',
        detail:
          'Bài "Đã duyệt" hiển thị điểm chính thức màu xanh/rõ nét. Bài "Chờ kiểm duyệt" hiển thị điểm dự kiến màu vàng cam kèm chú thích chờ duyệt và không tự động tính vào số liệu tổng kết chính thức.',
      },
      {
        title: 'Xem chi tiết hoặc xử lý trực tiếp ngay trên bảng',
        detail:
          'Bấm nút "Chi tiết" ở cuối hàng để mở khung kiểm tra ảnh ("Đánh dấu kết quả", "Ảnh đã xử lý", "Ảnh gốc"), sửa thông tin và bấm "Lưu & Chấm lại" hoặc "Lưu & Duyệt chính thức (nếu đủ ĐK)". Với học sinh không có bài, có thể dùng "Đánh dấu học sinh vắng thi...".',
      },
      {
        title: 'Thao tác hàng loạt hoặc tùy chỉnh cột hiển thị',
        detail:
          'Tích chọn nhiều hàng để bấm "Duyệt hàng loạt (đủ ĐK)", "Chấm lại", "Chuyển đến kiểm duyệt" hoặc "Xóa đã chọn". Bấm nút "Cột hiển thị" để bật/tắt và sắp xếp lại thứ tự các cột.',
      },
      {
        title: 'Xuất bảng điểm',
        detail:
          'Chọn "Xuất Excel (.xlsx)" (gồm 6 trang tính chuẩn Times New Roman 13pt, tương thích nhập vnEdu/SMAS), "CSV", "Xuất PDF" hoặc "In bảng điểm".',
      },
    ],
    controlsAndFields: [
      {
        name: 'Bộ lọc trạng thái (mặc định: Tất cả trạng thái)',
        meaning: 'Lọc riêng từng nhóm: Chưa chấm, Đang xử lý, Chờ kiểm duyệt, Đã duyệt, Có lỗi, Vắng thi.',
      },
      {
        name: 'Tìm SBD, mã HS, họ tên, mã phách... & Xóa bộ lọc',
        meaning: 'Tìm nhanh một thí sinh hoặc đưa toàn bộ bộ lọc về mặc định ban đầu.',
      },
      {
        name: 'Cột hiển thị',
        meaning: 'Ẩn/hiện và sắp xếp thứ tự các cột (SBD, Mã HS, Họ tên, Lớp, Mã đề, Điểm P.I/II/III, Tổng điểm, Trạng thái...).',
      },
      {
        name: 'Chi tiết (trên từng hàng)',
        meaning: 'Mở khung xem nhanh ảnh bài thi đã đánh dấu, từng câu đúng/sai và nút duyệt nhanh ngay trong trang Bảng điểm.',
      },
      {
        name: 'Duyệt hàng loạt (đủ ĐK) / Chấm lại / Chuyển đến kiểm duyệt',
        meaning: 'Áp dụng nhanh cho các dòng đang được đánh dấu chọn.',
      },
      {
        name: 'Đánh dấu học sinh vắng thi...',
        meaning: 'Ghi nhận lý do vắng mặt cho học sinh chưa có bài nộp để phân biệt với bài bị sót chưa chấm.',
      },
      {
        name: 'Xuất Excel (.xlsx) / CSV / Xuất PDF / In bảng điểm',
        meaning: 'Xuất bảng điểm hoàn chỉnh phục vụ lưu hồ sơ chuyên môn và nhập điểm vào hệ thống quản lý nhà trường.',
      },
    ],
    practicalExample: {
      scenario: 'Hoàn tất duyệt bài và xuất bảng điểm Excel cho lớp 12A1 sau kỳ kiểm tra.',
      walkthrough: [
        'Mở "Bảng điểm", chọn lớp "12A1". Thấy có 42 bài "Đã duyệt", 2 bài "Chờ kiểm duyệt" và 1 học sinh "Chưa chấm" (thực tế nghỉ ốm).',
        'Xử lý 2 bài chờ duyệt qua khung "Chi tiết" (hoặc sang Kiểm duyệt bài thi), rồi đánh dấu học sinh nghỉ ốm là "Vắng thi".',
        'Bấm "Xuất Excel (.xlsx)" để nhận tệp bảng điểm đầy đủ 6 sheet.',
      ],
    },
    expectedResult:
      'Bảng điểm sạch, chính xác 100%, phân tách minh bạch bài chính thức với vắng thi/chờ duyệt và sẵn sàng các tệp xuất chuẩn chỉnh.',
    importantNotes: [
      'Phần mềm không tự động duyệt các bài còn nghi ngờ chỉ để làm đẹp số lượng. Nút "Duyệt hàng loạt (đủ ĐK)" chỉ duyệt những bài đã hợp lệ hoàn toàn (đủ SBD, có mã đề và không còn câu nghi ngờ).',
      'Khi mới vào Bảng điểm, luôn kiểm tra ô "Kỳ kiểm tra:" và chế độ "Dữ liệu thực hành" / "Dữ liệu của tôi" ở thanh trên.',
    ],
    troubleshooting: [
      {
        problem: 'Số học sinh trong Bảng điểm nhiều hơn số bài đã chấm',
        cause: 'Bảng điểm hiển thị cả những học sinh thuộc lớp tham gia kỳ kiểm tra chưa có bài nộp (trạng thái "Chưa chấm" hoặc "Vắng thi") để giáo viên không bỏ sót.',
        solution: 'Dùng bộ lọc trạng thái chọn "Đã duyệt" hoặc đánh dấu "Vắng thi" cho những em nghỉ kiểm tra.',
      },
    ],
    illustrationId: 'gradebook',
    illustrationCaption: 'Hình 9: Bảng điểm phân tách trạng thái Đã duyệt, Chờ kiểm duyệt (điểm dự kiến), Vắng thi và thanh thao tác nhanh.',
    relatedSectionIds: ['review', 'report-cards', 'analytics'],
    searchKeywords: ['bảng điểm', 'xuất excel', 'vnedu', 'smas', 'vắng thi', 'tất cả trạng thái', 'lọc điểm'],
  },
  {
    id: 'report-cards',
    number: '12',
    title: 'Phiếu trả bài',
    shortTitle: 'Phiếu trả bài',
    category: 'KẾT QUẢ',
    targetNavPage: 'report-cards',
    targetNavLabel: 'Mở Phiếu trả bài',
    summary:
      'Tạo phiếu trả bài cá nhân hóa cho từng học sinh với 4 mẫu trình bày, đính kèm ảnh bài làm có đánh dấu Đúng/Sai, bảng đáp án đối chiếu, nhận xét giáo viên và xuất PDF hàng loạt hoặc nén ZIP.',
    purpose:
      'Giúp giáo viên phát trả kết quả trực quan cho học sinh hoặc gửi cho phụ huynh qua PDF/ảnh: học sinh nhìn thấy ngay bài tô của mình sai ở câu nào, đáp án đúng là gì và nhận xét riêng của thầy cô.',
    whenToUse: [
      'Sau khi đã duyệt bài xong và muốn trả bài chi tiết cho cả lớp.',
      'Khi cần in 2 phiếu A5 trên 1 tờ A4 ngang để tiết kiệm giấy phát trực tiếp trên lớp.',
      'Khi cần xuất từng tệp PDF riêng cho từng em gói trong file ZIP để gửi cho phụ huynh.',
    ],
    howToOpen: 'Vào nhóm "KẾT QUẢ" trên thanh menu trái -> chọn "Phiếu trả bài".',
    prerequisites: [
      'Bài thi đã có trong kỳ kiểm tra đang chọn (nên hoàn tất kiểm duyệt để điểm hiển thị là điểm chính thức).',
    ],
    steps: [
      {
        title: 'Chọn lớp, học sinh và mẫu trình bày ở cột bên trái',
        detail:
          'Chọn một trong 4 mẫu phiếu: "Tiêu chuẩn", "Chi tiết + Ảnh", "Năng lực chuyên đề" hoặc "Trên ảnh bài thi". Chọn khổ giấy: "A4 dọc", "A5 dọc" hoặc "2 phiếu A5 ghép trên 1 tờ A4 ngang".',
      },
      {
        title: 'Bật/tắt các thành phần hiển thị trên phiếu',
        detail:
          'Tùy chọn hiển thị "Logo trường" (có thể bấm "Tải logo trường"), "Xếp hạng", "Điểm TB chung", "Ảnh bài thi", "Đáp án đúng", "Bảng chi tiết câu", "Nhận xét", "Thanh tỷ trọng điểm" và "Chữ ký GV". Chọn chế độ ảnh: "Ảnh đánh dấu kết quả", "Ảnh đã xử lý" hoặc "Ảnh gốc".',
      },
      {
        title: 'Chỉnh sửa và khóa nhận xét cá nhân',
        detail:
          'Hệ thống gợi ý nhận xét theo khung điểm tại "Khung nhận xét". Bạn có thể gõ sửa riêng cho em đang xem rồi bấm "Lưu nhận xét", hoặc bấm "Khóa nhận xét" để không bị ghi đè khi bấm "Tạo lại tự động".',
      },
      {
        title: 'Xem trước trực tiếp và xuất tệp hàng loạt',
        detail:
          'Bấm "Toàn màn hình" để rà soát bản xem trước sắc nét bên phải. Xuất bằng "Xuất PDF học sinh này", "PDF đã chọn", "PDF cả lớp", "Xuất ZIP" (mỗi em một tệp PDF đặt tên theo SBD và Họ tên), hoặc "In phiếu" / "In hàng loạt".',
      },
    ],
    controlsAndFields: [
      {
        name: '4 Mẫu phiếu (Tiêu chuẩn / Chi tiết + Ảnh / Năng lực chuyên đề / Trên ảnh bài thi)',
        meaning: 'Thay đổi bố cục từ gọn gàng tiết kiệm giấy đến đầy đủ ảnh bài tô và bảng đối chiếu từng câu.',
      },
      {
        name: 'Ảnh đánh dấu kết quả / Ảnh đã xử lý / Ảnh gốc',
        meaning: 'Chế độ "Ảnh đánh dấu kết quả" tự khoanh vòng xanh câu đúng, vòng đỏ câu sai và ghi chú đáp án đúng ngay trên bài làm của em đó.',
      },
      {
        name: 'Khổ giấy (A4 dọc / A5 dọc / 2 phiếu A5 ghép trên 1 tờ A4 ngang)',
        meaning: 'Tối ưu cách dàn trang PDF và in ấn trên giấy thực tế.',
      },
      {
        name: 'Tải logo trường & các ô bật/tắt thông tin',
        meaning: 'Cá nhân hóa phiếu trả bài theo quy định từng trường (có thể ẩn Xếp hạng để bảo vệ tâm lý học sinh).',
      },
      {
        name: 'Tạo lại tự động / Khóa nhận xét / Lưu nhận xét',
        meaning: 'Quản lý lời nhận xét riêng của từng học sinh theo ngưỡng điểm hoặc nội dung giáo viên tự viết.',
      },
      {
        name: 'Xuất PDF học sinh này / PDF đã chọn / PDF cả lớp / Xuất ZIP',
        meaning: 'Xuất PDF đơn lẻ, PDF gộp cả lớp nhiều trang hoặc gói ZIP chứa từng PDF riêng đặt tên rõ ràng.',
      },
    ],
    practicalExample: {
      scenario: 'Xuất phiếu trả bài cả lớp 12A1 theo mẫu "Chi tiết + Ảnh" để gửi phụ huynh qua nhóm lớp hoặc in phát.',
      walkthrough: [
        'Mở "Phiếu trả bài", chọn mẫu "Chi tiết + Ảnh" và chế độ "Ảnh đánh dấu kết quả".',
        'Tắt mục "Xếp hạng" nếu không muốn công khai thứ hạng, kiểm tra bản xem trước bên phải.',
        'Bấm "Xuất ZIP" để tải gói 45 tệp PDF đặt tên theo từng học sinh, hoặc bấm "PDF cả lớp" chọn khổ "2 phiếu A5 ghép trên 1 tờ A4 ngang" để in tiết kiệm một nửa số giấy.',
      ],
    },
    expectedResult:
      'Mỗi học sinh nhận được một phiếu trả bài rõ ràng, tiếng Việt chuẩn đẹp, có hình ảnh bài làm được khoanh Đúng/Sai minh bạch và nhận xét của giáo viên.',
    importantNotes: [
      'Với mẫu "2 phiếu A5 ghép trên 1 tờ A4 ngang", hệ thống tự động ghép cặp 2 học sinh lên mỗi mặt giấy A4 giúp giảm 50% lượng giấy in.',
      'Tính năng "Xuất ZIP" đặc biệt hữu ích khi giáo viên chủ nhiệm muốn gửi riêng bài cho từng phụ huynh mà không để lộ điểm của các em khác.',
    ],
    troubleshooting: [
      {
        problem: 'Trên phiếu trả bài không hiện hình ảnh bài làm của học sinh',
        cause: 'Đang dùng mẫu "Tiêu chuẩn" vốn ẩn ảnh cho gọn, hoặc ô "Ảnh bài thi" đang tắt, hoặc học sinh này là dữ liệu mẫu chưa có ảnh chấm.',
        solution: 'Chọn mẫu "Chi tiết + Ảnh" và kiểm tra ô "Ảnh bài thi" đã được tích bật.',
      },
    ],
    illustrationId: 'report_cards',
    illustrationCaption: 'Hình 10: Minh họa cấu trúc Phiếu trả bài kèm chú thích vòng khoanh Đúng/Sai trên ảnh bài thi và thanh tỷ trọng điểm.',
    relatedSectionIds: ['gradebook', 'analytics', 'settings'],
    searchKeywords: ['phiếu trả bài', 'xuất zip', 'a5', 'ảnh đánh dấu', 'nhận xét', 'logo trường', 'in hàng loạt'],
  },
  {
    id: 'analytics',
    number: '13',
    title: 'Thống kê và phân tích',
    shortTitle: 'Thống kê và phân tích',
    category: 'KẾT QUẢ',
    targetNavPage: 'analytics',
    targetNavLabel: 'Mở Thống kê và phân tích',
    summary:
      'Đo lường kết quả chính thức qua 12 chỉ số KPI, biểu đồ phổ điểm, so sánh lớp/mã đề, độ tin cậy KR-20, độ khó – độ phân biệt – phương án nhiễu từng câu, phân tích chuyên đề và xuất báo cáo Word/Excel/PDF.',
    purpose:
      'Giúp giáo viên và tổ chuyên môn đánh giá không chỉ kết quả học tập của học sinh mà còn chất lượng thực tế của đề kiểm tra: câu nào quá dễ, câu nào quá khó, câu nào nhiễu kém hay có dấu hiệu sai sót.',
    whenToUse: [
      'Sau khi đã duyệt bài để tổng kết chất lượng bộ môn theo lớp hoặc theo khối.',
      'Khi cần rà soát lại ma trận đề thi (những câu phân hóa kém hoặc phương án nhiễu không ai chọn) để rút kinh nghiệm ra đề lần sau.',
      'Khi cần xuất nhanh báo cáo phân tích chuyên môn bằng Word (.docx), Excel (.xlsx) hoặc PDF nộp tổ chuyên môn.',
    ],
    howToOpen: 'Vào nhóm "KẾT QUẢ" trên thanh menu trái -> chọn "Thống kê và phân tích".',
    prerequisites: [
      'Kỳ kiểm tra cần có bài ở trạng thái "Đã duyệt" (hệ thống chỉ dùng kết quả chính thức để tính thống kê, không trộn lẫn bài chờ duyệt hay bài vắng).',
    ],
    steps: [
      {
        title: 'Đọc tổng quan 12 thẻ KPI và Biểu đồ phổ điểm',
        detail:
          'Quan sát ngay điểm trung bình, trung vị, độ lệch chuẩn, cao nhất, thấp nhất, tỉ lệ đạt và chỉ số độ tin cậy KR-20. Xem "Biểu đồ phổ điểm" và "Tỉ lệ Đạt / Chưa đạt" (có nút tải ảnh PNG từng biểu đồ).',
      },
      {
        title: 'So sánh lớp học và mã đề',
        detail:
          'Kiểm tra biểu đồ "So sánh kết quả giữa các lớp" để thấy chênh lệch giữa các lớp, và "So sánh giữa các mã đề" để phát hiện nếu có mã đề nào điểm trung bình chênh bất thường.',
      },
      {
        title: 'Phân tích từng câu hỏi và phương án nhiễu theo từng mã đề',
        detail:
          'Chọn tab từng mã đề để xem chi tiết từng câu Phần I/II/III: tỉ lệ Đúng/Sai/Bỏ trống, Độ khó (p), Độ phân biệt (D) và biểu đồ chọn các phương án A/B/C/D (phương án nhiễu).',
      },
      {
        title: 'Gán chuyên đề & mức độ nhận thức (tùy chọn)',
        detail:
          'Bấm "Gán chuyên đề & mức độ (NB/TH/VD/VDC)" để nhập nhanh tên chủ đề kiến thức và mức độ Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao cho từng câu, từ đó xem tỉ lệ làm đúng theo từng mảng kiến thức.',
      },
      {
        title: 'Xem Bảng vàng danh dự và Xuất báo cáo',
        detail:
          'Theo dõi "Bảng vàng danh dự" (có chọn Top 3/5/10 và nút "Ẩn tên khi trình chiếu"). Bấm "Xuất Word (.docx)", "Xuất Excel (.xlsx)" hoặc "Xuất PDF báo cáo" để lưu hồ sơ.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Biểu đồ phổ điểm & Tỉ lệ Đạt / Chưa đạt',
        meaning: 'Biểu diễn phân bố số học sinh theo từng khoảng điểm và đường ngưỡng đạt để nhận biết độ phân hóa của kỳ thi.',
      },
      {
        name: 'Độ khó (p) & Độ phân biệt (D)',
        meaning: 'p là tỉ lệ học sinh làm đúng (từ 0 đến 1; quá cao là rất dễ, quá thấp là rất khó). D đo mức độ tách biệt giữa nhóm điểm cao và nhóm điểm thấp.',
      },
      {
        name: 'Chỉ số độ tin cậy KR-20',
        meaning: 'Đánh giá mức độ ổn định nội tại của đề kiểm tra (tốt khi tiến gần 0,70 trở lên với số lượng bài đủ lớn).',
      },
      {
        name: 'Phân tích phương án nhiễu (A/B/C/D)',
        meaning: 'Cho biết bao nhiêu phần trăm học sinh chọn từng đáp án nhiễu; nếu một phương án có 0% chọn thì phương án đó quá lộ liễu.',
      },
      {
        name: 'Gán chuyên đề & mức độ (NB/TH/VD/VDC)',
        meaning: 'Ánh xạ câu hỏi về các mảng kiến thức để đánh giá điểm mạnh/điểm yếu của học sinh theo chuyên đề.',
      },
      {
        name: 'Bảng vàng danh dự (Top 3/5/10 & Ẩn tên khi trình chiếu)',
        meaning: 'Tuyên dương các học sinh điểm cao nhất; hỗ trợ ẩn tên khi cần chiếu màn hình chia sẻ số liệu ẩn danh.',
      },
      {
        name: 'Xuất Word (.docx) / Xuất Excel (.xlsx) / Xuất PDF báo cáo',
        meaning: 'Xuất trọn bộ báo cáo phân tích chuyên môn kèm biểu đồ và nhận xét.',
      },
    ],
    practicalExample: {
      scenario: 'Đánh giá đề Kiểm tra Giữa kỳ I xem có câu nào bị lỗi đáp án hoặc phân biệt kém.',
      walkthrough: [
        'Mở "Thống kê và phân tích", nhìn biểu đồ "So sánh giữa các mã đề" thấy mã 102 có điểm trung bình thấp hơn mã 101 rõ rệt.',
        'Chuyển sang tab Mã 102 ở bảng phân tích câu hỏi: thấy câu 10 có Độ khó p = 0,09 (chỉ 9% làm đúng) và 82% chọn phương án C trong khi đáp án đang lưu là B -> kiểm tra lại phát hiện gõ nhầm đáp án B ở mã 102.',
        'Vào "Đáp án và thang điểm" sửa câu 10 mã 102 thành C, bấm "Chấm lại bài", rồi quay lại xuất "Xuất Word (.docx)" báo cáo.',
      ],
    },
    expectedResult:
      'Có cái nhìn định lượng chính xác về chất lượng lớp học và đề thi kèm các tệp báo cáo Word/Excel/PDF trình bày khoa học.',
    importantNotes: [
      'Tất cả các chỉ số phân tích chuyên sâu (KR-20, p, D) chỉ tính trên các bài ĐÃ DUYỆT. Nếu thấy thống kê chưa cập nhật bài mới chấm, hãy kiểm tra xem các bài đó đã qua Kiểm duyệt hay chưa.',
      'Mỗi biểu đồ đều có nút tải PNG riêng để thầy cô chèn thêm vào bài trình chiếu họp phụ huynh hoặc họp tổ.',
    ],
    troubleshooting: [
      {
        problem: 'Số liệu thống kê bằng 0 dù trong Bảng điểm đã thấy có bài',
        cause: 'Các bài đó đều đang ở trạng thái "Chờ kiểm duyệt", chưa có bài nào được xác nhận "Đã duyệt".',
        solution: 'Vào "Kiểm duyệt bài thi" xác nhận các bài đang chờ (hoặc bấm "Duyệt hàng loạt (đủ ĐK)" trong Bảng điểm).',
      },
    ],
    illustrationId: 'analytics',
    illustrationCaption: 'Hình 11: Cách đọc Biểu đồ phổ điểm và bảng Phân tích phương án nhiễu (A/B/C/D) cùng cảnh báo Độ khó/Độ phân biệt.',
    relatedSectionIds: ['gradebook', 'answers', 'review'],
    searchKeywords: ['thống kê', 'phổ điểm', 'kr-20', 'độ khó', 'độ phân biệt', 'phương án nhiễu', 'word', 'báo cáo'],
  },
  {
    id: 'backup',
    number: '14',
    title: 'Sao lưu và khôi phục',
    shortTitle: 'Sao lưu và khôi phục',
    category: 'HỆ THỐNG',
    targetNavPage: 'backup',
    targetNavLabel: 'Mở Sao lưu và khôi phục',
    summary:
      'Theo dõi dung lượng IndexedDB trên máy, xuất sao lưu toàn bộ hoặc từng kỳ thi ra tệp JSON, khôi phục theo chế độ Gộp thêm an toàn hoặc Ghi đè, và tùy chọn đồng bộ Google Drive.',
    purpose:
      'Bảo vệ dữ liệu giảng dạy lâu dài trước rủi ro hỏng máy, cài lại trình duyệt hoặc lỡ tay xóa bộ nhớ web, đồng thời giúp chuyển dữ liệu dễ dàng giữa các máy tính.',
    whenToUse: [
      'Sau mỗi đợt kiểm tra lớn để lưu trữ dự phòng một bản sao lưu ra ổ cứng/USB.',
      'Khi cần mang toàn bộ dữ liệu từ máy tính cá nhân lên máy tính phòng bộ môn hoặc ngược lại.',
      'Khi dung lượng IndexedDB hiển thị thanh màu đỏ (>75%) cần sao lưu rồi dọn bớt kỳ cũ.',
    ],
    howToOpen: 'Vào nhóm "HỆ THỐNG" trên thanh menu trái -> chọn "Sao lưu và khôi phục".',
    prerequisites: [
      'Nếu muốn khôi phục, cần có tệp sao lưu hợp lệ có đuôi .json được tạo từ Chấm Thi Thông Minh.',
    ],
    steps: [
      {
        title: 'Theo dõi dung lượng lưu trữ cục bộ',
        detail:
          'Quan sát thanh "Dung lượng lưu trữ cục bộ (IndexedDB)" ở đầu trang để biết hệ thống đang dùng bao nhiêu MB/GB trong hạn mức trình duyệt cấp.',
      },
      {
        title: 'Xuất tệp sao lưu JSON',
        detail:
          'Bấm "Sao lưu toàn bộ dữ liệu" để tải toàn bộ kỳ kiểm tra, lớp học, học sinh, mẫu phiếu, đáp án, kết quả và ảnh bài thi; hoặc chọn một kỳ thi cụ thể rồi bấm "Xuất kỳ thi".',
      },
      {
        title: 'Khôi phục từ tệp sao lưu (.json)',
        detail:
          'Bấm "Chọn tệp sao lưu (.json)", kiểm tra thông tin ngày xuất và số lượng bản ghi, rồi chọn "Gộp thêm vào dữ liệu hiện tại (an toàn)" hoặc "Ghi đè toàn bộ dữ liệu hiện tại (không thể hoàn tác)", sau đó nhấn "Xác nhận khôi phục".',
      },
    ],
    controlsAndFields: [
      {
        name: 'Dung lượng lưu trữ cục bộ (IndexedDB)',
        meaning: 'Cho biết phần bộ nhớ đã dùng trên thiết bị và cảnh báo nếu vượt 75%.',
      },
      {
        name: 'Sao lưu toàn bộ dữ liệu',
        meaning: 'Tải về một tệp .json duy nhất chứa toàn bộ dữ liệu trong ứng dụng.',
      },
      {
        name: 'Xuất kỳ thi',
        meaning: 'Chỉ đóng gói riêng một kỳ kiểm tra đã chọn kèm học sinh, đáp án và ảnh liên quan để chia sẻ gọn nhẹ.',
      },
      {
        name: 'Chọn tệp sao lưu (.json)',
        meaning: 'Đọc và kiểm tra tính hợp lệ của tệp sao lưu trước khi hiển thị bước xác nhận.',
      },
      {
        name: 'Gộp thêm vào dữ liệu hiện tại / Ghi đè toàn bộ dữ liệu hiện tại',
        meaning: 'Chế độ Gộp thêm bảo toàn dữ liệu hiện có; chế độ Ghi đè thay thế hoàn toàn máy hiện tại bằng bản sao lưu.',
      },
      {
        name: 'Đồng bộ Google Drive (Tùy chọn, tắt mặc định)',
        meaning: 'Tắt mặc định để đảm bảo 100% riêng tư; chỉ bật khi giáo viên chủ động muốn tải tệp JSON lên Drive cá nhân bằng Client ID riêng.',
      },
    ],
    practicalExample: {
      scenario: 'Sao lưu kỳ thi Giữa kỳ I từ laptop ở nhà để sáng hôm sau mang vào máy tính trường in phiếu trả bài.',
      walkthrough: [
        'Trên laptop ở nhà: Vào "Sao lưu và khôi phục", chọn kỳ "Kiểm tra Giữa kỳ I" rồi bấm "Xuất kỳ thi" để lấy tệp .json chép vào USB.',
        'Trên máy tính trường: Mở "Sao lưu và khôi phục", bấm "Chọn tệp sao lưu (.json)", chọn "Gộp thêm vào dữ liệu hiện tại (an toàn)" rồi bấm "Xác nhận khôi phục".',
      ],
    },
    expectedResult:
      'Toàn bộ kỳ kiểm tra kèm ảnh bài thi và điểm đã duyệt xuất hiện nguyên vẹn trên máy tính mới mà không làm mất các kỳ thi khác đang có trên máy đó.',
    importantNotes: [
      'Không tự ý chỉnh sửa nội dung bên trong tệp .json bằng trình soạn văn bản vì có thể làm sai cấu trúc lược đồ khi khôi phục.',
      'Chế độ "Ghi đè toàn bộ dữ liệu hiện tại" không thể hoàn tác, nên hãy cân nhắc chọn "Gộp thêm" trừ khi bạn muốn làm sạch máy hoàn toàn theo bản sao lưu.',
    ],
    troubleshooting: [
      {
        problem: 'Báo lỗi "Tệp JSON không phải bản sao lưu hợp lệ của Chấm Thi Thông Minh"',
        cause: 'Chọn nhầm tệp JSON từ phần mềm khác hoặc tệp tải về bị cắt dở dang chưa hoàn tất.',
        solution: 'Kiểm tra lại đúng tệp bắt đầu bằng "chamthi_..." được xuất từ trang Sao lưu hoặc Cài đặt.',
      },
    ],
    illustrationId: 'backup',
    illustrationCaption: 'Hình 12: Quy trình Sao lưu toàn bộ dữ liệu từ IndexedDB sang tệp JSON và Khôi phục an toàn trên máy khác.',
    relatedSectionIds: ['settings', 'intro', 'faq'],
    searchKeywords: ['sao lưu', 'khôi phục', 'json', 'indexeddb', 'dung lượng', 'gộp thêm', 'ghi đè', 'chuyển máy'],
  },
  {
    id: 'settings',
    number: '15',
    title: 'Cài đặt',
    shortTitle: 'Cài đặt',
    category: 'HỆ THỐNG',
    targetNavPage: 'settings',
    targetNavLabel: 'Mở Cài đặt',
    summary:
      'Quản lý xóa/khôi phục bộ dữ liệu thực hành và sao lưu riêng dữ liệu chính thức; tinh chỉnh các ngưỡng nhận dạng OMR (tô đậm, tô mờ, tẩy xóa, độ nét camera); cấu hình ánh xạ cột vnEdu/SMAS và chạy bộ kiểm thử xác minh.',
    purpose:
      'Cho phép giáo viên làm chủ bộ dữ liệu (dọn sạch dữ liệu mẫu khi đã quen sử dụng) và tinh chỉnh độ nhạy của máy chấm phù hợp với loại bút, loại giấy hay điều kiện ánh sáng đặc thù ở trường mình.',
    whenToUse: [
      'Khi muốn xóa bỏ hoàn toàn bộ dữ liệu thực hành tích hợp sẵn hoặc khôi phục lại để hướng dẫn đồng nghiệp.',
      'Khi muốn sao lưu nhanh chỉ riêng "Dữ liệu của tôi" (không kèm dữ liệu thực hành).',
      'Khi học sinh tô bút chì quá nhạt khiến nhiều bài bị chuyển chờ kiểm duyệt và bạn muốn tinh chỉnh nhẹ "Ngưỡng tô chắc chắn" hoặc "Ngưỡng tô mờ".',
      'Khi muốn kiểm chứng tự động các tình huống biên của OpenCV OMR bằng "Bộ kiểm thử xác minh OMR & Tính điểm".',
    ],
    howToOpen: 'Vào nhóm "HỆ THỐNG" trên thanh menu trái -> chọn "Cài đặt".',
    prerequisites: [
      'Nếu muốn chạy Bộ kiểm thử xác minh OMR & Tính điểm, đợi vài giây để OpenCV ở trạng thái sẵn sàng.',
    ],
    steps: [
      {
        title: 'Quản lý dữ liệu thực hành và dữ liệu của tôi',
        detail:
          'Bấm "Xóa dữ liệu thực hành" -> "Xác nhận xóa" để dọn sạch các kỳ thi mẫu (không ảnh hưởng dữ liệu thật). Hoặc bấm "Khôi phục bộ dữ liệu thực hành" khi cần dùng lại. Hai nút "Sao lưu dữ liệu của tôi" và "Nhập dữ liệu của tôi" chỉ làm việc với dữ liệu thật.',
      },
      {
        title: 'Tinh chỉnh ngưỡng nhận dạng OMR (nếu cần)',
        detail:
          'Điều chỉnh thanh trượt "Ngưỡng tô chắc chắn (0.20 – 0.65)", "Ngưỡng tô mờ (0.10 – 0.35)", "Chênh lệch nghi ngờ tô nhiều", "Ngưỡng phát hiện tẩy xóa (viền ngoài)", "Độ nét tối thiểu Camera (Laplacian)", "Số khung hình ổn định trước khi tự chụp" và các tùy chọn âm thanh/ẩn thông tin phách.',
      },
      {
        title: 'Cấu hình ánh xạ cột vnEdu và SMAS',
        detail:
          'Tùy chỉnh tên tiêu đề cột tương ứng khi xuất tệp tương thích hệ thống quản lý điểm vnEdu hoặc SMAS của nhà trường.',
      },
      {
        title: 'Lưu cài đặt hoặc chạy Bộ kiểm thử',
        detail:
          'Nhấn "Lưu cài đặt" (hoặc "Mặc định" để quay về thông số chuẩn). Bên dưới cùng, có thể bấm "Chạy toàn bộ bộ kiểm thử" để kiểm tra trực tiếp khả năng nhận diện trên hàng loạt tình huống mẫu.',
      },
    ],
    controlsAndFields: [
      {
        name: 'Xóa dữ liệu thực hành / Khôi phục bộ dữ liệu thực hành',
        meaning: 'Xóa sạch hoặc nạp lại 3 lớp, 135 học sinh, 5 kỳ thi, 20 mã đề thực hành mà không đụng chạm dữ liệu thật của bạn.',
      },
      {
        name: 'Sao lưu dữ liệu của tôi / Nhập dữ liệu của tôi',
        meaning: 'Chỉ xuất và nhập phần dữ liệu chính thức do giáo viên tự tạo, giữ tệp sao lưu thật gọn nhẹ.',
      },
      {
        name: 'Ngưỡng tô chắc chắn & Ngưỡng tô mờ',
        meaning: 'Quyết định tỷ lệ phần trăm mật độ đen trong ô tròn từ mức nào được coi là đã tô chắc, mức nào cảnh báo tô mờ.',
      },
      {
        name: 'Chênh lệch nghi ngờ tô nhiều & Ngưỡng phát hiện tẩy xóa',
        meaning: 'Nhận biết câu bị tô 2 ô gần bằng nhau hoặc câu có vết chì tẩy còn bám quanh viền ngoài.',
      },
      {
        name: 'Ẩn thông tin học sinh trong quá trình chấm phiếu rọc phách',
        meaning: 'Giữ nguyên tắc chấm rọc phách khách quan khi sử dụng mẫu phiếu có cột phách.',
      },
      {
        name: 'Ánh xạ tên cột xuất mẫu vnEdu / SMAS',
        meaning: 'Đổi tên tiêu đề cột xuất ra khớp chính xác với biểu mẫu nhập điểm của trường.',
      },
      {
        name: 'Chạy toàn bộ bộ kiểm thử',
        meaning: 'Kiểm thử tự động ngay tại trình duyệt các kịch bản tô chuẩn, tô mờ, tô nhiều, tẩy xóa, xoay nghiêng, bóng đổ, ghép đôi A5, PDF tiếng Việt.',
      },
    ],
    practicalExample: {
      scenario: 'Hoàn thành giai đoạn làm quen, dọn sạch dữ liệu thực hành và giữ nguyên các kỳ thi đã tự tạo.',
      walkthrough: [
        'Mở "Cài đặt", kiểm tra dòng mô tả xác nhận số kỳ thi chính thức của bạn đang được tách riêng.',
        'Bấm "Xóa dữ liệu thực hành", sau đó bấm "Xác nhận xóa".',
        'Từ giờ trở đi, kể cả khi tải lại trình duyệt, hệ thống không tự sinh lại dữ liệu mẫu nữa.',
      ],
    },
    expectedResult:
      'Cấu hình OMR phù hợp điều kiện giấy/bút thực tế được lưu vào IndexedDB; dữ liệu thực hành và dữ liệu chính thức được quản lý rõ ràng theo đúng ý giáo viên.',
    importantNotes: [
      'Chỉ nên điều chỉnh ngưỡng OMR từng bước nhỏ. Nếu hạ "Ngưỡng tô chắc chắn" quá thấp (ví dụ 0.20), các vết tẩy chưa sạch có thể bị nhận nhầm là đáp án tô.',
      'Trong mọi trường hợp nghi ngờ sau khi đổi thông số, hãy bấm nút "Mặc định" để quay về bộ ngưỡng chuẩn đã tối ưu sẵn.',
    ],
    troubleshooting: [
      {
        problem: 'Nút "Chạy toàn bộ bộ kiểm thử" bị mờ không bấm được',
        cause: 'Thư viện OpenCV.js WebAssembly chưa nạp xong hoàn toàn.',
        solution: 'Chờ thanh thông báo tải OpenCV ở đầu trang kết thúc, nút sẽ tự động chuyển sang màu xanh cho phép bấm.',
      },
    ],
    illustrationId: 'settings',
    illustrationCaption: 'Hình 13: Khu vực quản lý tách biệt dữ liệu thực hành – dữ liệu của tôi và tinh chỉnh ngưỡng nhận dạng OMR.',
    relatedSectionIds: ['backup', 'review', 'faq'],
    searchKeywords: ['cài đặt', 'xóa dữ liệu thực hành', 'khôi phục thực hành', 'ngưỡng', 'vnedu', 'smas', 'kiểm thử'],
  },
  {
    id: 'faq',
    number: '16',
    title: 'Câu hỏi thường gặp',
    shortTitle: 'Câu hỏi thường gặp',
    category: 'HỆ THỐNG',
    summary:
      'Giải đáp nhanh 14 tình huống thực tế thường gặp nhất khi dùng Camera, nhận dạng SBD/mã đề, xử lý kiểm duyệt, xuất Excel/PDF, dùng ngoại tuyến và bảo toàn dữ liệu.',
    purpose:
      'Tra cứu nhanh nguyên nhân và cách xử lý từng bước cho các vướng mắc thực tế trong quá trình tổ chức chấm thi và tổng hợp điểm.',
    whenToUse: [
      'Khi gặp sự cố đột xuất lúc chuẩn bị chấm (không mở được Camera, phiếu không nhận diện, bảng điểm chưa hiện...).',
      'Khi cần xem lại cách chuyển dữ liệu sang máy mới, cách xóa dữ liệu thực hành hoặc khôi phục từ tệp JSON.',
    ],
    howToOpen: 'Mở trang "Hướng dẫn sử dụng" và chọn mục "16. Câu hỏi thường gặp" ở mục lục bên trái.',
    prerequisites: ['Không yêu cầu điều kiện chuẩn bị; chọn trực tiếp câu hỏi bạn đang quan tâm hoặc gõ từ khóa vào ô tìm kiếm.'],
    steps: [],
    controlsAndFields: [],
    practicalExample: {
      scenario: 'Tra cứu nhanh cách xử lý khi máy chấm xong báo nhiều bài chuyển sang chờ kiểm duyệt.',
      walkthrough: [
        'Gõ từ khóa "kiểm duyệt" vào ô tìm kiếm ở mục lục bên trái hoặc mở mục "16. Câu hỏi thường gặp".',
        'Đọc câu hỏi "Tại sao bài thi chuyển sang chờ kiểm duyệt?" và bấm liên kết "Kiểm duyệt bài thi" đi kèm để xử lý.',
      ],
    },
    expectedResult:
      'Hiểu rõ nguyên nhân gốc và giải pháp thao tác đúng ngay tại chỗ mà không bị gián đoạn buổi chấm bài.',
    importantNotes: [
      'Mọi thao tác sửa lỗi đều không làm hỏng ảnh gốc bài thi đã lưu trong IndexedDB.',
    ],
    troubleshooting: [],
    relatedSectionIds: ['camera', 'review', 'gradebook', 'backup', 'settings'],
    searchKeywords: [
      'câu hỏi thường gặp',
      'faq',
      'hỏi đáp',
      'không mở được camera',
      'không nhận diện',
      'số báo danh',
      'chờ kiểm duyệt',
      'tô nhiều',
      'sửa đáp án',
      'chấm lại',
      'xuất excel',
      'không có internet',
      'lưu ở đâu',
      'chuyển máy',
      'xóa dữ liệu thực hành',
      'khôi phục',
    ],
  },
];
