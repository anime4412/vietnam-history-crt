// ==============================================================================
// admin.js - BỘ ĐIỀU HÀNH LOGIC TRUNG TÂM QUẢN TRỊ BẢO TÀNG LỊCH SỬ (ADMIN CMS)
// Dự án: Vietnam History CRT Experience (Phòng Chiếu Lịch Sử & Bảo Tàng 3D)
// ==============================================================================
// 📚 MỤC TIÊU KIẾN TRÚC & CHỨC NĂNG HỆ THỐNG:
// 1. Quản lý trạng thái xác thực bảo mật (Admin PIN Authentication)
// 2. Giao tiếp hai chiều với hệ thống REST API (/api/data, /api/relics, /api/tapes, /api/settings)
// 3. Thực hiện đầy đủ 4 thao tác CRUD (Create - Read - Update - Delete) cho Bảo vật và Cuộn băng
// 4. Đồng bộ tức thì với không gian 3D Three.js và trang triển lãm bảo tàng số 2D
// 5. Quản lý sao lưu (Export JSON) và phục hồi cơ sở dữ liệu (Import JSON)
// ==============================================================================

/**
 * 📦 KHÁI NIỆM: STATE MANAGEMENT (QUẢN LÝ TRẠNG THÁI CỤC BỘ)
 * - "state" là một Object JavaScript đóng vai trò là "Single Source of Truth" (Nguồn chân lý duy nhất).
 * - Nó lưu trữ toàn bộ dữ liệu hiện hành trong bộ nhớ RAM của trình duyệt trong suốt phiên làm việc.
 * - Khi người dùng thêm, sửa, xóa hoặc tìm kiếm, ta thay đổi dữ liệu trong `state` trước,
 *   sau đó gọi các hàm render để cập nhật lại giao diện HTML tương ứng.
 */
const state = {
  settings: {},         // Lưu cấu hình hệ thống phòng chiếu (âm lượng, kênh mặc định, hiệu ứng CRT)
  relics: [],           // Danh sách mảng các đối tượng Bảo vật Quốc gia (Trống đồng, Kim ấn,...)
  tapes: [],            // Danh sách mảng các cuộn băng tư liệu VHS lịch sử
  filterRelicQuery: ""  // Chuỗi ký tự từ khóa mà người dùng đang gõ trong ô tìm kiếm
};

// ==============================================================================
// 1. KHỞI TẠO HỆ THỐNG KHI TẢI TRANG (LIFECYCLE INITIALIZATION)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH CHI TIẾT CẤU TRÚC:
 * 1. `document`: Đối tượng toàn cục (Global Object) đại diện cho toàn bộ cây DOM (Document Object Model) của trang HTML.
 * 2. `.addEventListener(event, callback)`: Hàm tiêu chuẩn của W3C DOM dùng để "lắng nghe" một sự kiện từ người dùng hoặc trình duyệt.
 *    - Tham số 1 ("DOMContentLoaded"): Sự kiện kích hoạt khi trình duyệt đã đọc và dựng xong cây cấu trúc HTML vào bộ nhớ.
 *      👉 TẠI SAO BẮT BUỘC DÙNG?: Nếu ta gọi `document.getElementById` trước khi cây DOM được dựng xong,
 *         trình duyệt sẽ không tìm thấy thẻ HTML đó và trả về `null`, dẫn đến lỗi nghiêm trọng (crash script)!
 *    - Tham số 2 (`() => { ... }`): Hàm mũi tên (Arrow Function) chứa mã lệnh sẽ tự động chạy khi sự kiện xảy ra.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Gọi các hàm thiết lập giao diện ban đầu
  initAuth();           // Khởi tạo hệ thống đăng nhập mã PIN bảo mật
  initTabs();           // Khởi tạo các tab chuyển trang trong bảng quản trị
  initModals();         // Khởi tạo các hộp thoại Modal (Thêm/Sửa/Xóa)
  initRelicEvents();    // Gắn sự kiện cho bảng quản lý Bảo vật Quốc gia
  initTapeEvents();     // Gắn sự kiện cho bảng quản lý Cuộn băng lịch sử
  initSettingsEvents(); // Gắn sự kiện cho form cài đặt phòng 3D
  initBackupEvents();   // Gắn sự kiện cho hệ thống Sao lưu & Phục hồi dữ liệu

  /**
   * 📚 GIẢI THÍCH: localStorage VÀ sessionStorage LÀ GÌ?
   * - `localStorage`: Bộ nhớ cục bộ của trình duyệt, lưu theo cặp Key-Value. Dữ liệu KHÔNG có hạn sử dụng,
   *   tắt máy hoặc tắt trình duyệt bật lại vẫn còn nguyên (dùng để nhớ phiên đăng nhập lâu dài).
   * - `sessionStorage`: Bộ nhớ phiên làm việc, dữ liệu sẽ TỰ ĐỘNG BỊ XÓA khi người dùng tắt tab trình duyệt.
   * - Phép toán `||` (OR logic): Nếu không tìm thấy token trong localStorage thì sẽ tìm tiếp trong sessionStorage.
   */
  const token = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");

  /**
   * 📚 GIẢI THÍCH CƠ CHẾ HOẠT ĐỘNG CỦA `document.getElementById`:
   * - Tên hàm: `document.getElementById(idString)`
   * - Ý nghĩa: Tìm và trích xuất MỘT phần tử HTML duy nhất trên trang web dựa vào thuộc tính `id="..."` của nó.
   * - Cơ chế chạy ngầm: Trình duyệt xây dựng một bảng băm (Hash Table) lập chỉ mục cho tất cả các ID trong file HTML.
   *   Do đó hàm này truy xuất phần tử cực nhanh với độ phức tạp thời gian là O(1).
   * - Giá trị trả về:
   *   + Nếu tìm thấy thẻ có id="authModal": Trả về đối tượng `HTMLElement` đại diện cho thẻ đó.
   *   + Nếu không tìm thấy: Trả về giá trị `null`.
   */
  const authModal = document.getElementById("authModal");

  if (token) {
    // Nếu đã có token hợp lệ từ trước: Ẩn popup đăng nhập và tải dữ liệu quản trị
    if (authModal) {
      authModal.hidden = true;          // Gán thuộc tính HTML `hidden`
      authModal.style.display = "none"; // Thay đổi CSS display để đảm bảo ẩn hoàn toàn
    }
    loadAllData(); // Gọi hàm bất đồng bộ lấy dữ liệu từ máy chủ
  } else {
    // Nếu chưa đăng nhập: Hiển thị popup yêu cầu nhập mã PIN quản trị
    showAuthModal();
  }
});

// ==============================================================================
// 2. QUẢN LÝ BẢO MẬT & ĐĂNG NHẬP (PIN LOCK AUTHENTICATION)
// ==============================================================================

/**
 * Hàm khởi tạo và bắt các sự kiện liên quan đến Đăng nhập và Đăng xuất
 */
