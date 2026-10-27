/* =========================================================
   락페에서 살아남기 — 동작
   ========================================================= */

const STAGE_W = 1728;
const STAGE_H = 1117;
const stage = document.getElementById("stage");
let stageScale = 1;

/* ---------- 시간 설정 (초) ---------- */
const PRACTICE_SECONDS = 15;   // 8페이지: 자동으로 넘어가기까지
const GAME_SECONDS     = 60;   // 9페이지: 제한 시간 1분
const HOME_BTN_SECONDS = 10;   // 12페이지: '처음으로' 버튼이 나오기까지

/* ---------- 1. 화면 크기에 맞춰 스테이지 확대/축소 ---------- */
function fitStage() {
  stageScale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  stage.style.transform = `scale(${stageScale})`;
}
window.addEventListener("resize", fitStage);
fitStage();

/* ---------- 2. 타이틀 글자를 한 글자씩 쪼개서 파도 모션 ---------- */
let charIndex = 0;
document.querySelectorAll(".title-line").forEach((line) => {
  [...line.dataset.text].forEach((ch) => {
    const span = document.createElement("span");
    span.className = "wave-char";
    span.textContent = ch;
    span.style.setProperty("--i", charIndex++);
    line.appendChild(span);
  });
});

/* ---------- 4. 타이핑 효과 ---------- */
const TYPE_SPEED = 55; // 글자당 ms
const typers = new Map();

function startTyping(page) {
  const el = page.querySelector(".typing");
  if (!el) return;
  const btn = page.querySelector(".after-typing");
  const text = JSON.parse(el.dataset.lines).join("\n");

  stopTyping(page);
  fitText(el, text);
  el.textContent = "";
  el.classList.remove("done");
  if (btn) btn.classList.remove("show");

  let i = 0;
  const state = {};
  state.finish = () => {
    clearInterval(state.timer);
    el.textContent = text;
    el.classList.add("done");
    if (btn) btn.classList.add("show");
  };
  state.timer = setInterval(() => {
    i++;
    el.textContent = text.slice(0, i);
    if (i % 2 === 0 && text[i - 1] !== " ") Sound.play("type");
    if (i >= text.length) state.finish();
  }, TYPE_SPEED);
  typers.set(page, state);
}
// 대화창 밖으로 글자가 넘치지 않도록, 전체 문장을 미리 넣어 보고 글자 크기를 줄임
function fitText(el, text) {
  const box = el.closest(".dialog");
  if (!box) return;
  el.style.fontSize = "";
  el.textContent = text;
  let size = parseFloat(getComputedStyle(el).fontSize);
  while ((box.scrollHeight > box.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && size > 24) {
    size -= 2;
    el.style.fontSize = size + "px";
  }
}
function stopTyping(page) {
  const t = typers.get(page);
  if (t) clearInterval(t.timer);
}
// 타이핑 중 대화창을 클릭하면 바로 전체 문장 표시
document.querySelectorAll(".dialog-lg").forEach((box) => {
  box.addEventListener("click", () => {
    const t = typers.get(box.closest(".page"));
    if (t) t.finish();
  });
});

/* ---------- 5. 페이지 이동 ---------- */
let currentPage = "p1";
let pageTimers = [];
function later(fn, ms) { pageTimers.push(setTimeout(fn, ms)); }
function every(fn, ms) { pageTimers.push(setInterval(fn, ms)); }

function goTo(id) {
  const next = document.getElementById(id);
  if (!next) return;

  // 이전 페이지 정리
  pageTimers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  pageTimers = [];
  document.querySelectorAll(".page.is-active").forEach((p) => {
    p.classList.remove("is-active");
    stopTyping(p);
  });
  if (currentPage === "p9") stopGame();
  closeModal();

  currentPage = id;
  next.classList.add("is-active");
  later(() => startTyping(next), 350);

  // 페이지별 동작
  if (PAGE_ENTER[id]) PAGE_ENTER[id]();
}

document.querySelectorAll("[data-go]").forEach((btn) => {
  btn.addEventListener("click", () => {
    Sound.play(btn.classList.contains("bag-card") ? "pick" : "click");
    goTo(btn.dataset.go);
  });
});

const PAGE_ENTER = {
  p1() {
    resetAll();
  },
  p5() { later(() => Sound.play("correct"), 250); },
  p6() { later(() => Sound.play("wrong"), 250); },
  p7() { later(() => Sound.play("wrong"), 250); },
  p8() {
    startCamera();
    loadHandTracker();
    let left = PRACTICE_SECONDS;
    const countEl = document.getElementById("p8-count");
    countEl.textContent = left;
    every(() => {
      left--;
      countEl.textContent = Math.max(left, 0);
      if (left > 0 && left <= 5) Sound.play("tick", false);
      if (left <= 0) goTo("p9");
    }, 1000);
  },
  p9() {
    startCamera();
    loadHandTracker();
    startGame();
    Sound.play("start");
    Sound.setIntensity(1);
  },
  p10() {
    buildItemGrid();
  },
  p12() {
    startCamera();
    loadHandTracker();
    Gesture.loadSegmenter();
    Gesture.reset();
    later(() => Sound.play("cheer"), 300);
    const btn = document.getElementById("home-btn");
    btn.classList.remove("show");
    later(() => btn.classList.add("show"), HOME_BTN_SECONDS * 1000);
  },
};

/* =========================================================
   6. 카메라
   ========================================================= */
let camStream = null;
let camStarting = null;
const videos = [...document.querySelectorAll(".cam-video")];

function setCamMsg(text) {
  document.querySelectorAll(".cam-msg").forEach((m) => (m.textContent = text));
}

function startCamera() {
  if (camStream) return Promise.resolve(camStream);
  if (camStarting) return camStarting;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCamMsg("이 브라우저에서는 카메라를 쓸 수 없어요.\n마우스로 가방을 움직여 주세요.");
    return Promise.resolve(null);
  }
  setCamMsg("카메라를 켜는 중이에요…");
  camStarting = navigator.mediaDevices
    .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false })
    .then((stream) => {
      camStream = stream;
      videos.forEach((v) => { v.srcObject = stream; v.play().catch(() => {}); });
      setCamMsg("");
      return stream;
    })
    .catch((err) => {
      console.warn("카메라 오류:", err);
      setCamMsg("카메라를 켤 수 없어요 (권한을 확인해 주세요).\n마우스로 가방을 움직여도 돼요!");
      return null;
    })
    .finally(() => { camStarting = null; });
  return camStarting;
}

