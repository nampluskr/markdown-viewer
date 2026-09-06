// host_electron/host/domain.js — 마크다운 뷰어 호스트 도메인 계층 (D-6, D-8, FR-7, FR-8, FR-9)
const fs = require('fs');
const path = require('path');
const electron = require('electron');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (D-8)

const IMAGE_MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function createDomainHandler({ resolveInsideRoot, isInsideRoot, getRootPath, fail, result, ERROR_MESSAGES }) {
  return async function handleDomain(action, ...args) {
    if (action === 'read_document') {
      const relPath = args[0];
      if (typeof relPath !== 'string' || !relPath) {
        return fail('NOT_FOUND', ERROR_MESSAGES.NOT_FOUND);
      }

      const resolved = resolveInsideRoot(relPath);
      if (!resolved.ok) return resolved;

      const fullPath = resolved.value;
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        const code = err.code === 'EACCES' ? 'PERMISSION_DENIED' : 'READ_FAILED';
        return fail(code, ERROR_MESSAGES[code]);
      }

      if (stat.isDirectory()) {
        return fail('UNSUPPORTED_TARGET', ERROR_MESSAGES.UNSUPPORTED_TARGET);
      }

      // 1. 크기 상한 2MB 검사 (D-8, FR-7)
      if (stat.size > MAX_FILE_SIZE) {
        return fail('UNSUPPORTED_TARGET', '파일 크기가 2MB 상한을 초과했습니다 (' + (stat.size / 1024 / 1024).toFixed(2) + 'MB).');
      }

      // 2. 파일 버퍼 읽기
      let buffer;
      try {
        buffer = fs.readFileSync(fullPath);
      } catch (err) {
        const code = err.code === 'EACCES' ? 'PERMISSION_DENIED' : 'READ_FAILED';
        return fail(code, ERROR_MESSAGES[code]);
      }

      // 3. 널 바이트(바이너리) 검사 (D-8, FR-7)
      if (buffer.includes(0x00)) {
        return fail('UNSUPPORTED_TARGET', '바이너리 파일(널 바이트 포함)은 지원하지 않습니다.');
      }

      // 4. UTF-16 BOM 검사 (D-8, FR-7)
      if (buffer.length >= 2) {
        if ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff)) {
          return fail('UNSUPPORTED_TARGET', 'UTF-8(BOM 포함) 외의 인코딩(UTF-16)은 지원하지 않습니다.');
        }
      }

      // 5. UTF-8 인코딩 유효성 검사
      let content;
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        content = decoder.decode(buffer);
      } catch {
        return fail('UNSUPPORTED_TARGET', 'UTF-8(BOM 포함) 외의 인코딩은 지원하지 않습니다.');
      }

      // UTF-8 BOM 제거
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
      }

      return result({
        content: content,
        size: stat.size,
        path: relPath
      });
    }

    if (action === 'read_image') {
      const imgPath = args[0];
      const baseDir = args[1] || '';

      if (typeof imgPath !== 'string' || !imgPath) {
        return fail('NOT_FOUND', ERROR_MESSAGES.NOT_FOUND);
      }

      // 절대경로 or .. 상위 이탈 차단 (FR-8)
      if (path.isAbsolute(imgPath) || /^[a-zA-Z]:/.test(imgPath) || imgPath.startsWith('/') || imgPath.startsWith('\\')) {
        return fail('ROOT_ESCAPE', ERROR_MESSAGES.ROOT_ESCAPE);
      }

      // 상대경로 결합
      const combined = baseDir ? path.join(baseDir, imgPath).replace(/\\/g, '/') : imgPath;
      const parts = combined.split(/[\\/]/);
      if (parts.includes('..')) {
        return fail('ROOT_ESCAPE', ERROR_MESSAGES.ROOT_ESCAPE);
      }

      const resolved = resolveInsideRoot(combined);
      if (!resolved.ok) return resolved;

      const fullPath = resolved.value;
      const ext = path.extname(fullPath).toLowerCase();
      const mime = IMAGE_MIME_MAP[ext];
      if (!mime) {
        return fail('UNSUPPORTED_TARGET', '지원하지 않는 이미지 형식입니다 (' + ext + ').');
      }

      try {
        const buffer = fs.readFileSync(fullPath);
        const dataUri = 'data:' + mime + ';base64,' + buffer.toString('base64');
        return result({
          dataUri: dataUri,
          mime: mime,
          path: combined
        });
      } catch (err) {
        const code = err.code === 'ENOENT' ? 'NOT_FOUND' : (err.code === 'EACCES' ? 'PERMISSION_DENIED' : 'READ_FAILED');
        return fail(code, ERROR_MESSAGES[code]);
      }
    }

    if (action === 'open_external') {
      const targetUrl = args[0];
      if (typeof targetUrl !== 'string' || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        return fail('UNSUPPORTED_TARGET', '지원하지 않는 외부 URL 형식입니다.');
      }

      try {
        if (electron && electron.shell && electron.shell.openExternal) {
          await electron.shell.openExternal(targetUrl);
        }
        return result(true);
      } catch {
        return fail('READ_FAILED', '외부 브라우저를 열지 못했습니다.');
      }
    }

    return fail('UNSUPPORTED_TARGET', ERROR_MESSAGES.UNSUPPORTED_TARGET);
  };
}

module.exports = {
  createDomainHandler,
  MAX_FILE_SIZE,
  IMAGE_MIME_MAP
};