function initAuth() {
  // Lấy tham chiếu đến các thẻ HTML trong biểu mẫu đăng nhập thông qua ID duy nhất
  const authModal = document.getElementById("authModal");
  const authForm = document.getElementById("authForm");
  const authPinInput = document.getElementById("authPinInput");
  const authErrorMsg = document.getElementById("authErrorMsg");
  const btnLogout = document.getElementById("btnLogout");

  /**
   * 📚 GIẢI THÍCH: SỰ KIỆN SUBMIT VÀ e.preventDefault()
   * - `authForm.addEventListener("submit", ...)`: Bắt sự kiện khi người dùng nhấn nút Submit hoặc ấn phím Enter trong form.
   * - Tham số `e` (Event Object): Đối tượng sự kiện do trình duyệt tạo ra, chứa thông tin về sự kiện đang xảy ra.
   * - `e.preventDefault()`: **PHƯƠNG THỨC CỰC KỲ QUAN TRỌNG**!
   *   + Hành vi mặc định của thẻ `<form>` trong HTML là sẽ gửi dữ liệu lên URL và LOAD LẠI TOÀN BỘ TRANG (Refresh page).
   *   + `e.preventDefault()` ngăn chặn việc tải lại trang này, giúp ứng dụng chạy mượt mà theo mô hình SPA (Single Page Application),
   *     sau đó JavaScript sẽ tự gửi dữ liệu qua mạng bằng hàm `fetch()` ở chế độ nền.
   * - Từ khóa `async`: Khai báo đây là một hàm bất đồng bộ (Asynchronous Function) để có thể dùng từ khóa `await` bên trong.
   */
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Chặn hành vi tải lại trang của form

    // `.value`: Lấy giá trị chuỗi mà người dùng đã gõ vào ô nhập liệu
    // `.trim()`: Cắt bỏ các khoảng trắng thừa ở đầu và cuối chuỗi để tránh nhập nhầm dấu cách
    const pin = authPinInput.value.trim();
    if (!pin) return; // Nếu chuỗi rỗng thì thoát hàm, không làm gì cả

    try {
      /**
       * 📚 GIẢI THÍCH: HÀM `fetch()` VÀ `await`:
       * - `fetch(url, options)`: API tiêu chuẩn hiện đại của JavaScript dùng để gửi yêu cầu mạng HTTP đến Server.
       * - `method: "POST"`: Phương thức HTTP dùng khi gửi dữ liệu lên máy chủ để xử lý/xác thực.
       * - `headers: { "Content-Type": "application/json" }`: Báo cho máy chủ biết dữ liệu gửi đi ở định dạng JSON.
       * - `body: JSON.stringify({ pin })`:
       *   + `{ pin }` là cú pháp viết tắt của `{ pin: pin }` (Object JavaScript).
       *   + `JSON.stringify(...)` chuyển đổi đối tượng JavaScript thành chuỗi văn bản JSON chuẩn: '{"pin":"admin123"}'.
       * - `await`: Tạm dừng hàm cho đến khi máy chủ phản hồi (Response), mà không làm đóng băng giao diện người dùng.
       */
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });

      // `await res.json()`: Đọc luồng dữ liệu phản hồi từ máy chủ và parse (phân tích) từ chuỗi JSON thành Object JS
      const data = await res.json();

      if (data.success) {
        // Đăng nhập thành công: Lưu token vào bộ nhớ trình duyệt để dùng cho các request tiếp theo
        localStorage.setItem("admin_token", data.token);
        sessionStorage.setItem("admin_token", data.token);

        // Ẩn hộp thoại đăng nhập và xóa thông báo lỗi cũ
        authModal.hidden = true;
        authModal.style.display = "none";
        authErrorMsg.hidden = true;
        authErrorMsg.style.display = "none";
        authPinInput.value = ""; // Xóa trắng ô nhập liệu để bảo mật

        // Hiển thị thông báo Toast màu xanh thông báo thành công
        showToast("Mở khóa hệ thống quản trị thành công!", "success");

        // Nạp toàn bộ dữ liệu bảo tàng từ Server về giao diện
        loadAllData();
      } else {
        // Đăng nhập thất bại: Hiển thị thông báo lỗi từ server trả về
        authErrorMsg.textContent = data.message || "Mã PIN không đúng!";
        authErrorMsg.hidden = false;
        authErrorMsg.style.display = "block";
        authPinInput.select(); // Bôi đen toàn bộ chữ trong ô để người dùng dễ nhập lại
      }
    } catch (err) {
      /**
       * 📚 GIẢI THÍCH: KHỐI `catch (err)`:
       * - Bắt các lỗi xảy ra trong khối `try` (ví dụ: mất kết nối mạng, server bị tắt).
       * - Chế độ dự phòng (Fallback): Nếu chạy offline không có server Node.js, kiểm tra mã PIN mặc định "admin123"
       */
      if (pin === "admin123") {
        localStorage.setItem("admin_token", "local-token");
        sessionStorage.setItem("admin_token", "local-token");
        authModal.hidden = true;
        authModal.style.display = "none";
        showToast("Đăng nhập thành công (Chế độ cục bộ)!", "success");
        loadAllData();
      } else {
        authErrorMsg.textContent = "Không thể kết nối đến máy chủ API.";
        authErrorMsg.hidden = false;
        authErrorMsg.style.display = "block";
      }
    }
  });

  // Bắt sự kiện khi người dùng click vào nút Đăng xuất / Khóa hệ thống
  btnLogout.addEventListener("click", () => {
    // Xóa token khỏi bộ nhớ trình duyệt
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_token");
    // Hiển thị lại modal đăng nhập để bảo vệ trang quản trị
    showAuthModal();
    showToast("Đã khóa bảng điều khiển bảo tàng.", "info");
  });
}

/**
 * Hiển thị hộp thoại nhập mã PIN và tự động đưa con trỏ chuột vào ô nhập
 */
function showAuthModal() {
  const authModal = document.getElementById("authModal");
  const authPinInput = document.getElementById("authPinInput");
  authModal.hidden = false;
  authModal.style.display = "flex";
  // `setTimeout` tạo một khoảng trễ nhỏ (100ms) để DOM vẽ xong modal trước khi focus vào ô input
  setTimeout(() => authPinInput.focus(), 100);
}

// ==============================================================================
// 2.5 BỘ TRUYỀN TẢI YÊU CẦU BẢO MẬT (SECURE AUTH FETCH WRAPPER WITH BEARER TOKEN)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM WRAPPER `authFetch` (MẪU THIẾT KẾ ĐÓNG GÓI XÁC THỰC)
 * - Tác dụng: Thay vì mỗi lần gọi `fetch()` ta phải tự lấy token và chèn header "Authorization",
 *   hàm `authFetch` này tự động làm việc đó cho mọi API cần quyền quản trị viên.
 * - Chuẩn bảo mật: Sử dụng Bearer Token theo chuẩn RFC 6750 ("Authorization: Bearer <token>").
 * - Xử lý mã lỗi HTTP 401 (Unauthorized): Nếu token hết hạn hoặc không hợp lệ, tự động đăng xuất và báo lỗi.
 * 
 * @param {string} url - Đường dẫn API cần gọi (ví dụ: "/api/relics")
 * @param {object} options - Cấu hình request HTTP (method, headers, body,...)
 * @returns {Promise<Response>} - Đối tượng Promise chứa kết quả phản hồi từ máy chủ
 */
async function authFetch(url, options = {}) {
  // Lấy token từ bộ nhớ trình duyệt
  const token = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");
  
  // Sao chép các headers có sẵn hoặc khởi tạo object mới bằng Spread Operator `...`
  const headers = { ...(options.headers || {}) };
  if (token) {
    // Đính kèm Token bảo mật vào tiêu đề Authorization của gói tin HTTP
    headers["Authorization"] = `Bearer ${token}`;
  }
  options.headers = headers;

  // Thực hiện gửi request qua mạng
  const res = await fetch(url, options);

  // Nếu máy chủ trả về mã lỗi 401 (Chưa đăng nhập hoặc token sai/hết hạn)
  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_token");
    showAuthModal();
    showToast("Phiên đăng nhập đã hết hạn hoặc chưa xác thực. Vui lòng mở khóa lại!", "error");
  }
  return res;
}

// ==============================================================================
// 3. TẢI DỮ LIỆU TỪ MÁY CHỦ (FETCH API DATA)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM BẤT ĐỒNG BỘ `loadAllData`
 * - Nhiệm vụ: Gửi yêu cầu HTTP GET đến máy chủ để lấy toàn bộ dữ liệu (cài đặt, bảo vật, cuộn băng).
 * - Luồng hoạt động (Data Flow):
 *   1. Client (trình duyệt) gọi `fetch("/api/data")`.
 *   2. Server xử lý, đọc file cơ sở dữ liệu `history-db.json` và trả về JSON.
 *   3. Client nhận dữ liệu, cập nhật vào đối tượng `state`, sau đó gọi các hàm render để vẽ lại UI.
 */
