// ==============================================================================
// MÁY CHỦ BẢO MẬT & API QUẢN TRỊ BẢO TÀNG (HARDENED SERVER & SECURE CMS API)
// Dự án: Vietnam History CRT Experience (Không gian Bảo tàng Lịch sử CRT 3D)
// ==============================================================================
// Các lớp bảo mật nâng cao (Security Hardening):
// 1. CHỐNG PATH TRAVERSAL (CWE-22): Kiểm tra path.resolve() ngăn chặn đọc trộm file hệ thống
// 2. XÁC THỰC MẬT MÃ BEARER TOKEN (CWE-306): Sinh Token ngẫu nhiên bằng crypto.randomBytes(32)
//    và bắt buộc mọi API thay đổi dữ liệu (POST, DELETE) phải có Authorization Token
// 3. CHỐNG TẤN CÔNG DÒ MÃ PIN (Brute Force / CWE-307): Giới hạn tối đa 5 lần thử/IP
//    và tự động khóa tạm thời 15 phút nếu nhập sai liên tiếp (HTTP 429 Too Many Requests)
// 4. TIÊU CHUẨN OWASP SECURITY HEADERS: X-Content-Type-Options, X-Frame-Options (chống Clickjacking)
// 5. HTTP RANGE REQUEST (HTTP 206): Phát trực tuyến mượt mà video MP4/MP3 tài liệu
// ==============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Cổng lắng nghe
const PORT = process.env.PORT || 3000;

// Đường dẫn file cơ sở dữ liệu JSON và mã nguồn đồng bộ
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'history-db.json');
const DEFAULT_DB_FILE = path.join(DATA_DIR, 'history-db.default.json');
const HISTORY_JS_FILE = path.join(__dirname, 'vietnam-history-data.js');

// ==============================================================================
// HỆ THỐNG QUẢN LÝ PHIÊN & BẢO MẬT (SESSION & RATE LIMITING STATE)
// ==============================================================================
// Lưu trữ phiên đăng nhập hợp lệ trong bộ nhớ: token -> { createdAt, lastActive }
const activeSessions = new Map();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // Phiên sống trong 7 ngày

// Quản lý số lần đăng nhập sai theo IP: ip -> { count, lockedUntil }
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // Khóa 15 phút nếu sai quá 5 lần

/**
 * Lấy địa chỉ IP thực của Client (Hỗ trợ cả môi trường Render Proxy qua x-forwarded-for)
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Kiểm tra quyền hạn Quản trị viên dựa trên Bearer Token mật mã
 */
function isAuthorized(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !activeSessions.has(token)) return false;

  const session = activeSessions.get(token);
  // Kiểm tra thời gian hết hạn phiên
  if (Date.now() - session.createdAt > SESSION_TTL) {
    activeSessions.delete(token);
    return false;
  }
  session.lastActive = Date.now();
  return true;
}

// 2. Bảng ánh xạ loại tệp (MIME Types)
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream'
};

/**
 * Đọc cơ sở dữ liệu JSON an toàn
 */
function readDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[LỖI ĐỌC CƠ SỞ DỮ LIỆU]:', e);
  }
  return {
    settings: {
      studioName: 'Bảo tàng Lịch sử & Không gian CRT 3D Việt Nam',
      defaultChannel: 'relics',
      defaultVolume: 0.85,
      crtScanlines: true,
      crtBloom: true,
      musicEnabled: true,
      adminPin: 'admin123'
    },
    tapes: [],
    relics: []
  };
}

/**
 * Ghi cơ sở dữ liệu JSON và tự động đồng bộ sang vietnam-history-data.js
 */
function saveDatabase(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    
    // Đồng bộ sang tệp JavaScript ES module để các module Three.js và Bảo tàng tải tức thì
    const jsContent = `// ==============================================================================
// vietnam-history-data.js - CƠ SỞ DỮ LIỆU LỊCH SỬ VÀ BẢO VẬT QUỐC GIA VIỆT NAM
// Tự động đồng bộ hóa từ Trung tâm Quản trị Bảo tàng (Admin CMS)
// Cập nhật lần cuối: ${new Date().toLocaleString('vi-VN')}
// ==============================================================================

export const VIETNAM_TAPES = ${JSON.stringify(db.tapes || [], null, 2)};

export const VIETNAM_RELICS = ${JSON.stringify(db.relics || [], null, 2)};
`;
    fs.writeFileSync(HISTORY_JS_FILE, jsContent, 'utf8');
    return true;
  } catch (e) {
    console.error('[LỖI GHI CƠ SỞ DỮ LIỆU]:', e);
    return false;
  }
}

