/* =========================================================
   락페에서 살아남기 — 손동작 인식 + 인증샷 효과 (12페이지)

   🤘 락피스 → 사람 뒤에서 폭죽이 펑펑
   ✌️ 브이   → 플래시 + 반짝이·색종이가 사람 뒤로
   🫶 하트   → 사람 머리 뒤로 커다란 하트 + 하트가 둥실둥실

   ▸ 얼굴을 가리지 않도록 "사람 분리(셀피 세그멘테이션)"로
     카메라 화면을 [배경] → [효과] → [사람] 순서로 겹쳐 그려요.
   ▸ 효과는 EFFECT_SECONDS 동안 이어져서 사진 찍을 시간이 있어요.
   ========================================================= */

const EFFECT_SECONDS = 8;     // 효과가 이어지는 시간 (초)

const Gesture = (() => {
  const HOLD_FRAMES = 6;      // 이만큼 연속으로 같은 동작이 보여야 인정 (오작동 방지)
  const COOLDOWN = 1500;      // 같은 동작을 다시 인정하기까지 (ms)

  const INFO = {
    rock:  { emoji: "🤘", text: "ROCK!!",      sound: "rock"  },
    peace: { emoji: "✌️", text: "찰칵! 브이~", sound: "peace" },
    heart: { emoji: "🫶", text: "사랑해 락페!", sound: "heart" },
  };

  /* =======================================================
     1. 손동작 판별
     ======================================================= */
  let candidate = null, count = 0;
  const lastFired = { rock: 0, peace: 0, heart: 0 };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const extended = (lm, tip, pip) => dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.12;
  const handSize = (lm) => dist(lm[0], lm[9]);

  function classifyOne(lm) {
    const f = { index: extended(lm, 8, 6), middle: extended(lm, 12, 10), ring: extended(lm, 16, 14), pinky: extended(lm, 20, 18) };
    const size = handSize(lm);
    if (f.index && f.pinky && !f.middle && !f.ring) return "rock";
    if (f.index && f.middle && !f.ring && !f.pinky && dist(lm[8], lm[12]) > size * 0.25) return "peace";
    if (!f.middle && !f.ring && !f.pinky && dist(lm[4], lm[8]) < size * 0.35 && dist(lm[8], lm[0]) > size * 0.9) return "heart";
    return null;
  }
  function classify(hands) {
    if (hands.length >= 2) {
      const [a, b] = hands;
      const size = (handSize(a) + handSize(b)) / 2;
      if (dist(a[8], b[8]) < size * 0.6 && dist(a[4], b[4]) < size * 0.6 && dist(a[8], a[4]) > size * 0.5) return "heart";
    }
    for (const lm of hands) { const g = classifyOne(lm); if (g) return g; }
    return null;
  }

  function update(hands, now) {
    const g = hands && hands.length ? classify(hands) : null;
    if (g && g === candidate) count++;
    else { candidate = g; count = g ? 1 : 0; }
    if (g && count === HOLD_FRAMES && now - lastFired[g] > COOLDOWN) {
      lastFired[g] = now;
      fire(g);
    }
  }

  /* =======================================================
     2. 사람 분리 (MediaPipe Image Segmenter)
     ======================================================= */
  let segmenter = null, segLoading = false;
  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d");
  let maskReady = false;
  let head = null;            // 머리 위치 (영상 좌표 0~1)

  async function loadSegmenter() {
    if (segmenter || segLoading) return;
    segLoading = true;
    try {
      const v = typeof MP_VERSION !== "undefined" ? MP_VERSION : "0.10.14";
      const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${v}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${v}/wasm`);
      segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    } catch (err) {
      console.warn("사람 분리 로드 실패 (효과가 사람 위에 그려져요):", err);
    }
    segLoading = false;
  }

  let lastSegTime = -1, segTs = 0;
  function segment(video) {
    if (!segmenter || video.readyState < 2 || video.currentTime === lastSegTime) return;
    lastSegTime = video.currentTime;
    segTs = Math.max(segTs + 1, performance.now());
    segmenter.segmentForVideo(video, segTs, (res) => {
      const ms = res.confidenceMasks;
      const m = ms && ms[ms.length - 1];   // 마지막 마스크 = 사람
      if (!m) return;
      const w = m.width, h = m.height, data = m.getAsFloat32Array();
      if (maskCanvas.width !== w) { maskCanvas.width = w; maskCanvas.height = h; }
      const img = maskCtx.createImageData(w, h);
      let top = h, sumX = 0, nX = 0;
      for (let i = 0; i < data.length; i++) {
        const a = data[i];
        img.data[i * 4 + 3] = a > 0.55 ? 255 : a > 0.35 ? (a - 0.35) * 1275 : 0;   // 경계를 부드럽게
        if (a > 0.6) { const y = (i / w) | 0; if (y < top) top = y; }
      }
      // 머리 위치: 사람 실루엣 맨 윗부분의 가운데
      if (top < h) {
        const band = Math.min(h, top + h * 0.12);
        for (let y = top; y < band; y++) for (let x = 0; x < w; x++) if (data[y * w + x] > 0.6) { sumX += x; nX++; }
        const hx = sumX / Math.max(nX, 1) / w, hy = (top + h * 0.13) / h;
        head = head ? { x: head.x * 0.8 + hx * 0.2, y: head.y * 0.8 + hy * 0.2 } : { x: hx, y: hy };
      } else head = null;
      maskCtx.putImageData(img, 0, 0);
      maskReady = true;
    });
  }

  /* =======================================================
     3. 화면 그리기  [영상] → [효과] → [사람]
     ======================================================= */
  const canvas = document.getElementById("pose-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const personCanvas = document.createElement("canvas");
  const pctx = personCanvas.getContext("2d");

  let effect = null;          // { type, start, end }
  let parts = [];             // 파티클
  let rockets = [];
  let nextLaunch = 0;

  function coverRect(vw, vh, cw, ch) {
    const sc = Math.max(cw / vw, ch / vh);
    return { sc, ox: (cw - vw * sc) / 2, oy: (ch - vh * sc) / 2 };
  }
  // 거울처럼 좌우 반전해서 그리기
  function drawMirrored(c, src, vw, vh, cw, ch) {
    const { sc, ox, oy } = coverRect(vw, vh, cw, ch);
    c.save();
    c.translate(cw, 0); c.scale(-1, 1);
    c.drawImage(src, ox, oy, vw * sc, vh * sc);
    c.restore();
  }
  function headOnCanvas(video, cw, ch) {
    if (!head) return { x: cw / 2, y: ch * 0.32 };
    const { sc, ox, oy } = coverRect(video.videoWidth, video.videoHeight, cw, ch);
    return { x: cw - (ox + head.x * video.videoWidth * sc), y: oy + head.y * video.videoHeight * sc };
  }

  function render(now) {
    if (!ctx) return;
    const video = document.querySelector("#p12 .cam-video");
    const cw = canvas.width, ch = canvas.height;
    if (!video || video.readyState < 2 || !video.videoWidth) { ctx.clearRect(0, 0, cw, ch); return; }
    const vw = video.videoWidth, vh = video.videoHeight;

    segment(video);

    // ① 배경까지 포함한 영상
    drawMirrored(ctx, video, vw, vh, cw, ch);

    // ② 효과
    stepEffect(now, video, cw, ch);
    drawParts(ctx, now);

    // ③ 사람만 오려서 맨 위에
    if (segmenter && maskReady && (parts.length || rockets.length || effect)) {
      if (personCanvas.width !== cw) { personCanvas.width = cw; personCanvas.height = ch; }
      pctx.globalCompositeOperation = "copy";
      drawMirrored(pctx, video, vw, vh, cw, ch);
      pctx.globalCompositeOperation = "destination-in";
      pctx.imageSmoothingEnabled = true;
      drawMirrored(pctx, maskCanvas, vw, vh, cw, ch);   // 마스크를 영상과 같은 자리에 늘여 그림
      pctx.globalCompositeOperation = "source-over";
      ctx.drawImage(personCanvas, 0, 0);
    }

    updateSticker(now);
  }

  /* ---------- 파티클 ---------- */
  const COLORS = ["#ff00c8", "#c3ff2e", "#ffffff", "#ffd1f4", "#7df9ff", "#ffe14d"];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function burst(x, y, color) {
    const n = 70;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rand(-0.05, 0.05), sp = rand(180, 520);
      parts.push({ kind: "spark", x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 260, drag: 0.985,
        life: rand(1.1, 1.8), age: 0, size: rand(3, 6), color: Math.random() < 0.25 ? "#fff" : color });
    }
    parts.push({ kind: "glow", x, y, life: 0.35, age: 0, size: 160, color });
    Sound.play("pop");
  }

  function stepEffect(now, video, cw, ch) {
    if (!effect) return;
    if (now > effect.end) { effect = null; return; }
    const t = (now - effect.start) / 1000;
    const hp = headOnCanvas(video, cw, ch);

    if (effect.type === "rock") {
      // 폭죽: 아래에서 쏘아 올려서 사람 뒤 하늘에서 터짐
      if (now > nextLaunch) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = Math.random() < 0.3 ? rand(cw * 0.1, cw * 0.9) : hp.x + side * rand(cw * 0.12, cw * 0.42);
        rockets.push({ x: Math.min(Math.max(x, 60), cw - 60), y: ch + 10, vy: rand(-900, -760),
          targetY: rand(ch * 0.12, ch * 0.45), color: pick(COLORS) });
        nextLaunch = now + rand(260, 520);
      }
      if (Math.random() < 0.25) parts.push(emojiPart(pick(["🤘", "⚡", "🔥", "🎸"]), rand(0, cw), ch + 40, rand(-40, 40), rand(-260, -160), rand(40, 70)));
    }

    if (effect.type === "peace") {
      // 색종이 + 반짝이 + 떠오르는 브이
      for (let i = 0; i < 3; i++) {
        parts.push({ kind: "confetti", x: rand(0, cw), y: -20, vx: rand(-60, 60), vy: rand(120, 260), g: 30, drag: 1,
          life: 6, age: 0, size: rand(10, 18), rot: rand(0, 6.28), vr: rand(-6, 6), color: pick(COLORS) });
      }
      if (Math.random() < 0.35) parts.push({ kind: "star", x: rand(0, cw), y: rand(0, ch), life: rand(0.8, 1.6), age: 0, size: rand(16, 34), color: pick(["#fff", "#ffe14d", "#c3ff2e"]) });
      if (Math.random() < 0.08) parts.push(emojiPart(pick(["✌️", "📸", "⭐"]), rand(0, cw), ch + 40, rand(-30, 30), rand(-200, -120), rand(50, 80)));
    }

    if (effect.type === "heart") {
      // 머리 뒤 커다란 하트는 drawParts 에서, 여기선 작은 하트들
      if (Math.random() < 0.45) {
        parts.push({ kind: "heart", x: rand(0, cw), y: ch + 30, vx: rand(-20, 20), vy: rand(-220, -120), g: 0, drag: 1,
          life: 5, age: 0, size: rand(18, 42), wob: rand(0, 6.28), color: pick(["#ff00c8", "#ff5fb8", "#ffd1f4", "#ff2e63"]) });
      }
      effect.head = hp;
      effect.t = t;
    }
  }

  function emojiPart(ch, x, y, vx, vy, size) {
    return { kind: "emoji", ch, x, y, vx, vy, g: 0, drag: 1, life: 5, age: 0, size, rot: rand(-0.4, 0.4) };
  }

  let lastDraw = 0;
  function drawParts(c, now) {
    const dt = Math.min((now - (lastDraw || now)) / 1000, 0.05);
    lastDraw = now;
    const cw = canvas.width, ch = canvas.height;

    // 큰 하트 (머리 뒤)
    if (effect && effect.type === "heart" && effect.head) {
      const k = Math.min(1, effect.t * 3);                       // 등장
      const fade = Math.min(1, (effect.end - now) / 600);        // 퇴장
      const pulse = 1 + Math.sin(effect.t * 6) * 0.05;
      const s = ch * 0.5 * k * pulse;
      c.save();
      c.globalAlpha = 0.92 * fade;
      c.translate(effect.head.x, effect.head.y + s * 0.15);
      heartPath(c, s);
      c.fillStyle = "#ff00c8"; c.fill();
      c.lineWidth = 16; c.strokeStyle = "#ffd1f4"; c.stroke();
      c.globalAlpha = 0.5 * fade;
      heartPath(c, s * 1.18);
      c.lineWidth = 10; c.strokeStyle = "#c3ff2e"; c.stroke();
      c.restore();
    }

    // 폭죽 로켓
    rockets = rockets.filter((r) => {
      r.y += r.vy * dt; r.vy += 380 * dt;
      c.fillStyle = r.color;
      c.beginPath(); c.arc(r.x, r.y, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(255,255,255,.5)";
      c.fillRect(r.x - 1.5, r.y, 3, 30);
      if (r.y <= r.targetY || r.vy >= -60) { burst(r.x, r.y, r.color); return false; }
      return true;
    });

    parts = parts.filter((p) => {
      p.age += dt;
      if (p.age > p.life || p.y > ch + 80 || p.y < -200) return false;
      if (p.vx !== undefined) {
        p.vx *= p.drag || 1; p.vy = p.vy * (p.drag || 1) + (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      const life = 1 - p.age / p.life;
      c.save();
      switch (p.kind) {
        case "spark":
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = Math.max(life, 0);
          c.fillStyle = p.color;
          c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + life * 0.5), 0, Math.PI * 2); c.fill();
          break;
        case "glow": {
          const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
          c.globalAlpha = life; c.fillStyle = gr;
          c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
          break;
        }
        case "confetti":
          p.rot += p.vr * dt;
          c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.abs(Math.cos(p.rot * 1.3)) + 0.2);
          c.fillStyle = p.color; c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        case "star":
          c.globalAlpha = Math.sin(life * Math.PI);
          c.translate(p.x, p.y);
          starPath(c, p.size * (0.6 + Math.sin(life * Math.PI) * 0.4));
          c.fillStyle = p.color; c.fill();
          break;
        case "heart":
          p.wob += dt * 3;
          c.globalAlpha = Math.min(1, life * 2);
          c.translate(p.x + Math.sin(p.wob) * 20, p.y);
          heartPath(c, p.size);
          c.fillStyle = p.color; c.fill();
          break;
        case "emoji":
          c.globalAlpha = Math.min(1, life * 2);
          c.translate(p.x, p.y); c.rotate(p.rot);
          c.font = `${p.size}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
          c.fillText(p.ch, 0, 0);
          break;
      }
      c.restore();
      return true;
    });
  }

  function heartPath(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.35);
    c.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.45, -s * 0.85, 0, -s * 0.4);
    c.bezierCurveTo(s * 0.45, -s * 0.85, s * 0.9, -s * 0.2, 0, s * 0.35);
    c.closePath();
  }
  function starPath(c, r) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.25 : r;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }

  /* =======================================================
     4. 동작 인정 → 효과 시작
     ======================================================= */
  const sticker = document.getElementById("pose-sticker");

  function fire(g) {
    const info = INFO[g];
    const now = performance.now();
    Sound.play(info.sound);
    effect = { type: g, start: now, end: now + EFFECT_SECONDS * 1000 };
    nextLaunch = now;

    if (g === "peace") {
      const flash = document.createElement("div");
      flash.className = "pose-flash";
      document.querySelector(".cam-p12").appendChild(flash);
      setTimeout(() => flash.remove(), 500);
    }

    // 왼쪽 위 스티커 (얼굴 안 가리는 위치)
    if (sticker) {
      sticker.className = `pose-sticker show pose-${g}`;
      sticker.querySelector(".pose-emoji").textContent = info.emoji;
      sticker.querySelector(".pose-text").textContent = info.text;
    }
    const chip = document.querySelector(`.pose-chip[data-g="${g}"]`);
    if (chip) { chip.classList.remove("hit"); void chip.offsetWidth; chip.classList.add("hit"); }
  }

  function updateSticker(now) {
    if (!sticker) return;
    const bar = sticker.querySelector(".pose-bar i");
    if (effect) bar.style.transform = `scaleX(${Math.max(0, (effect.end - now) / (effect.end - effect.start))})`;
    else if (sticker.classList.contains("show")) sticker.classList.remove("show");
  }

  function reset() {
    candidate = null; count = 0;
    effect = null; parts = []; rockets = [];
    if (sticker) sticker.classList.remove("show");
  }

  return { update, reset, fire, render, loadSegmenter };
})();