async function loadAllData() {
  try {
    const res = await fetch("/api/data"); // Gửi request GET (mặc định của fetch là GET)
    const json = await res.json();        // Chuyển luồng stream phản hồi thành Object

    if (json.success) {
      // Cập nhật State trong bộ nhớ
      state.settings = json.settings || {};
      state.relics = json.relics || [];
      state.tapes = json.tapes || [];

      // Cập nhật các thành phần giao diện tương ứng
      updateKpis();            // Cập nhật các thẻ số liệu thống kê (Thẻ KPI)
      renderRelicsTable();     // Vẽ bảng danh sách Bảo vật Quốc gia
      renderTapesTable();      // Vẽ bảng danh sách Cuộn băng VHS
      populateSettingsForm();  // Điền dữ liệu cấu hình vào form cài đặt
    }
  } catch (err) {
    console.warn("Chưa chạy qua server.js, tải dữ liệu từ tệp cục bộ:", err);
    // Kỹ thuật Fallback (Dự phòng): Nếu mở trực tiếp file HTML không qua server Node.js,
    // sử dụng cú pháp Dynamic Import của ES6 để nạp dữ liệu từ file JS cục bộ
    try {
      const module = await import("./vietnam-history-data.js");
      state.relics = module.VIETNAM_RELICS || [];
      state.tapes = module.VIETNAM_TAPES || [];
      updateKpis();
      renderRelicsTable();
      renderTapesTable();
    } catch (e) {
      showToast("Lỗi nạp dữ liệu lịch sử", "error");
    }
  }
}

/**
 * 📚 GIẢI THÍCH: HÀM CẬP NHẬT CÁC THẺ SỐ LIỆU THỐNG KÊ (KPIs)
 * - `element.textContent`: Thuộc tính gán văn bản thuần túy (Plain Text) vào thẻ HTML.
 *   👉 SO SÁNH VỚI innerHTML: `.textContent` chạy nhanh hơn và an toàn tuyệt đối trước lỗ hổng XSS
 *      vì trình duyệt sẽ không coi chuỗi đưa vào là mã HTML/JS thực thi.
 * - `padStart(targetLength, padString)`: Phương thức chuỗi ES2017 giúp chèn thêm ký tự vào đầu chuỗi nếu chưa đủ độ dài.
 *   Ví dụ: `String(7).padStart(2, "0")` sẽ trả về chuỗi `"07"`.
 * - `Array.prototype.filter()`: Phương thức của ES6 duyệt qua mảng và lọc ra các phần tử thỏa mãn điều kiện logic.
 */
function updateKpis() {
  // Lấy các thẻ hiển thị số lượng bằng document.getElementById và gán giá trị mới
  document.getElementById("kpiRelicNum").textContent = state.relics.length;
  document.getElementById("kpiTapeNum").textContent = state.tapes.length;
  
  // Định dạng hiển thị 2 chữ số (ví dụ: "07", "11")
  document.getElementById("badgeRelicCount").textContent = String(state.relics.length).padStart(2, "0");
  document.getElementById("badgeTapeCount").textContent = String(state.tapes.length).padStart(2, "0");

  // Đếm số lượng cuộn băng có video tư liệu thực tế (khác chuỗi rỗng)
  const videoCount = state.tapes.filter(t => t.videoUrl && t.videoUrl.trim() !== "").length;
  document.getElementById("kpiVideoNum").textContent = videoCount;
}

// ==============================================================================
// 4. QUẢN LÝ CHUYỂN TAB ĐIỀU HƯỚNG (TAB NAVIGATION MANAGEMENT)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `initTabs` VÀ `document.querySelectorAll`
 * - `document.querySelectorAll(".nav-tab")`:
 *   + Tìm kiếm TẤT CẢ các thẻ HTML có class CSS là "nav-tab".
 *   + Trả về một `NodeList` (danh sách các node phần tử trong DOM).
 *   + Khác với `getElementById` (chỉ trả về 1 thẻ duy nhất theo ID), `querySelectorAll` trả về tập hợp nhiều thẻ.
 * - `.forEach(tab => { ... })`: Vòng lặp duyệt qua từng thẻ tab để gắn sự kiện click cho từng nút.
 * - `tab.getAttribute("data-tab")`: Đọc giá trị của thuộc tính tùy biến `data-*` (HTML5 Custom Data Attribute).
 */
function initTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Lấy ID của vùng nội dung tương ứng (ví dụ: "tab-relics", "tab-tapes")
      const targetPaneId = tab.getAttribute("data-tab");
      switchTab(targetPaneId);
    });
  });

  // Bắt sự kiện cho các nút chuyển nhanh trên màn hình tổng quan (Quick Action Buttons)
  // Toán tử `?.` (Optional Chaining): Chỉ gọi addEventListener nếu phần tử đó tồn tại (khác null), tránh lỗi crash
  document.getElementById("qaGoRelics")?.addEventListener("click", () => switchTab("tab-relics"));
  document.getElementById("qaGoTapes")?.addEventListener("click", () => switchTab("tab-tapes"));
  document.getElementById("qaGo3D")?.addEventListener("click", () => window.open("index.html", "_blank"));
  document.getElementById("btnQuickAddRelic")?.addEventListener("click", () => {
    switchTab("tab-relics");
    openRelicModal(); // Mở modal thêm mới bảo vật
  });
}

/**
 * 📚 GIẢI THÍCH: HÀM `switchTab` VÀ `classList.toggle`
 * - `element.classList`: Đối tượng thuộc tính DOM cho phép thao tác với danh sách các class CSS của thẻ.
 * - `element.classList.toggle("active", booleanCondition)`:
 *   + Nếu điều kiện là `true`: Thêm class "active" vào thẻ (thẻ sáng lên hoặc hiện ra).
 *   + Nếu điều kiện là `false`: Gỡ bỏ class "active" khỏi thẻ (thẻ mờ đi hoặc ẩn đi).
 *   + Đây là kỹ thuật viết mã cực kỳ thanh lịch và tối ưu trong JavaScript hiện đại.
 * 
 * @param {string} paneId - ID của tab-pane cần kích hoạt (ví dụ: "tab-relics")
 */
function switchTab(paneId) {
  // Bật class 'active' cho nút tab được chọn, tắt ở các tab còn lại
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.classList.toggle("active", t.getAttribute("data-tab") === paneId);
  });
  // Bật class 'active' cho vùng nội dung (tab-pane) có id khớp, ẩn các pane còn lại
  document.querySelectorAll(".tab-pane").forEach(p => {
    p.classList.toggle("active", p.id === paneId);
  });
}

// ==============================================================================
// 5. QUẢN LÝ BẢO VẬT QUỐC GIA (RELICS CRUD - CREATE, READ, UPDATE, DELETE)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `initRelicEvents`
 * - Gắn các sự kiện: Mở modal thêm mới, tìm kiếm tức thì (Live Search), thêm dòng ghi chú động, và gửi form lưu.
 */