/**
 * Hàm phân tích cú pháp JSON an toàn kèm giới hạn kích thước Payload (Chống tràn bộ nhớ)
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) { // Giới hạn 25MB
        reject(new Error('Payload vượt quá kích thước cho phép'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

/**
 * Trả về phản hồi JSON tiêu chuẩn đính kèm các Header bảo mật OWASP
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// ==============================================================================
// 3. KHỞI TẠO MÁY CHỦ HTTP & BẢO VỆ ĐA LỚP
// ==============================================================================
const server = http.createServer(async (req, res) => {
  // Bổ sung các tiêu đề bảo mật an ninh trình duyệt cơ bản
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Phản hồi yêu cầu pre-flight OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ============================================================================
  // XỬ LÝ CÁC ĐƯỜNG DẪN REST API CHO TRANG ADMIN
  // ============================================================================
  if (pathname.startsWith('/api/')) {
    const db = readDatabase();

    // 1. [PUBLIC] Lấy dữ liệu công khai để hiển thị trên TV CRT và trang Bảo tàng
    if (pathname === '/api/data' && req.method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        settings: {
          studioName: db.settings?.studioName,
          defaultChannel: db.settings?.defaultChannel,
          defaultVolume: db.settings?.defaultVolume,
          crtScanlines: db.settings?.crtScanlines,
          crtBloom: db.settings?.crtBloom,
          musicEnabled: db.settings?.musicEnabled
        },
        relics: db.relics,
        tapes: db.tapes
      });
    }

    // 2. [BẢO MẬT] Đăng nhập Admin - Tích hợp Rate Limiting chống Brute Force
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const clientIp = getClientIp(req);
      const attempt = loginAttempts.get(clientIp);

      // Kiểm tra trạng thái khóa tạm thời nếu nhập sai nhiều lần
      if (attempt && attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
        const remainingMinutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
        return sendJson(res, 429, {
          success: false,
          message: `IP bị tạm khóa do nhập sai PIN quá ${MAX_LOGIN_ATTEMPTS} lần. Thử lại sau ${remainingMinutes} phút!`
        });
      }

      const body = await parseJsonBody(req);
      const validPin = (db.settings && db.settings.adminPin) ? db.settings.adminPin : 'admin123';

      if (body.pin === validPin) {
        // Đăng nhập thành công -> Xóa bộ đếm sai & Sinh Crypto Token 256-bit an toàn
        loginAttempts.delete(clientIp);
        const token = crypto.randomBytes(32).toString('hex');
        activeSessions.set(token, {
          createdAt: Date.now(),
          lastActive: Date.now(),
          ip: clientIp
        });

        return sendJson(res, 200, {
          success: true,
          token,
          message: 'Đăng nhập thành công'
        });
      } else {
        // Đăng nhập sai -> Tăng bộ đếm cảnh báo
        const cur = loginAttempts.get(clientIp) || { count: 0 };
        cur.count++;
        if (cur.count >= MAX_LOGIN_ATTEMPTS) {
          cur.lockedUntil = Date.now() + LOCKOUT_DURATION;
          loginAttempts.set(clientIp, cur);
          return sendJson(res, 429, {
            success: false,
            message: `Bạn đã nhập sai mã PIN ${MAX_LOGIN_ATTEMPTS} lần! Địa chỉ IP bị tạm khóa 15 phút.`
          });
        }
        loginAttempts.set(clientIp, cur);
        return sendJson(res, 401, {
          success: false,
          message: `Mã PIN bảo mật không đúng! Bạn còn ${MAX_LOGIN_ATTEMPTS - cur.count} lần thử.`
        });
      }
    }

    // --------------------------------------------------------------------------
    // CÁC TUYẾN API BẮT BUỘC PHẢI CÓ QUYỀN ADMIN (BEARER TOKEN AUTHENTICATION)
    // --------------------------------------------------------------------------
    const protectedApis = ['/api/relics', '/api/tapes', '/api/settings', '/api/import', '/api/reset', '/api/upload'];
    if (protectedApis.includes(pathname) && req.method !== 'OPTIONS') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, {
          success: false,
          message: 'Yêu cầu quyền Quản trị viên (401 Unauthorized). Vui lòng đăng nhập lại!'
        });
      }
    }

    // 3. Quản lý Bảo vật Quốc gia (Thêm mới / Cập nhật)
    if (pathname === '/api/relics' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.relic || !body.relic.title) {
        return sendJson(res, 400, { success: false, message: 'Dữ liệu bảo vật không hợp lệ' });
      }

      const relic = body.relic;
      // Tạo ID an toàn, loại bỏ ký tự lạ
      if (!relic.id) {
        relic.id = 'relic_' + Date.now();
      } else {
        relic.id = String(relic.id).replace(/[^a-zA-Z0-9_-]/g, '');
      }

      const existingIndex = db.relics.findIndex(r => r.id === relic.id);
      if (existingIndex >= 0) {
        db.relics[existingIndex] = relic;
      } else {
        db.relics.push(relic);
      }

      saveDatabase(db);
      return sendJson(res, 200, {
        success: true,
        message: existingIndex >= 0 ? 'Cập nhật bảo vật thành công' : 'Thêm mới bảo vật thành công',
        relics: db.relics
      });
    }

    // 4. Xóa Bảo vật Quốc gia
    if (pathname === '/api/relics' && req.method === 'DELETE') {
      const body = await parseJsonBody(req);
      const targetId = parsedUrl.searchParams.get('id') || body.id;
      if (!targetId) {
        return sendJson(res, 400, { success: false, message: 'Thiếu mã ID bảo vật cần xóa' });
      }

      db.relics = db.relics.filter(r => r.id !== targetId);
      saveDatabase(db);
      return sendJson(res, 200, {
        success: true,
        message: 'Đã xóa bảo vật thành công',
        relics: db.relics
      });
    }

    // 5. Quản lý Cuộn băng Tư liệu (Thêm mới / Cập nhật)
    if (pathname === '/api/tapes' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.tape || !body.tape.t) {
        return sendJson(res, 400, { success: false, message: 'Dữ liệu cuộn băng không hợp lệ' });
      }

      const tape = body.tape;
      if (!tape.id) {
        tape.id = 'tape_' + Date.now();
      } else {
        tape.id = String(tape.id).replace(/[^a-zA-Z0-9_-]/g, '');
      }

      const existingIndex = db.tapes.findIndex(t => t.id === tape.id);
      if (existingIndex >= 0) {
        db.tapes[existingIndex] = tape;
      } else {
        db.tapes.push(tape);
      }

      saveDatabase(db);
      return sendJson(res, 200, {
        success: true,
        message: existingIndex >= 0 ? 'Cập nhật cuộn băng thành công' : 'Thêm cuộn băng mới thành công',
        tapes: db.tapes
      });
    }

    // 6. Xóa Cuộn băng Tư liệu
    if (pathname === '/api/tapes' && req.method === 'DELETE') {
      const body = await parseJsonBody(req);
      const targetId = parsedUrl.searchParams.get('id') || body.id;
      if (!targetId) {
        return sendJson(res, 400, { success: false, message: 'Thiếu mã ID cuộn băng cần xóa' });
      }

      db.tapes = db.tapes.filter(t => t.id !== targetId);
      saveDatabase(db);
      return sendJson(res, 200, {
        success: true,
        message: 'Đã xóa cuộn băng thành công',
        tapes: db.tapes
      });
    }

    // 7. Lưu Cài đặt Không gian 3D & CRT Studio
    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.settings) {
        // Nếu cập nhật PIN, yêu cầu độ dài tối thiểu 6 ký tự
        if (body.settings.adminPin && String(body.settings.adminPin).length < 6) {
          return sendJson(res, 400, { success: false, message: 'Mã PIN bảo mật phải có ít nhất 6 ký tự' });
        }

        db.settings = { ...db.settings, ...body.settings };
        saveDatabase(db);
        return sendJson(res, 200, {
          success: true,
          message: 'Lưu cài đặt không gian thành công',
          settings: db.settings
        });
      }
      return sendJson(res, 400, { success: false, message: 'Thiếu dữ liệu cài đặt' });
    }

    // 8. Xuất file sao lưu (Export Backup JSON) - Công khai hoặc qua Token
    if (pathname === '/api/export' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename=vietnam-history-backup.json',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(JSON.stringify(db, null, 2));
    }

    // 9. Nhập file phục hồi (Import Restore JSON) - Yêu cầu Token
    if (pathname === '/api/import' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.relics || body.tapes) {
        if (Array.isArray(body.relics)) db.relics = body.relics;
        if (Array.isArray(body.tapes)) db.tapes = body.tapes;
        if (body.settings) db.settings = { ...db.settings, ...body.settings };
        saveDatabase(db);
        return sendJson(res, 200, {
          success: true,
          message: 'Khôi phục cơ sở dữ liệu thành công',
          data: db
        });
      }
      return sendJson(res, 400, { success: false, message: 'Tệp sao lưu không đúng cấu trúc' });
    }

    // 10. Đặt lại dữ liệu gốc của dự án (Reset to Factory Defaults) - Yêu cầu Token
    if (pathname === '/api/reset' && req.method === 'POST') {
      if (fs.existsSync(DEFAULT_DB_FILE)) {
        try {
          const defaultData = JSON.parse(fs.readFileSync(DEFAULT_DB_FILE, 'utf8'));
          db.relics = defaultData.relics || [];
          db.tapes = defaultData.tapes || [];
          if (defaultData.settings) db.settings = { ...db.settings, ...defaultData.settings };
          saveDatabase(db);
          return sendJson(res, 200, {
            success: true,
            message: 'Đã hoàn nguyên về dữ liệu bảo tàng gốc thành công'
          });
        } catch (e) {}
      }
      return sendJson(res, 500, { success: false, message: 'Không tìm thấy bản sao lưu gốc' });
    }

    // 11. Lấy danh sách ảnh hiện vật có sẵn trong thư viện
    if (pathname === '/api/images' && req.method === 'GET') {
      const relicDir = path.join(__dirname, 'images', 'relics');
      let images = [];
      if (fs.existsSync(relicDir)) {
        try {
          const files = fs.readdirSync(relicDir);
          images = files
            .filter(f => ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(path.extname(f).toLowerCase()))
            .map(f => `images/relics/${f}`);
        } catch (e) {
          console.error('[LỖI ĐỌC THƯ MỤC ẢNH]:', e);
        }
      }
      return sendJson(res, 200, { success: true, images });
    }

    // 12. Tải tệp ảnh hiện vật lên máy chủ (Upload Image) - Yêu cầu Token
    if (pathname === '/api/upload' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.data) {
        return sendJson(res, 400, { success: false, message: 'Thiếu dữ liệu tệp ảnh tải lên' });
      }

      // Xác định định dạng tệp ảnh
      let ext = path.extname(body.filename || '').toLowerCase();
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'];
      if (!allowedExts.includes(ext)) {
        if (body.data.startsWith('data:image/png')) ext = '.png';
        else if (body.data.startsWith('data:image/webp')) ext = '.webp';
        else if (body.data.startsWith('data:image/svg')) ext = '.svg';
        else if (body.data.startsWith('data:image/gif')) ext = '.gif';
        else ext = '.jpg';
      }

      try {
        const base64Data = body.data.replace(/^data:image\/[a-z0-9+]+;base64,/i, '');
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length === 0 || buffer.length > 20 * 1024 * 1024) {
          return sendJson(res, 400, { success: false, message: 'Dung lượng ảnh không hợp lệ (tối đa 20MB)' });
        }

        const rawName = path.basename(body.filename || 'relic', ext)
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 30) || 'relic';

        const safeFilename = `${rawName}_${Date.now()}${ext}`;
        const targetDir = path.join(__dirname, 'images', 'relics');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const targetPath = path.join(targetDir, safeFilename);
        const imagesRootDir = path.resolve(__dirname, 'images');
        if (!targetPath.startsWith(imagesRootDir)) {
          return sendJson(res, 400, { success: false, message: 'Đường dẫn tệp không an toàn' });
        }

        fs.writeFileSync(targetPath, buffer);

        return sendJson(res, 200, {
          success: true,
          message: 'Tải ảnh lên thành công',
          url: `images/relics/${safeFilename}`,
          filename: safeFilename,
          size: buffer.length
        });
      } catch (err) {
        console.error('[LỖI LƯU TỆP ẢNH UPLOAD]:', err);
        return sendJson(res, 500, { success: false, message: 'Lỗi ghi tệp ảnh trên máy chủ' });
      }
    }

    // Tuyến API không tồn tại
    return sendJson(res, 404, { success: false, message: 'Không tìm thấy API' });
  }

  // ============================================================================
  // XỬ LÝ PHÂN PHỐI TỆP TIN TĨNH VỚI CHỐNG PATH TRAVERSAL (CWE-22)
  // ============================================================================
  let reqUrl = pathname;
  if (reqUrl === '/admin') reqUrl = '/admin.html';
  if (reqUrl === '/museum') reqUrl = '/museum.html';
  
  // Giải mã URI an toàn
  let safeSubPath;
  try {
    safeSubPath = decodeURIComponent(reqUrl.substring(1));
  } catch (err) {
    safeSubPath = reqUrl.substring(1);
  }

  const safeRootDir = path.resolve(__dirname);
  let filePath = path.resolve(path.join(safeRootDir, reqUrl === '/' ? 'index.html' : safeSubPath));

  // 1. KIỂM TRA BẢO MẬT: Chặn đứng mọi hành vi nhảy ra ngoài thư mục gốc (Path Traversal)
  const rawUrl = req.url || '';
  let decodedUrl = '';
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch (e) {
    decodedUrl = rawUrl;
  }

  if (rawUrl.includes('..') || decodedUrl.includes('..') || !filePath.startsWith(safeRootDir)) {
    console.warn(`[CẢNH BÁO AN NINH - CHẶN PATH TRAVERSAL]: ${rawUrl} từ IP: ${getClientIp(req)}`);
    res.writeHead(403, { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff' 
    });
    res.end('403 Forbidden: Hành vi truy cập ngoài thư mục gốc bị từ chối');
    return;
  }

  // 2. BẢO VỆ TỆP TIN NHẠY CẢM NỘI BỘ (Chặn đọc trực tiếp file database chứa PIN và file mã nguồn máy chủ)
  const baseName = path.basename(filePath).toLowerCase();
  const relPath = path.relative(safeRootDir, filePath).replace(/\\/g, '/').toLowerCase();
  const isProtectedFile = 
    relPath.startsWith('data/') || 
    (!relPath.startsWith('images/') && (
      baseName === 'server.js' || 
      baseName === 'package.json' || 
      baseName === 'package-lock.json' || 
      baseName.startsWith('test-') ||
      baseName.startsWith('.')
    ));

  if (isProtectedFile) {
    res.writeHead(403, { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff' 
    });
    res.end('403 Forbidden: Tệp tin nội bộ máy chủ được bảo vệ');
    return;
  }

  // Nếu người dùng truy cập một thư mục con, tự động tìm file index.html bên trong
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Xử lý khi không tìm thấy file (404 Not Found)
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end('404 Not Found: ' + reqUrl);
    return;
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Chính sách lưu bộ nhớ đệm (Cache-Control):
  const isMedia = ['.mp3', '.mp4', '.webm', '.ogg', '.wav', '.glb', '.gltf', '.png', '.jpg', '.jpeg', '.webp', '.woff2'].includes(ext);
  if (isMedia) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Xử lý yêu cầu truyền tải từng phần (HTTP Range Request / Streaming MP4/MP3)
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const maxChunk = 1024 * 1024; // Khối 1MB
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + maxChunk - 1, stat.size - 1);
    const chunksize = (end - start) + 1;
    
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// 4. Lắng nghe máy chủ
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================================`);
  console.log(` MÁY CHỦ BẢO TÀNG LỊCH SỬ & QUẢN TRỊ VIÊN ĐANG HOẠT ĐỘNG!`);
  console.log(` - Kiểm soát an ninh Path Traversal & Brute-force: BẬT`);
  console.log(` - Xác thực Cryptographic Bearer Token API:         BẬT`);
  console.log(` 1. Phòng Trải nghiệm 3D CRT: http://localhost:${PORT}/`);
  console.log(` 2. Bảo tàng Số Quốc gia:     http://localhost:${PORT}/museum.html`);
  console.log(` 3. Trung tâm Quản trị Admin: http://localhost:${PORT}/admin.html`);
  console.log(`=================================================================`);
});
