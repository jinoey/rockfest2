/* =========================================================
   락페에서 살아남기 — 사운드
   배경음악과 효과음을 모두 브라우저(Web Audio)에서 직접 만들어요.
   → 저작권 걱정 없음, 따로 음원 파일이 필요 없음.

   ※ 직접 고른 음원을 쓰고 싶다면 audio 폴더에 mp3를 넣고
     아래 BGM_FILE 에 경로를 적어 주세요. (예: "audio/bgm.mp3")
   ========================================================= */

const BGM_FILE = null;      // null 이면 직접 만든 펑크록 루프를 재생
const BGM_VOLUME = 0.32;
const SFX_VOLUME = 0.7;

const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, noiseBuf, distCurve;
  let muted = false;
  let bgmOn = false, bgmEl = null;
  let schedTimer = null, nextNoteTime = 0, step = 0;
  let intensity = 0; // 0 = 평소, 1 = 게임 중 (하이햇이 촘촘해짐)

  /* ---------- 초기화 (첫 클릭 때) ---------- */
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
    master.connect(comp).connect(ctx.destination);

    musicBus = ctx.createGain(); musicBus.gain.value = BGM_VOLUME; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_VOLUME; sfxBus.connect(master);

    // 화이트 노이즈 (드럼·환호 소리용)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // 기타 디스토션 곡선
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      distCurve[i] = Math.tanh(x * 6);
    }
  }

  /* ---------- 기본 재료 ---------- */
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone({ type = "sine", f0, f1, t = ctx.currentTime, dur = 0.2, vol = 0.3, a = 0.005, bus = sfxBus }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a, vol, dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise({ t = ctx.currentTime, dur = 0.1, vol = 0.3, type = "highpass", freq = 6000, q = 0.7, a = 0.002, bus = sfxBus }) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, vol, dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* =========================================================
     배경음악 — 150 BPM 펑크록 루프 (E5 – C5 – G5 – D5)
     ========================================================= */
  const BPM = 150;
  const STEP = 60 / BPM / 2;               // 8분음표
  const ROOTS = [40, 40, 36, 36, 43, 43, 38, 38]; // 8마디 루프: E – C – G – D (2마디씩)
  const LEAD = [ // 후렴 멜로디 (16분 → 8분 단위, null = 쉼)
    64, null, 67, null, 69, 67, 64, null,  62, null, 64, null, 67, null, null, null,
    60, null, 64, null, 67, 64, 60, null,  67, null, 71, null, 69, null, 67, null,
    64, null, 67, null, 69, 67, 64, null,  62, null, 64, null, 67, null, null, null,
    62, null, 66, null, 69, null, 74, 72,  71, null, 69, null, 66, null, null, null,
  ];

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(g, t, 0.002, 0.9, 0.22);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.3);
  }
  function snare(t) {
    noise({ t, dur: 0.18, vol: 0.45, type: "bandpass", freq: 1800, q: 0.6, bus: musicBus });
    tone({ type: "triangle", f0: 220, f1: 160, t, dur: 0.1, vol: 0.25, bus: musicBus });
  }
  function hat(t, open) {
    noise({ t, dur: open ? 0.16 : 0.04, vol: open ? 0.16 : 0.1, freq: 8000, bus: musicBus });
  }
  function power(t, root, dur, muteIt) {
    // 루트 + 5도 + 옥타브 → 디스토션 → 로우패스
    const shaper = ctx.createWaveShaper(); shaper.curve = distCurve;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = muteIt ? 1200 : 2600;
    const g = ctx.createGain(); env(g, t, 0.004, muteIt ? 0.09 : 0.12, dur);
    const pre = ctx.createGain(); pre.gain.value = 0.5;
    pre.connect(shaper).connect(lp).connect(g).connect(musicBus);
    [0, 7, 12].forEach((iv, k) => {
      const o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.value = midi(root + 12 + iv); o.detune.value = (k - 1) * 6;
      o.connect(pre); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function bass(t, root, dur) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = midi(root);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
    const g = ctx.createGain(); env(g, t, 0.005, 0.32, dur);
    o.connect(lp).connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function lead(t, note, dur) {
    const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = midi(note + 12);
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = 5.5; vg.gain.value = 6; vib.connect(vg).connect(o.detune);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;
    const g = ctx.createGain(); env(g, t, 0.01, 0.06, dur);
    o.connect(lp).connect(g).connect(musicBus);
    o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  // 효과음용 파워코드 (배경음악보다 크게)
  function powerSfx(t, root, dur) {
    const shaper = ctx.createWaveShaper(); shaper.curve = distCurve;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200;
    const g = ctx.createGain(); env(g, t, 0.004, 0.22, dur);
    const pre = ctx.createGain(); pre.gain.value = 0.6;
    pre.connect(shaper).connect(lp).connect(g).connect(sfxBus);
    [0, 7, 12].forEach((iv, k) => {
      const o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.value = midi(root + 12 + iv); o.detune.value = (k - 1) * 8;
      o.connect(pre); o.start(t); o.stop(t + dur + 0.05);
    });
  }

  function scheduleStep(s, t) {
    const bar = Math.floor(s / 8) % ROOTS.length;     // 1마디 = 8분음표 8개
    const pos = s % 8;
    const root = ROOTS[bar];
    const loop = Math.floor(s / 64) % 2;               // 8마디마다 A/B 파트

    // 드럼
    if (pos === 0 || pos === 3 || pos === 4 && loop === 1 || pos === 5) kick(t);
    if (pos === 2 || pos === 6) snare(t);
    hat(t, pos === 7);
    if (intensity > 0) hat(t + STEP / 2, false);
    if (s % 64 === 0) noise({ t, dur: 1.2, vol: 0.18, freq: 5000, bus: musicBus }); // 크래시

    // 베이스 + 기타
    bass(t, root, STEP * 0.9);
    power(t, root, STEP * (pos === 0 ? 1.8 : 0.85), pos !== 0);

    // B 파트에서 리드 멜로디
    if (loop === 1) {
      const n = LEAD[s % 64];
      if (n) lead(t, n, STEP * 0.95);
    }
  }

  function scheduler() {
    while (nextNoteTime < ctx.currentTime + 0.15) {
      scheduleStep(step, nextNoteTime);
      nextNoteTime += STEP;
      step++;
    }
  }

  function startBgm() {
    init();
    if (!ctx || bgmOn) return;
    bgmOn = true;
    if (BGM_FILE) {
      if (!bgmEl) {
        bgmEl = new Audio(BGM_FILE);
        bgmEl.loop = true;
        ctx.createMediaElementSource(bgmEl).connect(musicBus);
      }
      bgmEl.play().catch(() => {});
      return;
    }
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(BGM_VOLUME, ctx.currentTime + 1.5);
    step = 0;
    nextNoteTime = ctx.currentTime + 0.1;
    schedTimer = setInterval(scheduler, 25);
  }

  /* =========================================================
     효과음
     ========================================================= */
  const sfx = {
    // 버튼 클릭: 짧게 튀는 소리
    click() {
      const t = ctx.currentTime;
      tone({ type: "square", f0: 520, f1: 1040, t, dur: 0.07, vol: 0.18 });
      tone({ type: "triangle", f0: 1560, t: t + 0.04, dur: 0.08, vol: 0.12 });
    },
    // 가방 고르기
    pick() {
      const t = ctx.currentTime;
      [0, 4, 7].forEach((iv, k) => tone({ type: "triangle", f0: midi(72 + iv), t: t + k * 0.05, dur: 0.15, vol: 0.18 }));
    },
    // 정답 가방
    correct() {
      const t = ctx.currentTime;
      [72, 76, 79, 84].forEach((n, k) => tone({ type: "square", f0: midi(n), t: t + k * 0.09, dur: 0.22, vol: 0.13 }));
      noise({ t: t + 0.3, dur: 0.6, vol: 0.08, freq: 7000 });
    },
    // 오답 가방
    wrong() {
      const t = ctx.currentTime;
      tone({ type: "sawtooth", f0: 330, f1: 290, t, dur: 0.22, vol: 0.12 });
      tone({ type: "sawtooth", f0: 290, f1: 200, t: t + 0.24, dur: 0.4, vol: 0.12 });
    },
    // 타이핑
    type() {
      tone({ type: "square", f0: 900 + Math.random() * 300, dur: 0.025, vol: 0.035 });
    },
    // 카운트다운 째깍
    tick(last) {
      tone({ type: "square", f0: last ? 1320 : 880, dur: last ? 0.2 : 0.06, vol: 0.12 });
    },
    // 게임 시작: 상승 아르페지오 + 크래시
    start() {
      const t = ctx.currentTime;
      [52, 59, 64, 71, 76].forEach((n, k) => tone({ type: "sawtooth", f0: midi(n), t: t + k * 0.06, dur: 0.18, vol: 0.1 }));
      noise({ t: t + 0.32, dur: 1.4, vol: 0.25, freq: 4000 });
      kick(t + 0.32);
    },
    // 아이템이 떨어지기 시작할 때: 살짝 '휙'
    drop() {
      const t = ctx.currentTime;
      tone({ type: "sine", f0: 1100 + Math.random() * 300, f1: 500, t, dur: 0.18, vol: 0.05 });
    },
    // 좋은 아이템 획득: 반짝 차임
    good() {
      const t = ctx.currentTime;
      tone({ type: "triangle", f0: midi(84), t, dur: 0.12, vol: 0.25 });
      tone({ type: "triangle", f0: midi(91), t: t + 0.08, dur: 0.25, vol: 0.22 });
      tone({ type: "sine", f0: midi(96), t: t + 0.14, dur: 0.3, vol: 0.12 });
    },
    // 나쁜 아이템: 낮게 '뿌우웅'
    bad() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(220, t);
      o.frequency.linearRampToValueAtTime(180, t + 0.15);
      o.frequency.linearRampToValueAtTime(200, t + 0.2);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.55);
      lp.type = "lowpass"; lp.frequency.value = 900;
      env(g, t, 0.01, 0.3, 0.6);
      o.connect(lp).connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.65);
      noise({ t, dur: 0.12, vol: 0.15, type: "lowpass", freq: 600 });
    },
    // 시간 종료: 호루라기
    timeup() {
      const t = ctx.currentTime;
      [0, 0.18].forEach((d) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = "sine"; o.frequency.value = 2400;
        lfo.frequency.value = 38; lg.gain.value = 120; lfo.connect(lg).connect(o.frequency);
        env(g, t + d, 0.01, 0.18, 0.16);
        o.connect(g).connect(sfxBus); o.start(t + d); lfo.start(t + d); o.stop(t + d + 0.2); lfo.stop(t + d + 0.2);
      });
    },
    // 팝업 열기
    open() {
      tone({ type: "sine", f0: 500, f1: 1200, dur: 0.12, vol: 0.15 });
    },
    // 폭죽 '펑' + 타닥타닥
    pop() {
      const t = ctx.currentTime;
      tone({ type: "sine", f0: 160, f1: 50, t, dur: 0.3, vol: 0.22 });
      noise({ t, dur: 0.25, vol: 0.18, type: "lowpass", freq: 1200 });
      for (let i = 0; i < 6; i++) noise({ t: t + 0.12 + Math.random() * 0.5, dur: 0.03, vol: 0.07, freq: 5000 });
    },
    // 🤘 락피스: 디스토션 기타 리프 + 심벌 + 관객 함성
    rock() {
      const t = ctx.currentTime;
      const riff = [[40, 0, 0.12], [40, 0.13, 0.12], [43, 0.26, 0.12], [45, 0.39, 0.5]];
      riff.forEach(([n, d, len]) => powerSfx(t + d, n, len));
      kick(t); kick(t + 0.39);
      noise({ t: t + 0.39, dur: 1.4, vol: 0.3, freq: 4000 });
      noise({ t: t + 0.2, dur: 1.6, vol: 0.16, type: "bandpass", freq: 1400, q: 0.4, a: 0.3 });
    },
    // ✌️ 브이: 카메라 셔터 '찰칵' + 반짝
    peace() {
      const t = ctx.currentTime;
      noise({ t, dur: 0.03, vol: 0.5, type: "bandpass", freq: 3000, q: 1 });
      noise({ t: t + 0.07, dur: 0.06, vol: 0.4, type: "bandpass", freq: 1800, q: 1 });
      tone({ type: "square", f0: 2000, t, dur: 0.02, vol: 0.12 });
      [88, 91, 96].forEach((n, k) => tone({ type: "triangle", f0: midi(n), t: t + 0.18 + k * 0.07, dur: 0.25, vol: 0.14 }));
    },
    // 🫶 하트: 몽글몽글 '뾰로롱'
    heart() {
      const t = ctx.currentTime;
      [72, 76, 79, 84, 88].forEach((n, k) => {
        tone({ type: "sine", f0: midi(n), t: t + k * 0.08, dur: 0.5, vol: 0.18, a: 0.02 });
        tone({ type: "sine", f0: midi(n + 12), t: t + k * 0.08, dur: 0.3, vol: 0.05, a: 0.02 });
      });
      tone({ type: "sine", f0: 600, f1: 1400, t: t + 0.45, dur: 0.35, vol: 0.12 });
    },
    // 마지막 페이지: 팡파르 + 관객 환호
    cheer() {
      const t = ctx.currentTime;
      [[64, 0], [67, 0.12], [72, 0.24], [76, 0.36], [72, 0.5], [76, 0.62]].forEach(([n, d]) =>
        tone({ type: "square", f0: midi(n), t: t + d, dur: d > 0.5 ? 0.6 : 0.14, vol: 0.12 }));
      noise({ t, dur: 3.2, vol: 0.2, type: "bandpass", freq: 1500, q: 0.4, a: 0.6 });
      noise({ t: t + 0.1, dur: 2.8, vol: 0.12, type: "bandpass", freq: 3200, q: 0.5, a: 0.5 });
    },
  };

  function play(name, ...args) {
    if (!ctx || muted || !sfx[name]) return;
    try { sfx[name](...args); } catch (e) { /* 무시 */ }
  }

  function setIntensity(v) { intensity = v; }

  function toggleMute() {
    muted = !muted;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    return muted;
  }

  return { init, startBgm, play, setIntensity, toggleMute, get muted() { return muted; } };
})();

/* ---------- 소리 켜기/끄기 버튼 ---------- */
(() => {
  const btn = document.getElementById("sound-btn");
  if (!btn) return;
  const render = () => {
    btn.textContent = Sound.muted ? "🔇" : "🔊";
    btn.setAttribute("aria-label", Sound.muted ? "소리 켜기" : "소리 끄기");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    Sound.startBgm();
    Sound.toggleMute();
    render();
  });
  render();
})();

// 브라우저 정책상 소리는 사용자가 한 번 클릭한 뒤에만 재생할 수 있어요.
// 첫 클릭(또는 키 입력) 때 배경음악을 시작합니다.
["pointerdown", "keydown"].forEach((ev) =>
  window.addEventListener(ev, () => Sound.startBgm(), { once: true })
);