function initRelicEvents() {
  const btnOpenAddRelic = document.getElementById("btnOpenAddRelicModal");
  const relicSearchInput = document.getElementById("relicSearchInput");
  const relicForm = document.getElementById("relicForm");
  const btnAddNoteRow = document.getElementById("btnAddNoteRow");

  // Khi click nút "Thêm Bảo Vật", gọi hàm mở modal ở chế độ thêm mới (không truyền tham số)
  btnOpenAddRelic.addEventListener("click", () => openRelicModal());

  // Khởi tạo các sự kiện tải tệp ảnh lên và xem trước
  initRelicImageUploader();
  fetchExistingImages();

  /**
   * 📚 GIẢI THÍCH: SỰ KIỆN `input` CHO TÍNH NĂNG TÌM KIẾM TỨC THÌ (REAL-TIME LIVE SEARCH)
   * - Sự kiện `"input"`: Kích hoạt NGAY LẬP TỨC mỗi khi người dùng gõ, xóa, hoặc dán một ký tự vào ô text.
   * - So sánh với `"change"`: Sự kiện `"change"` chỉ kích hoạt khi người dùng bấm chuột ra ngoài ô (mất focus),
   *   trong khi `"input"` phản hồi ngay theo từng phím gõ, mang lại trải nghiệm mượt mà.
   */
  relicSearchInput.addEventListener("input", (e) => {
    state.filterRelicQuery = e.target.value.toLowerCase().trim();
    renderRelicsTable(); // Vẽ lại bảng ngay lập tức với từ khóa lọc mới
  });

  // Khi click nút "Thêm dòng ghi chú", tạo thêm một ô input động vào form
  btnAddNoteRow.addEventListener("click", () => {
    addNoteRow("");
  });

  /**
   * 📚 GIẢI THÍCH: XỬ LÝ GỬI FORM LƯU BẢO VẬT (THÊM MỚI HOẶC CẬP NHẬT)
   * - `relicForm.addEventListener("submit", ...)`
   * - Gom toàn bộ giá trị từ các ô input qua `document.getElementById(...).value`.
   * - Đóng gói thành đối tượng JavaScript `relicData`.
   * - Gửi đến API endpoint `POST /api/relics`.
   */
  relicForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Chặn tải lại trang

    // Lấy ID hiện tại (nếu đang sửa) hoặc sinh ID mới ngẫu nhiên theo thời gian `relic_...` (nếu thêm mới)
    const id = document.getElementById("relicFormId").value.trim() || ("relic_" + Date.now());
    const title = document.getElementById("relicFormTitle").value.trim();
    const era = document.getElementById("relicFormEra").value.trim();
    const badge = document.getElementById("relicFormBadge").value.trim();
    const location = document.getElementById("relicFormLocation").value.trim();
    const image = document.getElementById("relicFormImage").value.trim();
    const material = document.getElementById("relicFormMaterial").value.trim();
    const dims = document.getElementById("relicFormDims").value.trim();
    const discovery = document.getElementById("relicFormDiscovery").value.trim();
    const desc = document.getElementById("relicFormDesc").value.trim();
    const significance = document.getElementById("relicFormSignificance").value.trim();

    /**
     * 📚 GIẢI THÍCH: `Array.from` VÀ `filter(Boolean)`
     * - `document.querySelectorAll(".note-input-item")`: Lấy danh sách các ô input ghi chép động.
     * - `Array.from(...)`: Chuyển NodeList thành mảng JavaScript chuẩn để dùng hàm `.map()`.
     * - `.map(i => i.value.trim())`: Trích xuất chuỗi chữ từ từng ô input.
     * - `.filter(Boolean)`: Loại bỏ các chuỗi rỗng `""` để không lưu các dòng trống vào cơ sở dữ liệu.
     */
    const noteInputs = document.querySelectorAll(".note-input-item");
    const notes = Array.from(noteInputs).map(i => i.value.trim()).filter(Boolean);

    // Đối tượng dữ liệu Bảo vật hoàn chỉnh
    const relicData = {
      id,
      title,
      era,
      badge,
      location,
      image,
      material,
      dims,
      discovery,
      desc,
      significance,
      notes,
      highlights: [era, material, location].filter(Boolean)
    };

    try {
      // Gửi request POST tới máy chủ REST API
      const res = await authFetch("/api/relics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relic: relicData })
      });
      if (res.status === 401) return; // Nếu token hết hạn, authFetch đã xử lý đăng xuất
      const data = await res.json();

      if (data.success) {
        // Cập nhật lại danh sách trong state từ dữ liệu server trả về
        state.relics = data.relics;
        updateKpis();          // Cập nhật lại số lượng trên thẻ KPI
        renderRelicsTable();   // Vẽ lại bảng danh sách
        closeModal("relicModal"); // Đóng popup modal
        showToast("Đã lưu hồ sơ Bảo vật Quốc gia thành công!", "success");
      } else {
        showToast(data.message || "Lỗi lưu bảo vật", "error");
      }
    } catch (err) {
      showToast("Lỗi khi kết nối đến máy chủ", "error");
    }
  });
}

/**
 * 📚 GIẢI THÍCH: HÀM KẾT XUẤT BẢNG BẢO VẬT (`renderRelicsTable`)
 * - Kỹ thuật: DOM Manipulation động (Dynamic DOM Creation).
 * - Luồng thực hiện:
 *   1. Làm rỗng thẻ `<tbody>` bằng `tbody.innerHTML = ""`.
 *   2. Lọc mảng `state.relics` theo chuỗi từ khóa `filterRelicQuery`.
 *   3. Duyệt qua từng phần tử bằng `forEach()`.
 *   4. Tạo thẻ dòng mới: `const tr = document.createElement("tr")`.
 *   5. Chèn nội dung các cột `<td>` qua Template Literal và hàm an toàn `escapeHtml()`.
 *   6. Gắn vào bảng: `tbody.appendChild(tr)`.
 *   7. Gắn các sự kiện click cho nút "SỬA" và "XÓA" trên từng dòng.
 */
