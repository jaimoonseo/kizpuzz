// 캔버스 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기 설정 (상하좌우 여백 1칸씩 추가)
const GRID_SIZE = 60;  // 60px per cell
const GRID_OFFSET_X = 60;  // 좌우 여백 각 1칸
const GRID_OFFSET_Y = 60;  // 상하 여백 각 1칸
const GRID_COLS = 10;
const GRID_ROWS = 10;

canvas.width = GRID_SIZE * GRID_COLS + GRID_OFFSET_X * 2;  // 720px (여백 60 + 그리드 600 + 여백 60)
canvas.height = GRID_SIZE * GRID_ROWS + GRID_OFFSET_Y * 2;  // 720px (여백 60 + 그리드 600 + 여백 60)

// 상태 관리
let currentTool = 'pencil'; // pencil, eraser
let currentColor = '#FF0000';  // 기본 빨강
let currentShape = 'star';     // 기본 별
let isDrawing = false;
let lastGridX = -1;
let lastGridY = -1;

// 도장 색상 매핑 (고정)
const SHAPE_COLORS = {
  'star': '#4A90E2',     // 파란 별
  'spade': '#FF8C42',    // 주황 스페이드
  'diamond': '#4A90E2',  // 파란 다이아몬드
  'heart': '#FF6B9D',    // 핑크 하트
  'clover': '#51CF66'    // 초록 클로버
};

// 그리드 상태 저장 (도장)
let gridStamps = {};

// 선 그리기 상태 저장
let gridLines = [];

// 패턴 문제 데이터
let currentPuzzle = null;

// 빈칸 좌표 (도장을 찍을 수 있는 곳)
const BLANK_CELLS = new Set([
  '3,3', '4,3', '5,3',  // Row 4의 빈칸
  '3,4', '5,4',          // Row 5의 빈칸
  '3,5', '4,5', '5,5'   // Row 6의 빈칸
]);

// 도구 선택
document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentShape = btn.dataset.shape;
    currentTool = 'stamp'; // 도장 모드로 전환
  });
});

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
  });
});

// 마우스 위치를 격자 좌표로 변환
function getGridCoordinates(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  // 상하좌우 여백을 고려한 좌표 계산
  const gridX = Math.floor((x - GRID_OFFSET_X) / GRID_SIZE);
  const gridY = Math.floor((y - GRID_OFFSET_Y) / GRID_SIZE);

  return { gridX, gridY };
}

// 격자 중앙 좌표 계산 (상하좌우 여백 포함)
function getGridCenter(gridX, gridY) {
  return {
    x: GRID_OFFSET_X + gridX * GRID_SIZE + GRID_SIZE / 2,
    y: GRID_OFFSET_Y + gridY * GRID_SIZE + GRID_SIZE / 2
  };
}

// 캔버스 이벤트
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('click', handleClick);

// 터치 이벤트 (passive: false로 preventDefault 허용)
canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });
canvas.addEventListener('touchend', handleTouch, { passive: false });

function startDrawing(e) {
  if (currentTool === 'stamp') return; // 도장 모드에서는 드로잉 안함

  isDrawing = true;
  const { gridX, gridY } = getGridCoordinates(e.clientX, e.clientY);
  lastGridX = gridX;
  lastGridY = gridY;
}

function draw(e) {
  if (!isDrawing || currentTool === 'stamp') return;

  const { gridX, gridY } = getGridCoordinates(e.clientX, e.clientY);

  // 격자가 변경되었을 때만 선 그리기
  if (gridX !== lastGridX || gridY !== lastGridY) {
    if (currentTool === 'pencil') {
      // 선 저장
      gridLines.push({
        from: { gridX: lastGridX, gridY: lastGridY },
        to: { gridX, gridY },
        color: currentColor
      });
    } else if (currentTool === 'eraser') {
      // 해당 격자의 도장과 선 삭제
      const key = `${gridX},${gridY}`;
      const hadStamp = gridStamps[key] !== undefined;
      delete gridStamps[key];

      // 해당 격자를 지나는 선 삭제
      gridLines = gridLines.filter(line => {
        return !(
          (line.from.gridX === gridX && line.from.gridY === gridY) ||
          (line.to.gridX === gridX && line.to.gridY === gridY)
        );
      });

      // 도장이 있었다면 답안지도 업데이트
      if (hadStamp) {
        updateAnswerSheet();
      }
    }

    lastGridX = gridX;
    lastGridY = gridY;

    // 다시 그리기
    redrawCanvas();
  }
}

function stopDrawing() {
  isDrawing = false;
  lastGridX = -1;
  lastGridY = -1;
}

function handleClick(e) {
  if (currentTool !== 'stamp') return;

  const { gridX, gridY } = getGridCoordinates(e.clientX, e.clientY);
  const key = `${gridX},${gridY}`;

  // 빈칸이 아니면 도장을 찍을 수 없음
  if (!BLANK_CELLS.has(key)) {
    alert('빈칸에만 도장을 찍을 수 있습니다!');
    return;
  }

  // 도장 찍기 - 도장의 고정 색상 사용 (currentColor 무시)
  const stampColor = SHAPE_COLORS[currentShape] || currentColor;

  gridStamps[key] = {
    gridX,
    gridY,
    shape: currentShape,
    color: stampColor  // 도장 고정 색상 사용
  };

  redrawCanvas();
  updateAnswerSheet();  // 답안지 업데이트
}

