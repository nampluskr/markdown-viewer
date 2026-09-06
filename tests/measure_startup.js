// tests/measure_startup.js — NFR-1의 "실행부터 탐색기가 보일 때까지"를 실제 Electron 기동으로 잰다.
// Node 안에서 브릿지 함수만 부르는 측정은 프로세스 기동·창 생성·셸 로드를 빼놓기 때문에 기준을 대표하지 못한다.
//
//   node tests/measure_startup.js [반복 횟수]
//
// 화면이 있는 환경에서만 돌아간다. 창을 띄우지 못하면 이유를 적고 실패로 끝난다.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const electronCli = path.join(projectRoot, 'host_electron', 'node_modules', 'electron', 'cli.js');
const appEntry = path.join(projectRoot, 'host_electron');
const runs = Number(process.argv[2] || 5);

if (!fs.existsSync(electronCli)) {
  console.error('Electron이 설치돼 있지 않다. host_electron에서 npm install을 먼저 돌린다.');
  process.exit(1);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const samples = [];
for (let i = 0; i < runs; i++) {
  const t0 = Date.now();
  const proc = spawnSync(process.execPath, [electronCli, appEntry], {
    cwd: projectRoot,
    env: Object.assign({}, process.env, { MV_STARTUP_BENCH: '1', MV_STARTUP_T0: String(t0) }),
    encoding: 'utf8',
    timeout: 60000
  });

  const out = (proc.stdout || '') + (proc.stderr || '');
  const match = out.match(/MV_STARTUP_MS=(\d+)/);
  if (!match) {
    console.error('기동 측정에 실패했다. Electron 출력:');
    console.error(out.trim().slice(0, 2000));
    process.exit(1);
  }
  samples.push(Number(match[1]));
}

const med = median(samples);
console.log('실행~셸 로드 완료(' + samples.length + '회): [' + samples.map((v) => v + 'ms').join(', ') + ']');
console.log('중앙값: ' + med + 'ms (기준: <= 3000ms)');

if (med > 3000) {
  console.error('NFR-1 미충족: 중앙값이 3초를 넘는다.');
  process.exit(1);
}
console.log('NFR-1 기동 기준 충족');