function renderRelicsTable() {
  const tbody = document.getElementById("relicsTbody");
  const countEl = document.getElementById("relicFilterCount");
  tbody.innerHTML = ""; // Xóa dữ liệu cũ để tránh trùng lặp

  // Thuật toán lọc tìm kiếm theo nhiều trường (Tên, niên đại, chất liệu, địa điểm)
  const q = state.filterRelicQuery;
  const filtered = state.relics.filter(r => {
    if (!q) return true; // Nếu ô tìm kiếm rỗng thì hiển thị tất cả
    return (
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.era && r.era.toLowerCase().includes(q)) ||
      (r.material && r.material.toLowerCase().includes(q)) ||
      (r.location && r.location.toLowerCase().includes(q))
    );
  });

  // Hiển thị bộ đếm số lượng kết quả tìm thấy
  countEl.textContent = `Đang hiển thị ${filtered.length} / ${state.relics.length} bảo vật`;

  // Nếu không có kết quả nào khớp với từ khóa
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: #64748b;">Không tìm thấy bảo vật nào khớp với từ khóa tìm kiếm.</td></tr>`;
    return;
  }

  // Duyệt qua từng bảo vật đã lọc để tạo cấu trúc hàng bảng <tr>
  filtered.forEach(relic => {
    const tr = document.createElement("tr"); // Tạo thẻ <tr> trong bộ nhớ
    tr.innerHTML = `
      <td>
        <img src="${escapeHtml(relic.image)}" class="table-thumb" alt="${escapeHtml(relic.title)}" onerror="this.src='images/relics/trongdong.jpg'">
      </td>
      <td>
        <div class="table-title">${escapeHtml(relic.title)}</div>
        <div class="table-sub">${escapeHtml(relic.era)}</div>
      </td>
      <td>
        <span class="table-badge">${escapeHtml(relic.badge || "Bảo vật Quốc gia")}</span>
      </td>
      <td>${escapeHtml(relic.location || "Đang cập nhật")}</td>
      <td>
        <div><strong>Kích thước:</strong> ${escapeHtml(relic.dims || "—")}</div>
        <div style="font-size: 11px; color: #94a3b8;"><strong>Chất liệu:</strong> ${escapeHtml(relic.material || "—")}</div>
      </td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-icon-edit" data-edit-relic="${relic.id}">SỬA</button>
          <button class="btn-icon-del" data-del-relic="${relic.id}">XÓA</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr); // Đưa thẻ <tr> vào cây DOM thực tế
  });

  /**
   * 📚 GIẢI THÍCH: GẮN SỰ KIỆN CHO CÁC NÚT ĐỘNG (DYNAMIC BUTTON EVENT BINDING)
   * - Vì các nút này vừa được tạo ra bằng `document.createElement`, chúng ta phải gắn `addEventListener`
   *   bằng cách truy vấn `tbody.querySelectorAll("[data-edit-relic]")`.
   */
  tbody.querySelectorAll("[data-edit-relic]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-relic");
      // Dùng hàm `.find()` của mảng ES6 để tìm đối tượng bảo vật có ID khớp
      const relic = state.relics.find(r => r.id === id);
      if (relic) openRelicModal(relic); // Mở modal ở chế độ chỉnh sửa
    });
  });

  tbody.querySelectorAll("[data-del-relic]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-relic");
      deleteRelic(id); // Gọi hàm xóa bảo vật
    });
  });
}

/**
 * 📚 GIẢI THÍCH: HÀM MỞ MODAL BẢO VẬT (`openRelicModal`)
 * - Tham số mặc định `relic = null`:
 *   + Nếu `relic === null`: Người dùng bấm nút "Thêm mới", form sẽ được reset trắng.
 *   + Nếu `relic` là một Object: Người dùng bấm "Sửa", các ô input sẽ được tự động điền (populate) dữ liệu cũ.
 * 
 * @param {object|null} relic - Đối tượng bảo vật cần sửa hoặc null nếu thêm mới
 */
function openRelicModal(relic = null) {
  const modal = document.getElementById("relicModal");
  const modalTitle = document.getElementById("relicModalTitle");
  const form = document.getElementById("relicForm");
  const notesContainer = document.getElementById("notesContainer");

  // `form.reset()`: Phương thức của thẻ <form> đưa tất cả ô input về giá trị mặc định ban đầu
  form.reset();
  notesContainer.innerHTML = ""; // Xóa các dòng ghi chú cũ

  if (relic) {
    // CHẾ ĐỘ CHỈNH SỬA: Điền dữ liệu của bảo vật vào từng ô input thông qua thuộc tính `.value`
    modalTitle.textContent = "CHỈNH SỬA HỒ SƠ: " + relic.title;
    document.getElementById("relicFormId").value = relic.id;
    document.getElementById("relicFormTitle").value = relic.title || "";
    document.getElementById("relicFormEra").value = relic.era || "";
    document.getElementById("relicFormBadge").value = relic.badge || "";
    document.getElementById("relicFormLocation").value = relic.location || "";
    document.getElementById("relicFormImage").value = relic.image || "";
    document.getElementById("relicFormMaterial").value = relic.material || "";
    document.getElementById("relicFormDims").value = relic.dims || "";
    document.getElementById("relicFormDiscovery").value = relic.discovery || "";
    document.getElementById("relicFormDesc").value = relic.desc || "";
    document.getElementById("relicFormSignificance").value = relic.significance || "";

    // Điền danh sách ghi chép khảo cổ học
    if (Array.isArray(relic.notes) && relic.notes.length > 0) {
      relic.notes.forEach(n => addNoteRow(n));
    } else {
      addNoteRow("");
    }
    // Cập nhật ảnh xem trước
    updateRelicImagePreview(relic.image || "");
  } else {
    // CHẾ ĐỘ THÊM MỚI
    modalTitle.textContent = "THÊM BẢO VẬT QUỐC GIA MỚI";
    document.getElementById("relicFormId").value = "";
    document.getElementById("relicFormImage").value = "";
    addNoteRow("");
    updateRelicImagePreview("");
  }

  // Hiển thị modal lên màn hình
  modal.hidden = false;
  modal.style.display = "flex";
}

// ==============================================================================
// 5.5 XỬ LÝ UPLOAD & XEM TRƯỚC ẢNH HIỆN VẬT (IMAGE UPLOAD & PREVIEW ENGINE)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `initRelicImageUploader`
 * - Tính năng: Hỗ trợ 2 chế độ chọn ảnh:
 *   1. Chế độ tải file: Chọn file từ máy tính hoặc kéo thả (Drag & Drop) vào khung.
 *   2. Chế độ nhập URL: Dán trực tiếp đường link ảnh trên mạng (http/https) hoặc chọn từ danh sách có sẵn.
 * - Các sự kiện Drag and Drop (HTML5 Drag & Drop API):
 *   + `dragover`: Kích hoạt khi rê file qua khung. BẮT BUỘC gọi `e.preventDefault()` để cho phép thả file!
 *   + `dragleave`: Kích hoạt khi rê file ra khỏi khung (để tắt hiệu ứng viền sáng).
 *   + `drop`: Kích hoạt khi nhả chuột thả file vào. Dữ liệu file nằm trong `e.dataTransfer.files[0]`.
 */
function initRelicImageUploader() {
  const fileInput = document.getElementById("relicImageFileInput");
  const urlInput = document.getElementById("relicFormImage");
  const dropzone = document.getElementById("relicDropzone");
  const btnClear = document.getElementById("btnClearRelicImage");

  // Khi người dùng bấm nút duyệt file truyền thống
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      // `e.target.files`: Danh sách FileList chứa các file được chọn từ hộp thoại máy tính
      const file = e.target.files && e.target.files[0];
      if (file) handleRelicFileSelected(file);
    });
  }

  // Xử lý kéo thả tệp vào Dropzone
  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault(); // Ngăn trình duyệt tự động mở tệp ảnh sang tab mới
      dropzone.classList.add("dragover"); // Thêm class CSS đổi màu viền khi đang kéo
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover"); // Gỡ class khi rê ra ngoài
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault(); // Ngăn trình duyệt mở ảnh sang tab mới
      dropzone.classList.remove("dragover");
      // `e.dataTransfer.files`: Trích xuất file từ luồng kéo thả của hệ điều hành
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleRelicFileSelected(file);
    });
  }

  // Khi người dùng gõ hoặc dán URL vào ô text
  if (urlInput) {
    urlInput.addEventListener("input", (e) => {
      updateRelicImagePreview(e.target.value.trim()); // Cập nhật ảnh xem trước tức thì
    });
    urlInput.addEventListener("change", (e) => {
      updateRelicImagePreview(e.target.value.trim());
    });
  }

  // Nút xóa ảnh hiện tại
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      if (urlInput) urlInput.value = "";
      if (fileInput) fileInput.value = "";
      updateRelicImagePreview("");
      if (urlInput) urlInput.focus();
    });
  }
}

/**
 * 📚 GIẢI THÍCH: HÀM `handleRelicFileSelected` VÀ `FileReader`
 * - `FileReader`: Đối tượng chuẩn của HTML5 File API cho phép đọc nội dung tệp tin từ máy người dùng.
 * - `reader.readAsDataURL(file)`: Đọc dữ liệu nhị phân của ảnh và chuyển đổi thành chuỗi Base64 Data URL
 *   (chuỗi bắt đầu bằng `data:image/jpeg;base64,...`).
 * - Ưu điểm: Hiển thị ngay ảnh lên khung xem trước trong tích tắc mà chưa cần chờ tải lên mạng.
 * - Sau đó: Gửi chuỗi ảnh lên máy chủ qua API `POST /api/upload` để server lưu thành tệp thực tế trong thư mục `/images/relics/`.
 * 
 * @param {File} file - Đối tượng tệp tin người dùng vừa chọn
 */
async function handleRelicFileSelected(file) {
  if (!file) return;

  // Kiểm tra định dạng đuôi tệp bằng biểu thức chính quy (Regex)
  if (!file.type.startsWith("image/") && !/\.(jpg|jpeg|png|webp|svg|gif)$/i.test(file.name)) {
    showToast("Vui lòng chọn một tệp hình ảnh (.jpg, .png, .webp, .svg)", "error");
    return;
  }

  const reader = new FileReader(); // Khởi tạo bộ đọc tệp HTML5
  reader.onload = async (ev) => {
    // `ev.target.result` chứa chuỗi Base64 Data URL của ảnh
    const dataUrl = ev.target.result;

    // Hiển thị ngay ảnh xem trước bằng Base64 để người dùng thấy tức thì
    updateRelicImagePreview(dataUrl, `Đang tải tệp "${file.name}" lên máy chủ...`, "loading");

    try {
      // Gửi yêu cầu tải ảnh lên Server Node.js
      const res = await authFetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          data: dataUrl
        })
      });

      const data = await res.json();
      if (data.success && data.url) {
        // Tải lên thành công: Điền đường dẫn file tĩnh do máy chủ lưu vào ô input
        document.getElementById("relicFormImage").value = data.url;
        updateRelicImagePreview(data.url, `Đã tải lên máy chủ: ${data.url}`, "");
        showToast("Tải ảnh hiện vật lên máy chủ thành công!", "success");
        fetchExistingImages(); // Cập nhật lại danh sách gợi ý ảnh
      } else {
        // Fallback: Nếu máy chủ chưa hỗ trợ hoặc offline, lưu base64 dataUrl trực tiếp
        document.getElementById("relicFormImage").value = dataUrl;
        updateRelicImagePreview(dataUrl, `Dùng tệp ảnh trực tiếp (${file.name})`, "");
        showToast("Đã lưu ảnh tệp vào hồ sơ!", "success");
      }
    } catch (err) {
      document.getElementById("relicFormImage").value = dataUrl;
      updateRelicImagePreview(dataUrl, `Dùng tệp ảnh trực tiếp (${file.name})`, "");
      showToast("Đã lưu ảnh tệp vào hồ sơ!", "success");
    }
  };
  // Bắt đầu đọc tệp tin
  reader.readAsDataURL(file);
}

/**
 * 📚 GIẢI THÍCH: HÀM `updateRelicImagePreview`
 * - Gán link ảnh vào thẻ `<img>` để xem trước.
 * - Sử dụng các sự kiện vòng đời ảnh của trình duyệt:
 *   + `imgEl.onload`: Kích hoạt khi ảnh tải thành công, cập nhật nhãn trạng thái xanh.
 *   + `imgEl.onerror`: Kích hoạt nếu link hỏng / ảnh 404, hiển thị cảnh báo đỏ cho người dùng.
 */
function updateRelicImagePreview(url, customStatus = null, customClass = "") {
  const imgEl = document.getElementById("relicImagePreview");
  const statusEl = document.getElementById("relicPreviewStatus");
  if (!imgEl || !statusEl) return;

  const trimmed = (url || "").trim();

  // Nếu chưa có ảnh: Dùng ảnh mặc định Trống đồng
  if (!trimmed) {
    imgEl.src = "images/relics/trongdong.jpg";
    statusEl.textContent = customStatus || "Chưa có ảnh (Chọn tệp hoặc dán link)";
    statusEl.className = "preview-status-badge" + (customClass ? ` ${customClass}` : " error");
    return;
  }

  // Bắt sự kiện tải ảnh thành công
  imgEl.onload = () => {
    if (customStatus) {
      statusEl.textContent = customStatus;
      statusEl.className = "preview-status-badge" + (customClass ? ` ${customClass}` : "");
    } else if (trimmed.startsWith("data:image/")) {
      statusEl.textContent = "Ảnh tệp tải lên (Dữ liệu nội tuyến)";
      statusEl.className = "preview-status-badge";
    } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      statusEl.textContent = "Link ảnh trực tuyến (Web URL)";
      statusEl.className = "preview-status-badge";
    } else if (trimmed.startsWith("images/")) {
      statusEl.textContent = `Thư mục bảo tàng: ${trimmed}`;
      statusEl.className = "preview-status-badge";
    } else {
      statusEl.textContent = `Đường dẫn ảnh: ${trimmed}`;
      statusEl.className = "preview-status-badge";
    }
  };

  // Bắt sự kiện lỗi không tải được ảnh
  imgEl.onerror = () => {
    statusEl.textContent = "Không tải được ảnh! Vui lòng kiểm tra lại link hoặc tệp.";
    statusEl.className = "preview-status-badge error";
  };

  // Gán đường dẫn ảnh vào thuộc tính .src của thẻ <img>
  imgEl.src = trimmed;
}

/**
 * Lấy danh sách các tệp ảnh đã tồn tại trên server để gợi ý vào thẻ <datalist>
 */
async function fetchExistingImages() {
  try {
    const res = await fetch("/api/images");
    const data = await res.json();
    if (data.success && Array.isArray(data.images)) {
      const datalist = document.getElementById("existingRelicImages");
      if (datalist) {
        datalist.innerHTML = data.images.map(img => `<option value="${escapeHtml(img)}"></option>`).join("");
      }
    }
  } catch (e) {}
}

/**
 * 📚 GIẢI THÍCH: HÀM `addNoteRow` (TẠO DÒNG NHẬP LIỆU ĐỘNG)
 * - `document.createElement("div")`: Tạo thẻ <div> bao bọc.
 * - `div.querySelector(".btn-row-del").addEventListener(...)`: Bắt sự kiện click vào nút X để tự xóa dòng này.
 * - `div.remove()`: Phương thức của DOM node tự xóa chính nó khỏi cây DOM mà không cần gọi parentNode.removeChild().
 */
function addNoteRow(content = "") {
  const notesContainer = document.getElementById("notesContainer");
  const div = document.createElement("div");
  div.className = "dynamic-row";
  div.innerHTML = `
    <input type="text" class="form-input note-input-item" style="flex:1;" placeholder="Ghi chép khảo cổ học chi tiết..." value="${escapeHtml(content)}">
    <button type="button" class="btn-row-del" title="Xóa dòng">&times;</button>
  `;
  // Khi ấn nút X, xóa thẻ div này khỏi DOM
  div.querySelector(".btn-row-del").addEventListener("click", () => div.remove());
  notesContainer.appendChild(div);
}

/**
 * 📚 GIẢI THÍCH: HÀM `deleteRelic` (XÓA BẢO VẬT)
 * - `window.confirm(msg)`: Hiển thị hộp thoại cảnh báo xác nhận của trình duyệt (trả về true nếu chọn OK, false nếu Cancel).
 * - `encodeURIComponent(id)`: Mã hóa các ký tự đặc biệt trong ID để ghép an toàn vào Query String URL.
 * - Gọi HTTP DELETE tới API `/api/relics?id=...`.
 * 
 * @param {string} id - Mã định danh của bảo vật cần xóa
 */
async function deleteRelic(id) {
  const relic = state.relics.find(r => r.id === id);
  const name = relic ? relic.title : id;
  // Hỏi xác nhận người dùng trước khi thực hiện hành động xóa không thể khôi phục
  if (!confirm(`Bạn có chắc chắn muốn xóa bảo vật "${name}" khỏi bảo tàng không?`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/relics?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.success) {
      state.relics = data.relics; // Cập nhật lại mảng trong State
      updateKpis();              // Cập nhật số lượng
      renderRelicsTable();       // Vẽ lại bảng sau khi xóa
      showToast("Đã xóa bảo vật thành công!", "success");
    } else {
      showToast(data.message || "Lỗi xóa bảo vật", "error");
    }
  } catch (err) {
    showToast("Không thể kết nối máy chủ", "error");
  }
}

// ==============================================================================
// 6. QUẢN LÝ CUỘN BĂNG TƯ LIỆU VHS (TAPES CRUD - CREATE, READ, UPDATE, DELETE)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `initTapeEvents`
 * - Gắn sự kiện mở modal thêm cuộn băng và xử lý submit form lưu cuộn băng lịch sử vào phòng 3D.
 */
function initTapeEvents() {
  const btnOpenAddTape = document.getElementById("btnOpenAddTapeModal");
  const tapeForm = document.getElementById("tapeForm");

  // Mở modal thêm cuộn băng mới
  btnOpenAddTape.addEventListener("click", () => openTapeModal());

  /**
   * 📚 GIẢI THÍCH: XỬ LÝ SUBMIT BIỂU MẪU CUỘN BĂNG
   * - Ngăn tải lại trang bằng `e.preventDefault()`.
   * - Gom dữ liệu từ các input và textarea: Tiêu đề, năm, trích dẫn danh ngôn, màu sắc nhãn băng.
   * - Xử lý chuỗi từ khóa lớn `big`: Dùng `.split(",")` tách chuỗi thành mảng, `.map(s => s.trim())` xóa khoảng trắng thừa.
   */
  tapeForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Chặn hành vi tải lại trang mặc định của form

    // Lấy ID hiện có hoặc tự sinh ID ngẫu nhiên `tape_<timestamp>`
    const id = document.getElementById("tapeFormId").value.trim() || ("tape_" + Date.now());
    const t = document.getElementById("tapeFormTitle").value.trim();
    const y = document.getElementById("tapeFormYear").value.trim();
    const era = document.getElementById("tapeFormEra").value.trim();
    const videoUrl = document.getElementById("tapeFormVideoUrl").value.trim();
    const d = document.getElementById("tapeFormDesc").value.trim();
    const quote = document.getElementById("tapeFormQuote").value.trim();
    const quoteAuthor = document.getElementById("tapeFormAuthor").value.trim();
    const sceneType = document.getElementById("tapeFormScene").value;
    const bg = document.getElementById("tapeFormBg").value;
    const ink = document.getElementById("tapeFormInk").value;
    
    // Tách chuỗi từ khóa lớn thành mảng
    const bigRaw = document.getElementById("tapeFormBig").value;
    const big = bigRaw.split(",").map(s => s.trim()).filter(Boolean);

    // Đóng gói đối tượng Cuộn băng tư liệu
    const tapeData = {
      id,
      t,
      y,
      era,
      videoUrl,
      d,
      quote,
      quoteAuthor,
      sceneType,
      bg,
      ink,
      big: big.length > 0 ? big : [t],
      videoDuration: 40,
      highlights: [era, y]
    };

    try {
      // Gửi yêu cầu lưu dữ liệu cuộn băng qua API POST /api/tapes
      const res = await authFetch("/api/tapes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tape: tapeData })
      });
      if (res.status === 401) return;
      const data = await res.json();

      if (data.success) {
        state.tapes = data.tapes; // Cập nhật mảng cuộn băng trong state
        updateKpis();            // Cập nhật số liệu KPI
        renderTapesTable();      // Vẽ lại bảng danh sách
        closeModal("tapeModal"); // Đóng modal
        showToast("Đã lưu cuộn băng tư liệu thành công!", "success");
      } else {
        showToast(data.message || "Lỗi lưu cuộn băng", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối máy chủ", "error");
    }
  });
}

/**
 * 📚 GIẢI THÍCH: HÀM KẾT XUẤT BẢNG CUỘN BĂNG VHS (`renderTapesTable`)
 * - Duyệt qua mảng `state.tapes` và tạo các hàng `<tr>` động.
 * - Phân loại nguồn phát:
 *   + Nếu có `videoUrl`: Hiển thị huy hiệu "Video MP4" kèm icon Play.
 *   + Nếu không có: Hiển thị huy hiệu "Sa Bàn 3D" (kết xuất mô phỏng 3D thời gian thực trên Three.js).
 */
function renderTapesTable() {
  const tbody = document.getElementById("tapesTbody");
  tbody.innerHTML = ""; // Xóa dữ liệu cũ

  state.tapes.forEach((tape, idx) => {
    const tr = document.createElement("tr");
    const hasVideo = tape.videoUrl && tape.videoUrl.trim() !== "";
    const sourceBadge = hasVideo 
      ? `<span class="table-badge"><svg class="badge-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Video MP4</span>`
      : `<span class="table-badge badge-scene"><svg class="badge-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>Sa Bàn 3D</span>`;

    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 16px; color: var(--gold-light);">
        BĂNG ${String(idx + 1).padStart(2, "0")}
      </td>
      <td>
        <div class="table-title">${escapeHtml(tape.t)}</div>
        <div class="table-sub">${escapeHtml(tape.y)}</div>
      </td>
      <td>${escapeHtml(tape.era || "Thời kỳ lịch sử")}</td>
      <td>
        ${sourceBadge}
        <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">${escapeHtml(tape.videoUrl || "Mô phỏng chiến thuật")}</div>
      </td>
      <td style="font-style: italic; max-width: 280px; font-size: 12px;">
        "${escapeHtml(tape.quote || "—")}"
      </td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-icon-edit" data-edit-tape="${tape.id}">SỬA</button>
          <button class="btn-icon-del" data-del-tape="${tape.id}">XÓA</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr); // Đưa hàng mới vào cây DOM
  });

  // Gắn sự kiện click cho các nút Sửa và Xóa cuộn băng
  tbody.querySelectorAll("[data-edit-tape]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-tape");
      const tape = state.tapes.find(t => t.id === id);
      if (tape) openTapeModal(tape);
    });
  });

  tbody.querySelectorAll("[data-del-tape]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-tape");
      deleteTape(id);
    });
  });
}