function drawShape(x, y, shape, color, size) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  switch (shape) {
    case 'star':
      drawStar(x, y, 5, size, size / 2, color);
      break;

    case 'spade':
      drawSpade(x, y, size, color);
      break;

    case 'diamond':
      drawDiamond(x, y, size, color);
      break;

    case 'heart':
      drawHeart(x, y, size, color);
      break;

    case 'clover':
      drawClover(x, y, size, color);
      break;
  }
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;

  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerRadius;
    let y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

function drawHeart(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();

  // 하트 - 크기 조정 및 센터 정렬
  const s = size * 0.85;
  const topCurveHeight = s * 0.3;
  const offsetY = -s * 0.15; // 위로 살짝 올림

  ctx.moveTo(x, y + topCurveHeight + offsetY);

  ctx.bezierCurveTo(
    x, y + offsetY,
    x - s / 2, y + offsetY,
    x - s / 2, y + topCurveHeight + offsetY
  );
  ctx.bezierCurveTo(
    x - s / 2, y + (s + topCurveHeight) / 2 + offsetY,
    x, y + (s + topCurveHeight) / 1.2 + offsetY,
    x, y + s + offsetY
  );

  ctx.bezierCurveTo(
    x, y + (s + topCurveHeight) / 1.2 + offsetY,
    x + s / 2, y + (s + topCurveHeight) / 2 + offsetY,
    x + s / 2, y + topCurveHeight + offsetY
  );
  ctx.bezierCurveTo(
    x + s / 2, y + offsetY,
    x, y + offsetY,
    x, y + topCurveHeight + offsetY
  );

  ctx.closePath();
  ctx.fill();
}

function drawSpade(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();

  // 스페이드 - 크기 조정 (0.9 스케일)
  const s = size * 0.9;

  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x - s * 0.7, y - s * 0.3, x - s * 0.5, y + s * 0.2);
  ctx.quadraticCurveTo(x - s * 0.3, y + s * 0.5, x - s * 0.2, y + s * 0.3);

  ctx.lineTo(x - s * 0.15, y + s * 0.5);
  ctx.lineTo(x - s * 0.2, y + s * 0.8);
  ctx.lineTo(x + s * 0.2, y + s * 0.8);
  ctx.lineTo(x + s * 0.15, y + s * 0.5);

  ctx.lineTo(x + s * 0.2, y + s * 0.3);
  ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.5, x + s * 0.5, y + s * 0.2);
  ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.3, x, y - s);

  ctx.closePath();
  ctx.fill();
}

function drawDiamond(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();

  // 다이아몬드 (마름모) - 크기 조정
  const s = size * 0.85;

  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.7, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.7, y);

  ctx.closePath();
  ctx.fill();
}

