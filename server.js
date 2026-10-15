// ==========================================================================
// MÁY CHỦ WEB TĨNH & API QUẢN TRỊ BẢO TÀNG (VIETNAM HISTORY CRT SERVER & CMS API)
// ==========================================================================
// Chức năng:
// 1. Phục vụ toàn bộ website tĩnh (index.html, museum.html, admin.html, JS, CSS, 3D)
// 2. Hỗ trợ chuẩn HTTP Range Request (mã phản hồi 206) để tua và phát video/audio tức thì
// 3. Hệ thống REST API (/api/...) phục vụ Trung tâm Quản trị (Admin Dashboard):
//    - GET  /api/data: Lấy toàn bộ dữ liệu Bảo vật, Cuộn băng và Cài đặt
//    - POST /api/auth/login: Xác thực mật khẩu quản trị viên (Admin PIN)
//    - POST /api/relics: Thêm mới hoặc cập nhật thông tin Bảo vật Quốc gia
//    - DELETE /api/relics: Xóa bảo vật theo mã ID
//    - POST /api/tapes: Thêm mới hoặc cập nhật Cuộn băng tư liệu
//    - DELETE /api/tapes: Xóa cuộn băng theo mã ID
//    - POST /api/settings: Lưu cài đặt không gian 3D và màn hình TV CRT
//    - GET  /api/export: Tải về file sao lưu JSON (Backup Database)
//    - POST /api/import: Phục hồi cơ sở dữ liệu từ file JSON tải lên
//    - POST /api/reset: Đặt lại toàn bộ dữ liệu về trạng thái nguyên bản
// 4. Tự động đồng bộ tức thì sang vietnam-history-data.js khi có thay đổi trên Admin
// ==========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Cổng lắng nghe
const PORT = process.env.PORT || 3000;

// Đường dẫn file cơ sở dữ liệu JSON
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'history-db.json');
const HISTORY_JS_FILE = path.join(__dirname, 'vietnam-history-data.js');

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
 * Đọc cơ sở dữ liệu JSON
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
    console.error('[DB READ ERROR]:', e);
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
    
    // Đồng bộ sang tệp JavaScript ES module để các module Three.js tải tức thì
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
    console.error('[DB WRITE ERROR]:', e);
    return false;
  }
}

/**
 * Hàm tiện ích phân tích cú pháp Payload JSON từ HTTP Request
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) { // Giới hạn 25MB
        reject(new Error('Payload quá lớn'));
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
 * Trả về phản hồi JSON tiêu chuẩn
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// 3. Khởi tạo máy chủ HTTP
const server = http.createServer(async (req, res) => {
  // Cấu hình tiêu đề CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ==========================================================================
  // XỬ LÝ CÁC ĐƯỜNG DẪN REST API CHO TRANG ADMIN
  // ==========================================================================
  if (pathname.startsWith('/api/')) {
    const db = readDatabase();

    // 1. Lấy toàn bộ dữ liệu hệ thống
    if (pathname === '/api/data' && req.method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        settings: db.settings,
        relics: db.relics,
        tapes: db.tapes
      });
    }

    // 2. Xác thực đăng nhập Admin (PIN kiểm tra)
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const validPin = (db.settings && db.settings.adminPin) ? db.settings.adminPin : 'admin123';
      if (body.pin === validPin) {
        return sendJson(res, 200, {
          success: true,
          token: 'token-' + Buffer.from(Date.now().toString()).toString('base64'),
          message: 'Đăng nhập thành công'
        });
      } else {
        return sendJson(res, 401, {
          success: false,
          message: 'Mã PIN bảo mật không đúng. Vui lòng thử lại!'
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
      if (!relic.id) {
        relic.id = 'relic_' + Date.now();
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

    // 8. Xuất file sao lưu (Export Backup JSON)
    if (pathname === '/api/export' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename=vietnam-history-backup.json'
      });
      return res.end(JSON.stringify(db, null, 2));
    }

    // 9. Nhập file phục hồi (Import Restore JSON)
    if (pathname === '/api/import' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.relics || body.tapes) {
        if (body.relics) db.relics = body.relics;
        if (body.tapes) db.tapes = body.tapes;
        if (body.settings) db.settings = { ...db.settings, ...body.settings };
        saveDatabase(db);
        return sendJson(res, 200, {
          success: true,
          message: 'Khôi phục cơ sở dữ liệu thành công',
          data: db
        });
      }
      return sendJson(res, 400, { success: false, message: 'Tệp sao lưu không đúng định dạng' });
    }

    // Tuyến API không tồn tại
    return sendJson(res, 404, { success: false, message: 'Không tìm thấy API' });
  }

  // ==========================================================================
  // XỬ LÝ PHÂN PHỐI TỆP TIN TĨNH (STATIC FILE SERVING)
  // ==========================================================================
  let reqUrl = pathname;
  if (reqUrl === '/admin') reqUrl = '/admin.html';
  if (reqUrl === '/museum') reqUrl = '/museum.html';
  
  let filePath = path.join(__dirname, reqUrl === '/' ? 'index.html' : decodeURIComponent(reqUrl.substring(1)));

  // Nếu người dùng truy cập một thư mục con, tự động tìm file index.html bên trong
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Xử lý khi không tìm thấy file (Lỗi 404 Not Found)
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
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

// 4. Lắng nghe trên toàn bộ các giao diện mạng (0.0.0.0)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================================`);
  console.log(` MÁY CHỦ BẢO TÀNG LỊCH SỬ & QUẢN TRỊ VIÊN ĐANG HOẠT ĐỘNG!`);
  console.log(` 1. Phòng Trải nghiệm 3D CRT: http://localhost:${PORT}/`);
  console.log(` 2. Bảo tàng Số Quốc gia:     http://localhost:${PORT}/museum.html`);
  console.log(` 3. Trung tâm Quản trị Admin: http://localhost:${PORT}/admin.html`);
  console.log(`=================================================================`);
});