/**
 * 📚 GIẢI THÍCH: HÀM MỞ MODAL CUỘN BĂNG (`openTapeModal`)
 * - Điền dữ liệu cuộn băng cũ vào form nếu đang ở chế độ chỉnh sửa, hoặc đặt giá trị mặc định nếu thêm mới.
 */
function openTapeModal(tape = null) {
  const modal = document.getElementById("tapeModal");
  const modalTitle = document.getElementById("tapeModalTitle");
  const form = document.getElementById("tapeForm");

  form.reset();

  if (tape) {
    // Chế độ chỉnh sửa
    modalTitle.textContent = "CHỈNH SỬA CUỘN BĂNG: " + tape.t;
    document.getElementById("tapeFormId").value = tape.id;
    document.getElementById("tapeFormTitle").value = tape.t || "";
    document.getElementById("tapeFormYear").value = tape.y || "";
    document.getElementById("tapeFormEra").value = tape.era || "";
    document.getElementById("tapeFormVideoUrl").value = tape.videoUrl || "";
    document.getElementById("tapeFormDesc").value = tape.d || "";
    document.getElementById("tapeFormQuote").value = tape.quote || "";
    document.getElementById("tapeFormAuthor").value = tape.quoteAuthor || "";
    document.getElementById("tapeFormScene").value = tape.sceneType || "generic";
    document.getElementById("tapeFormBg").value = tape.bg || "#132d4a";
    document.getElementById("tapeFormInk").value = tape.ink || "#d6ebff";
    document.getElementById("tapeFormBig").value = Array.isArray(tape.big) ? tape.big.join(", ") : (tape.big || "");
  } else {
    // Chế độ thêm mới
    modalTitle.textContent = "THÊM CUỘN BĂNG LỊCH SỬ MỚI";
    document.getElementById("tapeFormId").value = "";
    document.getElementById("tapeFormBg").value = "#132d4a";
    document.getElementById("tapeFormInk").value = "#d6ebff";
  }

  modal.hidden = false;
  modal.style.display = "flex";
}