function drawClover(x, y, size, color) {
  ctx.fillStyle = color;

  // 클로버 (3개의 원 + 줄기) - 크기 조정
  const s = size * 0.85;
  const r = s * 0.35;

  // 왼쪽 원
  ctx.beginPath();
  ctx.arc(x - r * 0.7, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.fill();

  // 오른쪽 원
  ctx.beginPath();
  ctx.arc(x + r * 0.7, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.fill();

  // 위쪽 원
  ctx.beginPath();
  ctx.arc(x, y - r * 1.4, r, 0, Math.PI * 2);
  ctx.fill();

  // 줄기
  ctx.beginPath();
  ctx.moveTo(x - s * 0.1, y + s * 0.1);
  ctx.lineTo(x - s * 0.15, y + s * 0.7);
  ctx.lineTo(x + s * 0.15, y + s * 0.7);
  ctx.lineTo(x + s * 0.1, y + s * 0.1);
  ctx.closePath();
  ctx.fill();
}

// 화살촉 그리기
function drawArrowhead(tipX, tipY, fromX, fromY, color) {
  // 방향 계산
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const arrowLength = 20;  // 화살촉 길이 (더 크게)
  const arrowAngle = Math.PI / 5;  // 화살촉 각도 (더 넓게)

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();

  // 화살촉 끝점
  ctx.moveTo(tipX, tipY);

  // 위쪽 날개
  const x1 = tipX - arrowLength * Math.cos(angle - arrowAngle);
  const y1 = tipY - arrowLength * Math.sin(angle - arrowAngle);
  ctx.lineTo(x1, y1);

  // 아래쪽 날개
  const x2 = tipX - arrowLength * Math.cos(angle + arrowAngle);
  const y2 = tipY - arrowLength * Math.sin(angle + arrowAngle);
  ctx.lineTo(x2, y2);

  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function handleTouch(e) {
  e.preventDefault();

  // touchend는 touches[0]가 없으므로 changedTouches 사용
  const touch = e.touches[0] || e.changedTouches[0];
  if (!touch) return;

  if (e.type === 'touchstart') {
    // 터치 시작 - 도장 모드면 클릭, 아니면 드로잉 시작
    if (currentTool === 'stamp') {
      handleClick({ clientX: touch.clientX, clientY: touch.clientY });
    } else {
      startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
    }
  } else if (e.type === 'touchmove') {
    // 터치 이동 - 드로잉
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  } else if (e.type === 'touchend') {
    // 터치 종료
    stopDrawing();
  }
}

// 캔버스 다시 그리기
function redrawCanvas() {
  // 캔버스 초기화
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 격자 그리기
  drawGrid();

  // 퍼즐 패턴 그리기 (있으면)
  if (currentPuzzle) {
    currentPuzzle.pattern.forEach(item => {
      const center = getGridCenter(item.gridX, item.gridY);
      drawShape(center.x, center.y, item.shape, item.color, 25);
    });

    // 퍼즐의 빨간 선 그리기
    if (currentPuzzle.lines) {
      currentPuzzle.lines.forEach((line, index) => {
        const fromCenter = getGridCenter(line.from.gridX, line.from.gridY);
        const toCenter = getGridCenter(line.to.gridX, line.to.gridY);

        ctx.beginPath();
        ctx.moveTo(fromCenter.x, fromCenter.y);
        ctx.lineTo(toCenter.x, toCenter.y);
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 마지막 세그먼트에 화살촉 그리기 (왼쪽 방향)
        if (index === currentPuzzle.lines.length - 1) {
          drawArrowhead(toCenter.x, toCenter.y, fromCenter.x, fromCenter.y, line.color);
        }
      });
    }
  }

  // 사용자가 그린 선 그리기
  gridLines.forEach(line => {
    const fromCenter = getGridCenter(line.from.gridX, line.from.gridY);
    const toCenter = getGridCenter(line.to.gridX, line.to.gridY);

    ctx.beginPath();
    ctx.moveTo(fromCenter.x, fromCenter.y);
    ctx.lineTo(toCenter.x, toCenter.y);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  });

  // 저장된 도장 그리기
  Object.values(gridStamps).forEach(stamp => {
    const center = getGridCenter(stamp.gridX, stamp.gridY);
    drawShape(center.x, center.y, stamp.shape, stamp.color, 25);
  });
}

// 격자 그리기
function drawGrid() {
  // 먼저 빈칸에 노란색 배경 그리기
  ctx.fillStyle = '#FFFACD';  // 옅은 노란색 (LemonChiffon)
  BLANK_CELLS.forEach(key => {
    const [x, y] = key.split(',').map(Number);
    const cellX = GRID_OFFSET_X + x * GRID_SIZE;
    const cellY = GRID_OFFSET_Y + y * GRID_SIZE;
    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
  });

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;

  // 세로선 (상하좌우 여백 고려)
  for (let x = 0; x <= GRID_COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(GRID_OFFSET_X + x * GRID_SIZE, GRID_OFFSET_Y);
    ctx.lineTo(GRID_OFFSET_X + x * GRID_SIZE, GRID_OFFSET_Y + GRID_ROWS * GRID_SIZE);
    ctx.stroke();
  }

  // 가로선
  for (let y = 0; y <= GRID_ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(GRID_OFFSET_X, GRID_OFFSET_Y + y * GRID_SIZE);
    ctx.lineTo(GRID_OFFSET_X + GRID_COLS * GRID_SIZE, GRID_OFFSET_Y + y * GRID_SIZE);
    ctx.stroke();
  }

  // 격자 중앙 점 표시 (선택사항)
  ctx.fillStyle = '#f0f0f0';
  for (let i = 0; i < GRID_COLS; i++) {
    for (let j = 0; j < GRID_ROWS; j++) {
      const center = getGridCenter(i, j);
      ctx.beginPath();
      ctx.arc(center.x, center.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 전체 지우기
function clearBoard() {
  if (confirm('보드를 전체 지우시겠습니까?')) {
    gridStamps = {};
    gridLines = [];
    redrawCanvas();
    updateAnswerSheet();  // 답안지도 업데이트
  }
}

// 퍼즐 로드
function newPuzzle() {
  // 항상 같은 퍼즐만 사용
  const puzzle = {
    name: '실제 문제 - puzz.jpeg',
    description: '규칙을 찾아 빈 칸을 채우세요!',
    lines: [
      // 빨간 화살표 경로: (10,8) → (10,9) → (10,10) → (9,10) → ... → (1,10) → (-1,10) ←
      // (10,8) → (10,9)
      { from: { gridX: 9, gridY: 7 }, to: { gridX: 9, gridY: 8 }, color: '#FF0000' },
      // (10,9) → (10,10)
      { from: { gridX: 9, gridY: 8 }, to: { gridX: 9, gridY: 9 }, color: '#FF0000' },
      // (10,10) → (9,10)
      { from: { gridX: 9, gridY: 9 }, to: { gridX: 8, gridY: 9 }, color: '#FF0000' },
      // (9,10) → (8,10)
      { from: { gridX: 8, gridY: 9 }, to: { gridX: 7, gridY: 9 }, color: '#FF0000' },
      // (8,10) → (7,10)
      { from: { gridX: 7, gridY: 9 }, to: { gridX: 6, gridY: 9 }, color: '#FF0000' },
      // (7,10) → (6,10)
      { from: { gridX: 6, gridY: 9 }, to: { gridX: 5, gridY: 9 }, color: '#FF0000' },
      // (6,10) → (5,10)
      { from: { gridX: 5, gridY: 9 }, to: { gridX: 4, gridY: 9 }, color: '#FF0000' },
      // (5,10) → (4,10)
      { from: { gridX: 4, gridY: 9 }, to: { gridX: 3, gridY: 9 }, color: '#FF0000' },
      // (4,10) → (3,10)
      { from: { gridX: 3, gridY: 9 }, to: { gridX: 2, gridY: 9 }, color: '#FF0000' },
      // (3,10) → (2,10)
      { from: { gridX: 2, gridY: 9 }, to: { gridX: 1, gridY: 9 }, color: '#FF0000' },
      // (2,10) → (1,10)
      { from: { gridX: 1, gridY: 9 }, to: { gridX: 0, gridY: 9 }, color: '#FF0000' },
      // (1,10) → (-1,10) - 그리드 밖으로 화살표
      { from: { gridX: 0, gridY: 9 }, to: { gridX: -1, gridY: 9 }, color: '#FF0000' },
    ],
    pattern: [
        // Row 1: ★ ♠ ♦ ♥ ♥ ★ ♦ ♥ ★ ♠
        { gridX: 0, gridY: 0, shape: 'star', color: '#4A90E2' },
        { gridX: 1, gridY: 0, shape: 'spade', color: '#FF8C42' },
        { gridX: 2, gridY: 0, shape: 'diamond', color: '#4A90E2' },
        { gridX: 3, gridY: 0, shape: 'heart', color: '#FF6B9D' },
        { gridX: 4, gridY: 0, shape: 'heart', color: '#FF6B9D' },
        { gridX: 5, gridY: 0, shape: 'star', color: '#4A90E2' },
        { gridX: 6, gridY: 0, shape: 'diamond', color: '#4A90E2' },
        { gridX: 7, gridY: 0, shape: 'heart', color: '#FF6B9D' },
        { gridX: 8, gridY: 0, shape: 'star', color: '#4A90E2' },
        { gridX: 9, gridY: 0, shape: 'spade', color: '#FF8C42' },

        // Row 2: ♦ ♣ ♣ ★ ♦ ♠ ♣ ★ ♥ ♣
        { gridX: 0, gridY: 1, shape: 'diamond', color: '#4A90E2' },
        { gridX: 1, gridY: 1, shape: 'clover', color: '#51CF66' },
        { gridX: 2, gridY: 1, shape: 'clover', color: '#51CF66' },
        { gridX: 3, gridY: 1, shape: 'star', color: '#4A90E2' },
        { gridX: 4, gridY: 1, shape: 'diamond', color: '#4A90E2' },
        { gridX: 5, gridY: 1, shape: 'spade', color: '#FF8C42' },
        { gridX: 6, gridY: 1, shape: 'clover', color: '#51CF66' },
        { gridX: 7, gridY: 1, shape: 'star', color: '#4A90E2' },
        { gridX: 8, gridY: 1, shape: 'heart', color: '#FF6B9D' },
        { gridX: 9, gridY: 1, shape: 'clover', color: '#51CF66' },

        // Row 3: ♥ ★ ♠ ♠ ♣ ♣ ♠ ♠ ♦ ♦
        { gridX: 0, gridY: 2, shape: 'heart', color: '#FF6B9D' },
        { gridX: 1, gridY: 2, shape: 'star', color: '#4A90E2' },
        { gridX: 2, gridY: 2, shape: 'spade', color: '#FF8C42' },
        { gridX: 3, gridY: 2, shape: 'spade', color: '#FF8C42' },
        { gridX: 4, gridY: 2, shape: 'clover', color: '#51CF66' },
        { gridX: 5, gridY: 2, shape: 'clover', color: '#51CF66' },
        { gridX: 6, gridY: 2, shape: 'spade', color: '#FF8C42' },
        { gridX: 7, gridY: 2, shape: 'spade', color: '#FF8C42' },
        { gridX: 8, gridY: 2, shape: 'diamond', color: '#4A90E2' },
        { gridX: 9, gridY: 2, shape: 'diamond', color: '#4A90E2' },

        // Row 4: ★ ♥ ♦ □ □ □ ★ ♣ ♣ ♥
        { gridX: 0, gridY: 3, shape: 'star', color: '#4A90E2' },
        { gridX: 1, gridY: 3, shape: 'heart', color: '#FF6B9D' },
        { gridX: 2, gridY: 3, shape: 'diamond', color: '#4A90E2' },
        // 빈칸: (3, 3), (4, 3), (5, 3)
        { gridX: 6, gridY: 3, shape: 'star', color: '#4A90E2' },
        { gridX: 7, gridY: 3, shape: 'clover', color: '#51CF66' },
        { gridX: 8, gridY: 3, shape: 'clover', color: '#51CF66' },
        { gridX: 9, gridY: 3, shape: 'heart', color: '#FF6B9D' },

        // Row 5: ♠ ♣ ♦ □ ★ □ ♥ ♦ ♠ ★
        { gridX: 0, gridY: 4, shape: 'spade', color: '#FF8C42' },
        { gridX: 1, gridY: 4, shape: 'clover', color: '#51CF66' },
        { gridX: 2, gridY: 4, shape: 'diamond', color: '#4A90E2' },
        // 빈칸: (3, 4)
        { gridX: 4, gridY: 4, shape: 'star', color: '#4A90E2' },
        // 빈칸: (5, 4)
        { gridX: 6, gridY: 4, shape: 'heart', color: '#FF6B9D' },
        { gridX: 7, gridY: 4, shape: 'diamond', color: '#4A90E2' },
        { gridX: 8, gridY: 4, shape: 'spade', color: '#FF8C42' },
        { gridX: 9, gridY: 4, shape: 'star', color: '#4A90E2' },

        // Row 6: ★ ♥ ♦ □ □ □ ♦ ♥ ★ ♠
        { gridX: 0, gridY: 5, shape: 'star', color: '#4A90E2' },
        { gridX: 1, gridY: 5, shape: 'heart', color: '#FF6B9D' },
        { gridX: 2, gridY: 5, shape: 'diamond', color: '#4A90E2' },
        // 빈칸: (3, 5), (4, 5), (5, 5)
        { gridX: 6, gridY: 5, shape: 'diamond', color: '#4A90E2' },
        { gridX: 7, gridY: 5, shape: 'heart', color: '#FF6B9D' },
        { gridX: 8, gridY: 5, shape: 'star', color: '#4A90E2' },
        { gridX: 9, gridY: 5, shape: 'spade', color: '#FF8C42' },

        // Row 7: ♠ ♣ ♦ ♥ ★ ♠ ♣ ★ ♥ ♣
        { gridX: 0, gridY: 6, shape: 'spade', color: '#FF8C42' },
        { gridX: 1, gridY: 6, shape: 'clover', color: '#51CF66' },
        { gridX: 2, gridY: 6, shape: 'diamond', color: '#4A90E2' },
        { gridX: 3, gridY: 6, shape: 'heart', color: '#FF6B9D' },
        { gridX: 4, gridY: 6, shape: 'star', color: '#4A90E2' },
        { gridX: 5, gridY: 6, shape: 'spade', color: '#FF8C42' },
        { gridX: 6, gridY: 6, shape: 'clover', color: '#51CF66' },
        { gridX: 7, gridY: 6, shape: 'star', color: '#4A90E2' },
        { gridX: 8, gridY: 6, shape: 'heart', color: '#FF6B9D' },
        { gridX: 9, gridY: 6, shape: 'clover', color: '#51CF66' },

        // Row 8: ♦ ♣ ♠ ★ ♥ ♦ ♣ ♠ ♦ ♦
        { gridX: 0, gridY: 7, shape: 'diamond', color: '#4A90E2' },
        { gridX: 1, gridY: 7, shape: 'clover', color: '#51CF66' },
        { gridX: 2, gridY: 7, shape: 'spade', color: '#FF8C42' },
        { gridX: 3, gridY: 7, shape: 'star', color: '#4A90E2' },
        { gridX: 4, gridY: 7, shape: 'heart', color: '#FF6B9D' },
        { gridX: 5, gridY: 7, shape: 'diamond', color: '#4A90E2' },
        { gridX: 6, gridY: 7, shape: 'clover', color: '#51CF66' },
        { gridX: 7, gridY: 7, shape: 'spade', color: '#FF8C42' },
        { gridX: 8, gridY: 7, shape: 'diamond', color: '#4A90E2' },
        { gridX: 9, gridY: 7, shape: 'diamond', color: '#4A90E2' },

        // Row 9: ♥ ★ ♠ ♣ ♦ ♥ ★ ♠ ♣ ♥
        { gridX: 0, gridY: 8, shape: 'heart', color: '#FF6B9D' },
        { gridX: 1, gridY: 8, shape: 'star', color: '#4A90E2' },
        { gridX: 2, gridY: 8, shape: 'spade', color: '#FF8C42' },
        { gridX: 3, gridY: 8, shape: 'clover', color: '#51CF66' },
        { gridX: 4, gridY: 8, shape: 'diamond', color: '#4A90E2' },
        { gridX: 5, gridY: 8, shape: 'heart', color: '#FF6B9D' },
        { gridX: 6, gridY: 8, shape: 'star', color: '#4A90E2' },
        { gridX: 7, gridY: 8, shape: 'spade', color: '#FF8C42' },
        { gridX: 8, gridY: 8, shape: 'clover', color: '#51CF66' },
        { gridX: 9, gridY: 8, shape: 'heart', color: '#FF6B9D' },

        // Row 10: ♥ ♦ ♣ ♠ ★ ♥ ♦ ♣ ♠ ★
        { gridX: 0, gridY: 9, shape: 'heart', color: '#FF6B9D' },
        { gridX: 1, gridY: 9, shape: 'diamond', color: '#4A90E2' },
        { gridX: 2, gridY: 9, shape: 'clover', color: '#51CF66' },
        { gridX: 3, gridY: 9, shape: 'spade', color: '#FF8C42' },
        { gridX: 4, gridY: 9, shape: 'star', color: '#4A90E2' },
        { gridX: 5, gridY: 9, shape: 'heart', color: '#FF6B9D' },
        { gridX: 6, gridY: 9, shape: 'diamond', color: '#4A90E2' },
        { gridX: 7, gridY: 9, shape: 'clover', color: '#51CF66' },
        { gridX: 8, gridY: 9, shape: 'spade', color: '#FF8C42' },
        { gridX: 9, gridY: 9, shape: 'star', color: '#4A90E2' },
      ],
      hints: [
        '- ♦, ♥, ★, ♠, ♣'
      ]
    };

  currentPuzzle = puzzle;

  // 사용자가 그린 것 초기화
  gridStamps = {};
  gridLines = [];

  redrawCanvas();

  document.getElementById('problemText').textContent = currentPuzzle.description;
}

function showHint() {
  if (!currentPuzzle) {
    alert('퍼즐을 불러오는 중입니다...');
    return;
  }

  const hint = currentPuzzle.hints[0];
  alert('💡 힌트:\n\n' + hint);
}

// 정답 보기
function showAnswer() {
  if (!currentPuzzle) {
    alert('퍼즐을 불러오는 중입니다...');
    return;
  }

  if (!confirm('정답을 보시겠습니까?\n빈칸이 모두 채워지고 힌트 경로가 그려집니다.')) {
    return;
  }

  // 정답 데이터 (사용자가 출력한 정답 기준)
  const answers = {
    '3,3': { shape: 'clover', color: SHAPE_COLORS['clover'] },    // (4,4): ♣
    '4,3': { shape: 'spade', color: SHAPE_COLORS['spade'] },      // (5,4): ♠
    '5,3': { shape: 'diamond', color: SHAPE_COLORS['diamond'] },  // (6,4): ♦
    '3,4': { shape: 'heart', color: SHAPE_COLORS['heart'] },      // (4,5): ♥
    '5,4': { shape: 'heart', color: SHAPE_COLORS['heart'] },      // (6,5): ♥
    '3,5': { shape: 'clover', color: SHAPE_COLORS['clover'] },    // (4,6): ♣
    '4,5': { shape: 'spade', color: SHAPE_COLORS['spade'] },      // (5,6): ♠
    '5,5': { shape: 'star', color: SHAPE_COLORS['star'] }         // (6,6): ★
  };

  // 정답 도장 찍기
  Object.keys(answers).forEach(key => {
    const [x, y] = key.split(',').map(Number);
    gridStamps[key] = {
      gridX: x,
      gridY: y,
      shape: answers[key].shape,
      color: answers[key].color
    };
  });

  // 힌트 경로 그리기 (사용자가 출력한 완전한 힌트 경로)
  const hintPath = [
    { from: { gridX: 0, gridY: 1 }, to: { gridX: 0, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 2 }, to: { gridX: 1, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 2 }, to: { gridX: 2, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 2 }, to: { gridX: 2, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 1 }, to: { gridX: 2, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 0 }, to: { gridX: 3, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 0 }, to: { gridX: 3, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 1 }, to: { gridX: 3, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 2 }, to: { gridX: 3, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 3 }, to: { gridX: 2, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 3 }, to: { gridX: 1, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 3 }, to: { gridX: 0, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 3 }, to: { gridX: 0, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 4 }, to: { gridX: 1, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 4 }, to: { gridX: 2, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 4 }, to: { gridX: 3, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 4 }, to: { gridX: 4, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 4 }, to: { gridX: 4, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 3 }, to: { gridX: 4, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 2 }, to: { gridX: 4, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 1 }, to: { gridX: 4, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 0 }, to: { gridX: 5, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 0 }, to: { gridX: 5, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 1 }, to: { gridX: 5, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 2 }, to: { gridX: 5, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 3 }, to: { gridX: 5, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 4 }, to: { gridX: 5, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 5 }, to: { gridX: 4, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 5 }, to: { gridX: 3, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 5 }, to: { gridX: 2, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 5 }, to: { gridX: 1, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 5 }, to: { gridX: 0, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 5 }, to: { gridX: 0, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 6 }, to: { gridX: 1, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 6 }, to: { gridX: 2, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 6 }, to: { gridX: 3, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 6 }, to: { gridX: 4, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 6 }, to: { gridX: 5, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 6 }, to: { gridX: 6, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 6 }, to: { gridX: 6, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 5 }, to: { gridX: 6, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 4 }, to: { gridX: 6, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 3 }, to: { gridX: 6, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 2 }, to: { gridX: 6, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 1 }, to: { gridX: 6, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 0 }, to: { gridX: 7, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 0 }, to: { gridX: 7, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 1 }, to: { gridX: 7, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 2 }, to: { gridX: 7, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 3 }, to: { gridX: 7, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 4 }, to: { gridX: 7, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 5 }, to: { gridX: 7, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 7 }, to: { gridX: 5, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 7 }, to: { gridX: 4, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 7 }, to: { gridX: 3, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 7 }, to: { gridX: 2, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 7 }, to: { gridX: 1, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 7 }, to: { gridX: 0, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 7 }, to: { gridX: 0, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 8 }, to: { gridX: 1, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 8 }, to: { gridX: 2, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 2, gridY: 8 }, to: { gridX: 3, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 3, gridY: 8 }, to: { gridX: 4, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 4, gridY: 8 }, to: { gridX: 5, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 5, gridY: 8 }, to: { gridX: 6, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 6 }, to: { gridX: 7, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 7 }, to: { gridX: 6, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 6, gridY: 8 }, to: { gridX: 7, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 7, gridY: 8 }, to: { gridX: 8, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 8 }, to: { gridX: 8, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 7 }, to: { gridX: 8, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 6 }, to: { gridX: 8, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 5 }, to: { gridX: 8, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 4 }, to: { gridX: 8, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 3 }, to: { gridX: 8, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 2 }, to: { gridX: 8, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 1 }, to: { gridX: 8, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 8, gridY: 0 }, to: { gridX: 9, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 9, gridY: 0 }, to: { gridX: 9, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: 9, gridY: 1 }, to: { gridX: 9, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: 9, gridY: 2 }, to: { gridX: 9, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: 9, gridY: 3 }, to: { gridX: 9, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: 9, gridY: 4 }, to: { gridX: 9, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: 9, gridY: 5 }, to: { gridX: 9, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: 9, gridY: 6 }, to: { gridX: 9, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 1 }, to: { gridX: 1, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 1, gridY: 0 }, to: { gridX: 0, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: 0, gridY: 0 }, to: { gridX: -1, gridY: 0 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 0 }, to: { gridX: -1, gridY: 1 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 1 }, to: { gridX: -1, gridY: 2 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 2 }, to: { gridX: -1, gridY: 3 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 3 }, to: { gridX: -1, gridY: 4 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 4 }, to: { gridX: -1, gridY: 5 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 5 }, to: { gridX: -1, gridY: 6 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 6 }, to: { gridX: -1, gridY: 7 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 7 }, to: { gridX: -1, gridY: 8 }, color: '#FF0000' },
    { from: { gridX: -1, gridY: 8 }, to: { gridX: -1, gridY: 9 }, color: '#FF0000' }
  ];

  // 힌트 경로를 gridLines에 추가
  gridLines = [...gridLines, ...hintPath];

  // 화면 업데이트
  redrawCanvas();
  updateAnswerSheet();

  alert('✅ 정답이 표시되었습니다!\n빈칸이 채워지고 힌트 경로가 그려졌습니다.');
}

// 정답 출력 (사용자가 그린 도장과 선의 좌표 출력)
function exportAnswers() {
  console.clear();
  console.log('=== 📤 정답 및 힌트 라인 출력 ===\n');

  // 1. 도장 정답 출력
  console.log('// 정답 데이터');
  console.log('const answers = {');

  const stampEntries = Object.entries(gridStamps)
    .filter(([key]) => BLANK_CELLS.has(key))
    .sort((a, b) => {
      const [x1, y1] = a[0].split(',').map(Number);
      const [x2, y2] = b[0].split(',').map(Number);
      if (y1 !== y2) return y1 - y2;
      return x1 - x2;
    });

  stampEntries.forEach(([key, stamp], index) => {
    const [x, y] = key.split(',').map(Number);
    const isLast = index === stampEntries.length - 1;
    const shapeSymbol = {
      'star': '★',
      'spade': '♠',
      'diamond': '♦',
      'heart': '♥',
      'clover': '♣'
    }[stamp.shape] || stamp.shape;

    console.log(`  '${key}': { shape: '${stamp.shape}', color: SHAPE_COLORS['${stamp.shape}'] },    // (${x + 1},${y + 1}): ${shapeSymbol}${isLast ? '' : ','}`);
  });

  console.log('};\n');

  // 2. 힌트 라인 출력
  console.log('// 힌트 경로 (빨간 선)');
  console.log('const hintPath = [');

  const redLines = gridLines.filter(line => line.color === '#FF0000');
  redLines.forEach((line, index) => {
    const isLast = index === redLines.length - 1;
    console.log(`  { from: { gridX: ${line.from.gridX}, gridY: ${line.from.gridY} }, to: { gridX: ${line.to.gridX}, gridY: ${line.to.gridY} }, color: '${line.color}' }${isLast ? '' : ','}`);
  });

  console.log('];\n');

  // 3. 요약 정보
  console.log('=== 요약 ===');
  console.log(`도장 개수: ${stampEntries.length}개`);
  console.log(`힌트 라인 세그먼트: ${redLines.length}개`);
  console.log('\n콘솔을 확인하여 위 코드를 복사하세요!');

  alert('📤 정답이 콘솔에 출력되었습니다!\n\n개발자 도구(F12)를 열어 콘솔 탭을 확인하세요.');
}

// 도장 버튼 미리보기 그리기
function drawShapePreview() {
  document.querySelectorAll('.shape-btn').forEach(btn => {
    const shape = btn.dataset.shape;
    const canvas = btn.querySelector('.shape-preview');

    if (!canvas || !shape) return;

    canvas.width = 40;
    canvas.height = 40;
    const previewCtx = canvas.getContext('2d');

    const color = SHAPE_COLORS[shape];
    const size = 15;
    const x = 20;
    const y = 20;

    previewCtx.fillStyle = color;
    previewCtx.strokeStyle = color;
    previewCtx.lineWidth = 2;

    switch (shape) {
      case 'star':
        drawStarOn(previewCtx, x, y, 5, size, size / 2, color);
        break;
      case 'spade':
        drawSpadeOn(previewCtx, x, y, size, color);
        break;
      case 'diamond':
        drawDiamondOn(previewCtx, x, y, size, color);
        break;
      case 'heart':
        drawHeartOn(previewCtx, x, y, size, color);
        break;
      case 'clover':
        drawCloverOn(previewCtx, x, y, size, color);
        break;
    }
  });
}

// Context를 파라미터로 받는 보조 함수들
function drawStarOn(context, cx, cy, spikes, outerRadius, innerRadius, color) {
  context.fillStyle = color;
  context.beginPath();
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;

  context.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerRadius;
    let y = cy + Math.sin(rot) * outerRadius;
    context.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    context.lineTo(x, y);
    rot += step;
  }
  context.lineTo(cx, cy - outerRadius);
  context.closePath();
  context.fill();
}

function drawSpadeOn(context, x, y, size, color) {
  context.fillStyle = color;
  context.beginPath();

  const s = size * 0.9;

  context.moveTo(x, y - s);
  context.quadraticCurveTo(x - s * 0.7, y - s * 0.3, x - s * 0.5, y + s * 0.2);
  context.quadraticCurveTo(x - s * 0.3, y + s * 0.5, x - s * 0.2, y + s * 0.3);

  context.lineTo(x - s * 0.15, y + s * 0.5);
  context.lineTo(x - s * 0.2, y + s * 0.8);
  context.lineTo(x + s * 0.2, y + s * 0.8);
  context.lineTo(x + s * 0.15, y + s * 0.5);

  context.lineTo(x + s * 0.2, y + s * 0.3);
  context.quadraticCurveTo(x + s * 0.3, y + s * 0.5, x + s * 0.5, y + s * 0.2);
  context.quadraticCurveTo(x + s * 0.7, y - s * 0.3, x, y - s);

  context.closePath();
  context.fill();
}

function drawDiamondOn(context, x, y, size, color) {
  context.fillStyle = color;
  context.beginPath();

  const s = size * 0.85;

  context.moveTo(x, y - s);
  context.lineTo(x + s * 0.7, y);
  context.lineTo(x, y + s);
  context.lineTo(x - s * 0.7, y);

  context.closePath();
  context.fill();
}

function drawHeartOn(context, x, y, size, color) {
  context.fillStyle = color;
  context.beginPath();

  const s = size * 0.85;
  const topCurveHeight = s * 0.3;
  const offsetY = -s * 0.15;

  context.moveTo(x, y + topCurveHeight + offsetY);

  context.bezierCurveTo(
    x, y + offsetY,
    x - s / 2, y + offsetY,
    x - s / 2, y + topCurveHeight + offsetY
  );
  context.bezierCurveTo(
    x - s / 2, y + (s + topCurveHeight) / 2 + offsetY,
    x, y + (s + topCurveHeight) / 1.2 + offsetY,
    x, y + s + offsetY
  );

  context.bezierCurveTo(
    x, y + (s + topCurveHeight) / 1.2 + offsetY,
    x + s / 2, y + (s + topCurveHeight) / 2 + offsetY,
    x + s / 2, y + topCurveHeight + offsetY
  );
  context.bezierCurveTo(
    x + s / 2, y + offsetY,
    x, y + offsetY,
    x, y + topCurveHeight + offsetY
  );

  context.closePath();
  context.fill();
}

function drawCloverOn(context, x, y, size, color) {
  context.fillStyle = color;

  const s = size * 0.85;
  const r = s * 0.35;

  context.beginPath();
  context.arc(x - r * 0.7, y - r * 0.5, r, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.arc(x + r * 0.7, y - r * 0.5, r, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.arc(x, y - r * 1.4, r, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.moveTo(x - s * 0.1, y + s * 0.1);
  context.lineTo(x - s * 0.15, y + s * 0.7);
  context.lineTo(x + s * 0.15, y + s * 0.7);
  context.lineTo(x + s * 0.1, y + s * 0.1);
  context.closePath();
  context.fill();
}

// 답안지 생성 및 업데이트
function updateAnswerSheet() {
  const answerList = document.getElementById('answerList');
  answerList.innerHTML = '';

  // BLANK_CELLS를 배열로 변환하고 정렬
  const blankCellsArray = Array.from(BLANK_CELLS).sort((a, b) => {
    const [x1, y1] = a.split(',').map(Number);
    const [x2, y2] = b.split(',').map(Number);
    // y좌표 먼저, 그 다음 x좌표로 정렬 (행 우선)
    if (y1 !== y2) return y1 - y2;
    return x1 - x2;
  });

  blankCellsArray.forEach(key => {
    const [x, y] = key.split(',').map(Number);
    const answerItem = document.createElement('div');
    answerItem.className = 'answer-item';

    // 해당 좌표에 도장이 찍혀있는지 확인
    const stamp = gridStamps[key];
    if (stamp) {
      // 도장이 있으면 모양 이모지로 표시
      const shapeEmoji = {
        'star': '⭐',
        'spade': '♠️',
        'diamond': '♦️',
        'heart': '❤️',
        'clover': '♣️'
      };
      answerItem.innerHTML = `<strong>빈칸 (${x + 1}, ${y + 1}):</strong> [ ${shapeEmoji[stamp.shape] || stamp.shape} ]`;
    } else {
      answerItem.innerHTML = `<strong>빈칸 (${x + 1}, ${y + 1}):</strong> [ ]`;
    }

    answerList.appendChild(answerItem);
  });
}

// 초기화
window.onload = () => {
  drawShapePreview();  // 도장 버튼 미리보기 그리기
  updateAnswerSheet();  // 답안지 생성
  drawGrid();
  // 자동으로 퍼즐 로드
  newPuzzle();
};