function stopCamera() {
  if (!camStream) return;
  camStream.getTracks().forEach((t) => t.stop());
  camStream = null;
  videos.forEach((v) => (v.srcObject = null));
}

/* =========================================================
   7. 손가락 인식 (MediaPipe Hand Landmarker)
   ========================================================= */
const MP_VERSION = "0.10.14";
let handLandmarker = null;
let handLoading = false;
let handX = null;          // 검지 끝의 가로 위치 (0 = 화면 왼쪽, 1 = 오른쪽)
let lastHandTime = 0;
let lastLandmarks = null;

async function loadHandTracker() {
  if (handLandmarker || handLoading) return;
  handLoading = true;
  try {
    const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
    );
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,        // 12페이지 양손 하트를 위해 두 손까지
    });
  } catch (err) {
    console.warn("손 인식 로드 실패:", err);
    document.querySelector(".cam-hint").innerHTML = "손 인식을 불러오지 못했어요.<br>마우스로 가방을 움직여 주세요!";
  }
  handLoading = false;
}

let lastVideoTime = -1;
function detectHand() {
  if (!handLandmarker || !camStream) return;
  if (currentPage !== "p8" && currentPage !== "p9" && currentPage !== "p12") return;
  const trackVideo = document.querySelector(`#${currentPage} .cam-video`);
  if (trackVideo.readyState < 2 || trackVideo.currentTime === lastVideoTime) return;
  lastVideoTime = trackVideo.currentTime;

  const res = handLandmarker.detectForVideo(trackVideo, performance.now());
  if (currentPage === "p12") { Gesture.update(res.landmarks || [], performance.now()); return; }
  if (res.landmarks && res.landmarks.length) {
    lastLandmarks = res.landmarks[0];
    handX = 1 - lastLandmarks[8].x;      // 8번 = 검지 끝, 거울 화면이라 좌우 반전
    lastHandTime = performance.now();
  } else {
    lastLandmarks = null;
  }
}