/**
 * 📚 GIẢI THÍCH: HÀM XÓA CUỘN BĂNG (`deleteTape`)
 * - Xác nhận bằng `confirm()`, sau đó gửi HTTP DELETE đến endpoint `/api/tapes?id=...`.
 */
async function deleteTape(id) {
  const tape = state.tapes.find(t => t.id === id);
  const name = tape ? tape.t : id;
  if (!confirm(`Bạn có chắc chắn muốn xóa cuộn băng "${name}" khỏi phòng 3D không?`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/tapes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.success) {
      state.tapes = data.tapes;
      updateKpis();
      renderTapesTable();
      showToast("Đã xóa cuộn băng thành công!", "success");
    } else {
      showToast(data.message || "Lỗi xóa cuộn băng", "error");
    }
  } catch (err) {
    showToast("Không thể kết nối máy chủ", "error");
  }
}

// ==============================================================================
// 7. CẤU HÌNH KHÔNG GIAN 3D & CRT (STUDIO SETTINGS)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `initSettingsEvents`
 * - Thu thập cấu hình giao diện: Tên phòng chiếu, kênh mặc định, âm lượng, quét dòng CRT scanlines, CRT Bloom.
 * - `parseFloat(...)`: Hàm của JavaScript chuyển đổi chuỗi chữ thành số thực dấu phẩy động (Float).
 * - `checkbox.checked`: Thuộc tính boolean của thẻ `<input type="checkbox">` (trả về true nếu được tích, false nếu không).
 */
function initSettingsEvents() {
  const btnSaveSettings = document.getElementById("btnSaveSettings");

  btnSaveSettings.addEventListener("click", async () => {
    const newSettings = {
      studioName: document.getElementById("settingStudioName").value.trim(),
      defaultChannel: document.getElementById("settingDefaultChannel").value,
      defaultVolume: parseFloat(document.getElementById("settingDefaultVolume").value) || 0.85,
      crtScanlines: document.getElementById("settingCrtScanlines").checked,
      crtBloom: document.getElementById("settingCrtBloom").checked,
      musicEnabled: document.getElementById("settingMusicEnabled").checked
    };

    const pinInput = document.getElementById("settingAdminPin").value.trim();
    if (pinInput) {
      newSettings.adminPin = pinInput; // Cập nhật mã PIN quản trị mới nếu có nhập
    }

    try {
      const res = await authFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings })
      });
      if (res.status === 401) return;
      const data = await res.json();
      if (data.success) {
        state.settings = data.settings;
        showToast("Đã lưu toàn bộ cấu hình không gian 3D!", "success");
      } else {
        showToast(data.message || "Lỗi lưu cấu hình", "error");
      }
    } catch (err) {
      showToast("Không thể kết nối máy chủ", "error");
    }
  });
}

