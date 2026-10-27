/* =========================================================
   떨어지는 아이템 목록
   - good: true  → 챙겨야 하는 것 (img/items/p)
   - good: false → 챙기면 안 되는 것 (img/items/n)
   - name: 화면에 보이는 이름 / desc: 10페이지 팝업 설명
   ========================================================= */
const ITEMS = [
  // ---------- 챙겨야 하는 것 ----------
  { file: "good01", /* 그라운드체어 */ name: "그라운드 체어", good: true,  desc: "스탠딩 사이사이 지친 다리를 쉬게 해 주는 접이식 의자!" },
  { file: "good02", /* 대형비닐봉투 */ name: "대형 비닐봉투", good: true,  desc: "비 오면 짐을 싸고, 쓰레기도 담고, 깔고 앉을 수도 있어!" },
  { file: "good03", /* 돗자리 */       name: "돗자리",       good: true,  desc: "잔디밭에 자리 잡고 쉴 때 꼭 필요해!" },
  { file: "good04", /* 모자 */         name: "모자",         good: true,  desc: "한여름 뙤약볕에서 머리랑 얼굴을 지켜 줘!" },
  { file: "good05", /* 물티슈 */       name: "물티슈",       good: true,  desc: "손 닦고, 땀 닦고, 쏟은 음료까지 닦는 만능템!" },
  { file: "good06", /* 벌레퇴치제 */   name: "벌레 퇴치제",  good: true,  desc: "야외 잔디밭엔 모기가 정말 많거든!" },
  { file: "good07", /* 보냉팩 */       name: "보냉팩",       good: true,  desc: "물이랑 간식을 오래오래 시원하게 지켜 줘!" },
  { file: "good08", /* 보조가방 */     name: "보조 가방",    good: true,  desc: "큰 가방은 맡기고 필수품만 쏙 넣어 다니기 좋아!" },
  { file: "good09", /* 보조배터리 */   name: "보조배터리",   good: true,  desc: "사진 찍고 친구 찾다 보면 배터리가 순식간에 닳아!" },
  { file: "good10", /* 비타민 */       name: "뽀로로 비타민", good: true, desc: "페스티벌에서 뛰어놀려면 비타민은 필수야!!" },
  { file: "good11", /* 선글라스 */     name: "선글라스",     good: true,  desc: "눈부신 햇빛 아래서도 무대를 똑바로 볼 수 있어!" },
  { file: "good12", /* 선스틱 */       name: "선스틱",       good: true,  desc: "손에 안 묻히고 수시로 덧바르기 편한 자외선 차단제!" },
  { file: "good13", /* 손수건 */       name: "손수건",       good: true,  desc: "땀 닦고, 목에 두르고, 햇빛 가리개로도 쓸 수 있어!" },
  { file: "good14", /* 손풍기 */       name: "손풍기",       good: true,  desc: "사람 가득한 스탠딩 구역에서 더위를 식혀 줘!" },
  { file: "good15", /* 스포츠샌들 */   name: "스포츠 샌들",  good: true,  desc: "오래 서 있어도 편하고, 비에 젖어도 금방 말라!" },
  { file: "good16", /* 슬로건 */       name: "슬로건",       good: true,  desc: "좋아하는 밴드를 응원하는 락페의 낭만!" },
  { file: "good17", /* 양산 */         name: "양산",         good: true,  desc: "그늘 하나 없는 낮 시간, 햇빛을 막아 줘!" },
  { file: "good18", /* 얼음물 */       name: "얼음물",       good: true,  desc: "더위 먹지 않으려면 시원한 물은 필수야!" },
  { file: "good19", /* 여벌양말 */     name: "여벌 양말",    good: true,  desc: "비나 땀에 젖은 양말만 갈아 신어도 발이 살아나!" },
  { file: "good20", /* 여벌옷 */       name: "여벌 옷",      good: true,  desc: "땀이나 비에 흠뻑 젖었을 때 갈아입을 옷!" },
  { file: "good21", /* 우비 */         name: "우비",         good: true,  desc: "갑자기 비가 와도 우비만 있으면 계속 놀 수 있어!" },
  { file: "good22", /* 운동화 */       name: "운동화",       good: true,  desc: "하루 종일 뛰고 걸어도 발이 편해!" },
  { file: "good23", /* 쿨링티슈 */     name: "쿨링 티슈",    good: true,  desc: "한 장이면 몸이 시원~해지는 여름 필수템!" },
  { file: "good24", /* 쿨시트 */       name: "쿨시트",       good: true,  desc: "목이나 이마에 붙이면 열을 쏙 식혀 줘!" },
  { file: "good25", /* 티슈 */         name: "티슈",         good: true,  desc: "화장실에 휴지가 없을 때를 대비하자!" },
  { file: "good26", /* 팔토시 */       name: "팔토시",       good: true,  desc: "팔이 타는 걸 막아 주고 시원하기까지 해!" },

  // ---------- 챙기면 안 되는 것 ----------
  { file: "bad01", /* 가스렌턴 */     name: "가스 랜턴",    good: false, desc: "가스·화기류는 안전 때문에 반입 금지야!" },
  { file: "bad02", /* 개토레이캔 */   name: "게토레이 캔",  good: false, desc: "캔 음료는 반입이 안 돼! 페트병에 담아 오자." },
  { file: "bad03", /* 구두 */         name: "구두",         good: false, desc: "하루 종일 서 있기엔 발이 너무 아파…" },
  { file: "bad04", /* 병음료 */       name: "병 음료",      good: false, desc: "유리병은 깨지면 위험해서 반입 금지야!" },
  { file: "bad05", /* 새로 */         name: "새로",         good: false, desc: "외부 주류는 반입 금지! 소주는 두고 가자." },
  { file: "bad06", /* 새로다래 */     name: "새로 다래",    good: false, desc: "과일맛이어도 술은 술! 반입 금지야." },
  { file: "bad07", /* 새로오미자 */   name: "새로 오미자",  good: false, desc: "외부 주류는 입구에서 다 걸려!" },
  { file: "bad08", /* 생솔캔 */       name: "생솔 캔",      good: false, desc: "캔은 반입 금지! 마시고 싶으면 페트병으로." },
  { file: "bad09", /* 솔의눈캔 */     name: "솔의눈 캔",    good: false, desc: "캔 음료는 입구에서 버려야 해…" },
  { file: "bad10", /* 슬리퍼 */       name: "슬리퍼",       good: false, desc: "사람 많은 곳에선 밟히고 벗겨지기 쉬워!" },
  { file: "bad11", /* 아사히 */       name: "아사히",       good: false, desc: "외부 주류와 유리병은 반입 금지야!" },
  { file: "bad12", /* 이프로캔 */     name: "2% 캔",        good: false, desc: "캔은 반입 금지! 아쉽지만 두고 가자." },
  { file: "bad13", /* 참이슬 */       name: "참이슬",       good: false, desc: "소주병은 술이면서 유리병이라 이중으로 안 돼!" },
  { file: "bad14", /* 처음처럼 */     name: "처음처럼",     good: false, desc: "외부 주류는 반입 금지! 처음부터 챙기지 말자." },
  { file: "bad15", /* 카스 */         name: "카스",         good: false, desc: "맥주병은 깨지면 위험해서 반입 금지야!" },
  { file: "bad16", /* 카스캔 */       name: "카스 캔",      good: false, desc: "캔맥주도 외부 주류라 반입 금지!" },
  { file: "bad17", /* 테라 */         name: "테라",         good: false, desc: "유리병 맥주는 입구에서 바로 걸려!" },
  { file: "bad18", /* 테라캔 */       name: "테라 캔",      good: false, desc: "캔도 술도 반입 금지야!" },
  { file: "bad19", /* 토레타캔 */     name: "토레타 캔",    good: false, desc: "음료는 좋지만 캔은 안 돼! 페트병으로 챙기자." },
  { file: "bad20", /* 파워에이드캔 */ name: "파워에이드 캔", good: false, desc: "캔 음료는 반입 금지야!" },
  { file: "bad21", /* 패딩 */         name: "패딩",         good: false, desc: "한여름 락페에 패딩이라니… 더워서 쓰러질 거야!" },
  { file: "bad22", /* 포카리뚱캔 */   name: "포카리 뚱캔",  good: false, desc: "크기가 커도 캔은 캔! 반입 금지야." },
  { file: "bad23", /* 포카리캔 */     name: "포카리 캔",    good: false, desc: "이온음료는 페트병으로 챙겨야 해!" },
  { file: "bad24", /* 폭죽 */         name: "폭죽",         good: false, desc: "화약류는 위험해서 절대 반입 금지!" },
  { file: "bad25", /* 하이네켄 */     name: "하이네켄",     good: false, desc: "외부 주류와 유리병은 반입 금지야!" },
  { file: "bad26", /* 핫팩 */         name: "핫팩",         good: false, desc: "한여름에 핫팩이라니… 더위만 더할 뿐이야!" },
];
ITEMS.forEach((it, i) => {
  it.id = i;
  it.src = `img/items/${it.good ? "p" : "n"}/${it.file}.webp`;
});