// 카메라 위에 손가락 위치 그리기
const HAND_LINKS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
function drawHand() {
  const page = document.getElementById(currentPage);
  const canvas = page && page.querySelector(".cam-overlay");
  if (!canvas) return;
  const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, cw, ch);
  const trackVideo = page.querySelector(".cam-video");
  if (!lastLandmarks || !trackVideo.videoWidth) return;

  // object-fit: cover 와 같은 방식으로 좌표 맞추기
  const vw = trackVideo.videoWidth, vh = trackVideo.videoHeight;
  const sc = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * sc) / 2, oy = (ch - vh * sc) / 2;
  const P = (p) => [p.x * vw * sc + ox, p.y * vh * sc + oy];

  const small = cw < 400;
  ctx.lineWidth = small ? 2 : 5;
  ctx.strokeStyle = "rgba(195,255,46,.9)";
  HAND_LINKS.forEach(([a, b]) => {
    const [x1, y1] = P(lastLandmarks[a]), [x2, y2] = P(lastLandmarks[b]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  const [tx, ty] = P(lastLandmarks[8]);
  ctx.fillStyle = "#ff00c8";
  ctx.beginPath(); ctx.arc(tx, ty, small ? 9 : 24, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = small ? 3 : 6; ctx.strokeStyle = "#fff"; ctx.stroke();
}

/* ---------- 마우스 / 터치 / 키보드 (카메라가 없을 때 대신) ---------- */
let pointerX = null;
stage.addEventListener("pointermove", (e) => {
  const r = stage.getBoundingClientRect();
  pointerX = (e.clientX - r.left) / stageScale / STAGE_W;
});
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

/* =========================================================
   8. 게임 (9페이지)
   ========================================================= */
const field = document.getElementById("game-field");
const bagEl = document.getElementById("game-bag");
const timerEl = document.getElementById("timer");
const timerBox = timerEl.parentElement;
const countEl = document.getElementById("caught-count");

const BAG_W = 250;
const BAG_H = BAG_W * (925 / 600);       // bag_sky.png 비율
const BAG_TOP = STAGE_H + 70 - BAG_H;    // CSS bottom: -70px
const DROP = 130;                        // 떨어지는 아이템 크기
const GOOD_RATIO = 0.6;                  // 좋은 아이템이 나올 확률

let game = null;
let caught = new Map();                  // id → 담은 개수 (10페이지에서 사용)
const goodItems = ITEMS.filter((i) => i.good);
const badItems  = ITEMS.filter((i) => !i.good);

function startGame() {
  stopGame();
  field.innerHTML = "";
  caught = new Map();
  countEl.textContent = 0;
  game = {
    drops: [],
    start: performance.now(),
    end: performance.now() + GAME_SECONDS * 1000,
    nextSpawn: performance.now() + 600,
    bagX: (STAGE_W - BAG_W) / 2,
    running: true,
  };
  updateTimer(GAME_SECONDS * 1000);
}

function stopGame() {
  Sound.setIntensity(0);
  if (game) game.running = false;
}

function spawnDrop(now) {
  Sound.play("drop");
  const pool = Math.random() < GOOD_RATIO ? goodItems : badItems;
  const item = pool[Math.floor(Math.random() * pool.length)];
  const img = document.createElement("img");
  img.className = "drop";
  img.src = item.src;
  img.alt = "";
  field.appendChild(img);

  const elapsed = (now - game.start) / 1000;
  game.drops.push({
    item, el: img,
    x: 40 + Math.random() * (STAGE_W - 360 - DROP),   // 오른쪽 카메라 영역은 피해서
    y: -DROP - 20,
    vy: 240 + Math.random() * 120 + elapsed * 2.2,   // 시간이 갈수록 조금씩 빨라짐
    rot: Math.random() * 40 - 20,
    vr: Math.random() * 90 - 45,
  });
  game.nextSpawn = now + Math.max(450, 850 - elapsed * 4) + Math.random() * 250;
}

// 받침이 있으면 '을', 없으면 '를'
function josa(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 ? "을" : "를";
}

function catchDrop(d) {
  Sound.play(d.item.good ? "good" : "bad");
  caught.set(d.item.id, (caught.get(d.item.id) || 0) + 1);
  countEl.textContent = [...caught.values()].reduce((a, b) => a + b, 0);

  const pop = document.createElement("div");
  pop.className = "pop-text" + (d.item.good ? "" : " bad");
  pop.textContent = d.item.good ? `${d.item.name} 획득!` : `이런! ${d.item.name}${josa(d.item.name)} 담았다…`;
  pop.style.left = Math.min(Math.max(game.bagX + BAG_W / 2, 260), STAGE_W - 260) + "px";
  pop.style.top = BAG_TOP - 90 + "px";
  field.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);

  bagEl.classList.remove("bump");
  void bagEl.offsetWidth;
  bagEl.classList.add("bump");
}

function updateTimer(ms) {
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  timerEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
  timerBox.classList.toggle("hurry", ms > 0 && ms <= 10000);
}

function updateGame(now, dt) {
  if (!game || !game.running) return;

  // 남은 시간
  const left = game.end - now;
  updateTimer(left);
  const secLeft = Math.ceil(left / 1000);
  if (secLeft !== game.lastSec) {
    if (secLeft > 0 && secLeft <= 5) Sound.play("tick", secLeft === 1);
    game.lastSec = secLeft;
  }
  if (left <= 0) { game.running = false; Sound.play("timeup"); goTo("p10"); return; }

  // 가방 위치: 손가락 > 마우스 > 키보드
  let target = null;
  if (handX !== null && now - lastHandTime < 600) {
    const t = Math.min(Math.max((handX - 0.15) / 0.7, 0), 1);   // 화면 가운데 70%만 움직여도 끝까지 가도록
    target = t * (STAGE_W - BAG_W);
  } else if (pointerX !== null) {
    target = pointerX * STAGE_W - BAG_W / 2;
  }
  if (keys.ArrowLeft)  target = game.bagX - 900 * dt;
  if (keys.ArrowRight) target = game.bagX + 900 * dt;
  if (target !== null) {
    target = Math.min(Math.max(target, 0), STAGE_W - BAG_W);
    game.bagX += (target - game.bagX) * Math.min(1, dt * 12);
  }
  bagEl.style.transform = `translateX(${game.bagX}px)`;

  // 아이템 떨어뜨리기
  if (now >= game.nextSpawn) spawnDrop(now);

  const mouthL = game.bagX + BAG_W * 0.12;
  const mouthR = game.bagX + BAG_W * 0.88;
  game.drops = game.drops.filter((d) => {
    d.y += d.vy * dt;
    d.rot += d.vr * dt;
    const cx = d.x + DROP / 2;
    const bottom = d.y + DROP * 0.85;

    if (bottom >= BAG_TOP + 20 && bottom <= BAG_TOP + 110 && cx >= mouthL && cx <= mouthR) {
      catchDrop(d);
      d.el.remove();
      return false;
    }
    if (d.y > STAGE_H) { d.el.remove(); return false; }
    d.el.style.transform = `translate(${d.x}px, ${d.y}px) rotate(${d.rot}deg)`;
    return true;
  });
}

/* ---------- 메인 루프 ---------- */
let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  try { detectHand(); } catch (e) { /* 프레임 하나 건너뜀 */ }
  drawHand();
  updateGame(now, dt);
  if (currentPage === "p12") { try { Gesture.render(now); } catch (e) { console.warn(e); } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* =========================================================
   9. 챙긴 준비물 (10페이지) + 상세 팝업 (11페이지)
   ========================================================= */
const grid = document.getElementById("item-grid");
const modal = document.getElementById("item-modal");

function buildItemGrid() {
  grid.innerHTML = "";
  document.getElementById("grid-empty").classList.toggle("show", caught.size === 0);
  let n = 0;
  caught.forEach((count, id) => {
    const item = ITEMS[id];
    const cell = document.createElement("button");
    cell.className = "item-cell" + (item.good ? "" : " bad");
    cell.style.animationDelay = `${n++ * 0.05}s`;
    cell.innerHTML = `<img src="${item.src}" alt=""><span>${item.name}${count > 1 ? `<em class="cnt">×${count}</em>` : ""}</span>`;
    cell.addEventListener("click", () => openModal(item));
    grid.appendChild(cell);
  });
}

function openModal(item) {
  Sound.play("open");
  document.getElementById("modal-name").textContent = item.name;
  document.getElementById("modal-img").src = item.src;
  document.getElementById("modal-img").alt = item.name;
  document.getElementById("modal-desc").textContent = item.desc;
  document.getElementById("modal-char").src = item.good ? "img/char_happy.png" : "img/char_sweat.png";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
document.getElementById("modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* =========================================================
   10. 처음으로 돌아가면 초기화
   ========================================================= */
function resetAll() {
  stopGame();
  caught = new Map();
  field.innerHTML = "";
  stopCamera();
}

/* ---------- 이미지 미리 불러오기 ---------- */
["bg.jpg", "bg_crowd.jpg", "bg_light.jpg", "bg_neon.jpg", "rock_btn.png",
 "p1_char.png", "p2_char.png", "p3_char.png", "p4_bar.png", "p8_bar.png",
 "char_happy.png", "char_think.png", "char_sweat.png",
 "card_black.png", "card_sky.png", "card_beige.png", "bag_sky.png"].forEach((f) => { new Image().src = `img/${f}`; });
ITEMS.forEach((it) => { new Image().src = it.src; });