/**
 * Điền các giá trị cài đặt hiện có vào form
 */
function populateSettingsForm() {
  const s = state.settings || {};
  document.getElementById("settingStudioName").value = s.studioName || "Bảo tàng Lịch sử & Không gian CRT 3D Việt Nam";
  document.getElementById("settingDefaultChannel").value = s.defaultChannel || "relics";
  document.getElementById("settingDefaultVolume").value = s.defaultVolume !== undefined ? s.defaultVolume : 0.85;
  document.getElementById("settingCrtScanlines").checked = s.crtScanlines !== false;
  document.getElementById("settingCrtBloom").checked = s.crtBloom !== false;
  document.getElementById("settingMusicEnabled").checked = s.musicEnabled !== false;
  // Để trống ô mã PIN bảo mật khi hiển thị form để tránh bị lộ mật khẩu
  document.getElementById("settingAdminPin").value = "";
}

// ==============================================================================
// 8. SAO LƯU & PHỤC HỒI (BACKUP & RESTORE DATABASE)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `initBackupEvents`
 * - Sao lưu (Export JSON): Gán `window.location.href = "/api/export"` để trình duyệt tự động kích hoạt tải xuống file `vietnam-history-db-backup.json`.
 * - Phục hồi (Import JSON): Dùng `FileReader.readAsText(file)` để đọc chuỗi văn bản JSON, sau đó `JSON.parse()` và gửi lên `/api/import`.
 * - Đặt lại mặc định (Reset Database): Gọi `/api/reset` để khôi phục dữ liệu 7 Bảo vật và 11 cuộn băng ban đầu.
 */
function initBackupEvents() {
  const fileInput = document.getElementById("importFileInput");
  const fileNameDisplay = document.getElementById("importFileName");
  const btnConfirmImport = document.getElementById("btnConfirmImport");
  const btnResetDefaults = document.getElementById("btnResetDefaults");
  const qaExport = document.getElementById("qaExport");

  // Nút xuất dữ liệu JSON (Export)
  qaExport?.addEventListener("click", () => {
    window.location.href = "/api/export";
  });

  // Khi người dùng chọn file sao lưu từ máy tính
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      fileNameDisplay.textContent = fileInput.files[0].name;
      btnConfirmImport.disabled = false; // Mở khóa nút bấm khôi phục
    } else {
      fileNameDisplay.textContent = "Chưa chọn tệp tin";
      btnConfirmImport.disabled = true;
    }
  });

  // Nút xác nhận khôi phục từ tệp tin
  btnConfirmImport.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // `JSON.parse(...)`: Phân tích chuỗi văn bản thành đối tượng JavaScript
        const json = JSON.parse(e.target.result);
        const res = await authFetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json)
        });
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
          showToast("Khôi phục cơ sở dữ liệu thành công!", "success");
          fileInput.value = "";
          fileNameDisplay.textContent = "Chưa chọn tệp tin";
          btnConfirmImport.disabled = true;
          loadAllData(); // Tải lại giao diện với dữ liệu mới khôi phục
        } else {
          showToast(data.message || "Tệp sao lưu không hợp lệ", "error");
        }
      } catch (err) {
        showToast("Tệp JSON không đúng định dạng", "error");
      }
    };
    reader.readAsText(file); // Đọc nội dung tệp dưới dạng chuỗi văn bản UTF-8
  });

  // Nút khôi phục dữ liệu gốc của dự án (Reset to Defaults)
  btnResetDefaults.addEventListener("click", async () => {
    if (!confirm("CẢNH BÁO: Thao tác này sẽ đưa toàn bộ 7 Bảo vật Quốc gia và các cuộn băng về trạng thái mặc định của dự án. Bạn có muốn tiếp tục không?")) {
      return;
    }
    try {
      const res = await authFetch("/api/reset", { method: "POST" });
      if (res.status === 401) return;
      const data = await res.json();
      if (data.success) {
        showToast("Đã khôi phục dữ liệu gốc thành công!", "success");
        loadAllData();
      }
    } catch (err) {
      showToast("Không thể thực hiện khôi phục", "error");
    }
  });
}

// ==============================================================================
// 9. QUẢN LÝ ĐÓNG / MỞ HỘP THOẠI MODAL (MODAL CONTROLLER)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `initModals`
 * - Gắn sự kiện đóng modal:
 *   1. Bấm nút có thuộc tính `data-close="modalId"`.
 *   2. Bấm chuột ra vùng mờ bên ngoài (Backdrop click).
 *   3. Bấm phím `Escape` trên bàn phím.
 */
function initModals() {
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close");
      closeModal(modalId);
    });
  });

  // Đóng khi click bên ngoài hộp thoại (Backdrop Click)
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop") && !e.target.classList.contains("auth-backdrop")) {
      e.target.hidden = true;
      e.target.style.display = "none";
    }
  });

  // Phím Escape để đóng modal nhanh
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const activeModals = document.querySelectorAll(".modal-backdrop:not(.auth-backdrop)");
      activeModals.forEach(m => {
        if (!m.hidden || m.style.display !== "none") {
          m.hidden = true;
          m.style.display = "none";
        }
      });
    }
  });
}

/**
 * Ẩn modal theo ID được truyền vào
 * @param {string} modalId - ID của phần tử modal cần đóng
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.hidden = true;
    modal.style.display = "none";
  }
}

// ==============================================================================
// 10. HỆ THỐNG THÔNG BÁO TỨC THÌ (TOAST NOTIFICATIONS)
// ==============================================================================

/**
 * 📚 GIẢI THÍCH: HÀM `showToast`
 * - Tạo một thông báo nhỏ (Toast) bay vào từ góc màn hình để phản hồi trạng thái cho người dùng.
 * - Tự động xóa khỏi DOM sau 4 giây bằng `setTimeout`.
 * 
 * @param {string} message - Nội dung thông báo
 * @param {"info"|"success"|"error"} type - Loại thông báo để đổi màu sắc CSS
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div"); // Tạo thẻ <div> mới
  toast.className = `toast toast-${type}`;

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "◆";
  toast.innerHTML = `<span style="font-weight:bold; color:var(--gold-light);">${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast); // Gắn thông báo vào khung chứa

  // Sau 4 giây (4000ms), áp dụng hiệu ứng trượt mờ dần và tự hủy phần tử
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300); // Xóa hoàn toàn khỏi DOM sau khi animation kết thúc
  }, 4000);
}

/**
 * 📚 GIẢI THÍCH: HÀM `escapeHtml` (PHÒNG CHỐNG TẤN CÔNG XSS - CROSS-SITE SCRIPTING)
 * - Khái niệm: XSS là lỗ hổng xảy ra khi người dùng nhập các đoạn mã HTML/JavaScript độc hại
 *   (ví dụ: `<script>alert('hack')</script>`), và trang web in thẳng chuỗi đó vào `innerHTML`.
 * - Cơ chế xử lý: Hàm này sử dụng hàm thay thế chuỗi `.replace()` với biểu thức chính quy (Regex)
 *   để chuyển các ký tự đặc biệt nguy hiểm thành các thực thể HTML an toàn (HTML Entities):
 *   + `&` -> `&amp;`
 *   + `<` -> `&lt;` (ngăn mở thẻ HTML mới)
 *   + `>` -> `&gt;` (ngăn đóng thẻ HTML)
 *   + `"` -> `&quot;` (ngăn phá vỡ chuỗi thuộc tính)
 *   + `'` -> `&#039;`
 * - Đây là tiêu chuẩn bảo mật bắt buộc của OWASP cho mọi ứng dụng web chuyên nghiệp.
 * 
 * @param {string} str - Chuỗi văn bản thô từ người dùng nhập
 * @returns {string} - Chuỗi văn bản đã được làm sạch an toàn
 */
function escapeHtml(str) {
  if (typeof str !== "string") return str || "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
