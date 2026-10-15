// ==========================================================================
// MÁY CHỦ WEB TĨNH CHUYÊN DỤNG (HIGH-PERFORMANCE STATIC NODE.JS SERVER)
// Chức năng:
// 1. Phục vụ toàn bộ trang web tĩnh (index.html, museum.html, JS, CSS, 3D Models)
// 2. Hỗ trợ đầy đủ MIME Types cho âm thanh (MP3), video tài liệu (MP4), font chữ
// 3. Hỗ trợ chuẩn HTTP Range Request (mã phản hồi 206) để tua và phát video/audio tức thì
// 4. Tương thích triển khai tự động trên đám mây Render (PORT từ process.env)
// ==========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Cổng lắng nghe: Lấy từ biến môi trường của Render (process.env.PORT) hoặc mặc định cổng 3000
const PORT = process.env.PORT || 3000;

// 2. Bảng ánh xạ loại tệp (MIME Types) đầy đủ cho các định dạng web hiện đại
const MIME_TYPES = {
  // Tài liệu web & Mã kịch bản
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  
  // Hình ảnh đồ họa
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  
  // Phông chữ web
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  
  // Đa phương tiện Video & Audio tài liệu lịch sử
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  
  // Mô hình 3D đồ họa
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream'
};

// 3. Khởi tạo máy chủ HTTP
const server = http.createServer((req, res) => {
  // Cấu hình tiêu đề CORS (Cross-Origin Resource Sharing) cho phép tải tài nguyên tự do
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Phản hồi nhanh cho các yêu cầu thăm dò pre-flight OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Tách bỏ chuỗi tham số query (?v=...) để lấy đúng đường dẫn file thực tế trên ổ cứng
  let reqUrl = req.url.split('?')[0];
  let filePath = path.join(__dirname, reqUrl === '/' ? 'index.html' : decodeURIComponent(reqUrl));

  // Nếu người dùng truy cập một thư mục con, tự động tìm file index.html bên trong
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Xử lý khi không tìm thấy file (Lỗi 404 Not Found)
  if (!fs.existsSync(filePath)) {
    console.warn('[404 NOT FOUND]:', reqUrl);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + reqUrl);
    return;
  }
  console.log('[200 OK]:', reqUrl);

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // 4. Chính sách lưu bộ nhớ đệm (Cache-Control):
  // - Đối với Video, Nhạc, Ảnh, Font: Cho phép lưu cache trình duyệt trong 7 ngày để tối ưu tải nhanh
  // - Đối với HTML, CSS, JS: Không lưu cache (no-cache) để người dùng luôn nhận bản cập nhật mới nhất
  const isMedia = ['.mp3', '.mp4', '.webm', '.ogg', '.wav', '.glb', '.gltf', '.png', '.jpg', '.jpeg', '.webp', '.woff2'].includes(ext);
  if (isMedia) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // 5. Xử lý yêu cầu truyền tải từng phần (HTTP Range Request / Streaming):
  // Rất quan trọng đối với các file video MP4 lớn (80MB - 90MB) và audio MP3:
  // Giúp trình duyệt phát ngay lập tức từ giây đầu tiên mà không phải đợi tải xong cả file
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const maxChunk = 1024 * 1024; // Truyền từng khối 1MB để bắt đầu xem phim tức thì
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + maxChunk - 1, stat.size - 1);
    const chunksize = (end - start) + 1;
    
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, { // Mã 206: Partial Content
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });
    file.pipe(res);
  } else {
    // Truyền toàn bộ file thông thường nếu không có header Range
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// 6. Lắng nghe trên toàn bộ các giao diện mạng (0.0.0.0)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Máy chủ lịch sử Việt Nam đang chạy tại http://localhost:${PORT}`);
});
