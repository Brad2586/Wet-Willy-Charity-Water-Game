/**
 * Wett Willy
 * Keyboard-only prototype. Walk up to a well to fill the jerry can,
 * then walk up to a community to deliver it.
 * Falling into unsafe water spills the can and costs points.
 * Easy, Normal, and Hard change the clock, pace, penalties, and score goal.
 */

const WORLD_W = 960;
const WORLD_H = 540;
const PLAYER_W = 48;
const PLAYER_H = 70;
const GRAVITY = 0.45;
const JUMP_V = -11.6;
const NEAR = 118;

const DIFFICULTIES = [
  {
    id: "easy",
    label: "Easy",
    speed: 2.2,
    penalty: 10,
    collect: 25,
    deliver: 100,
    seconds: 150,
    scoreGoal: false,
    summary: "Small penalties (−10) and 2 minutes 30 seconds on the longest route.",
  },
  {
    id: "normal",
    label: "Normal",
    speed: 2.2,
    penalty: 25,
    collect: 25,
    deliver: 100,
    seconds: 90,
    scoreGoal: false,
    summary: "A 25-point penalty and 90 seconds on the longest route.",
  },
  {
    id: "hard",
    label: "Hard",
    speed: 2.8,
    penalty: 40,
    collect: 20,
    deliver: 80,
    seconds: 50,
    scoreGoal: true,
    summary: "Faster Willy, −40 penalties, 50 seconds, and a higher score to win.",
  },
];

const LEVEL_TIME = [0.65, 0.8, 1];

const LEVELS = [
  {
    name: "The Village",
    summary: "Walk to the well, then jump up to the clinic.",
    start: { x: 36, y: 468 - PLAYER_H },
    platforms: [
      { x: 0, y: 468, w: 960, h: 72, kind: "grass" },
      { x: 520, y: 348, w: 240, h: 18, kind: "sand" },
    ],
    wells: [
      { id: "well-1", name: "Village well", x: 280, ground: 468 },
    ],
    communities: [
      { id: "clinic", name: "The clinic", x: 640, ground: 348 },
    ],
    hazards: [],
  },
  {
    name: "The Gap",
    summary: "Fill the can, then jump the unsafe water to reach the family.",
    start: { x: 36, y: 468 - PLAYER_H },
    platforms: [
      { x: 0, y: 468, w: 300, h: 72, kind: "grass" },
      { x: 370, y: 468, w: 590, h: 72, kind: "grass" },
    ],
    wells: [
      { id: "well-1", name: "Village well", x: 180, ground: 468 },
    ],
    communities: [
      { id: "family", name: "Amina's family", x: 720, ground: 468 },
    ],
    hazards: [
      { id: "pit-1", x: 300, y: 468, w: 70, h: 72 },
    ],
  },
  {
    name: "Every Community",
    summary: "Carry water to the clinic, the school, and Amina's family.",
    start: { x: 28, y: 468 - PLAYER_H },
    platforms: [
      { x: 0, y: 468, w: 250, h: 72, kind: "grass" },
      { x: 325, y: 468, w: 315, h: 72, kind: "grass" },
      { x: 720, y: 468, w: 240, h: 72, kind: "grass" },
      { x: 40, y: 348, w: 160, h: 18, kind: "sand" },
      { x: 430, y: 348, w: 200, h: 18, kind: "sand" },
      { x: 500, y: 212, w: 360, h: 18, kind: "stone" },
    ],
    wells: [
      { id: "well-1", name: "Village well", x: 168, ground: 468 },
      { id: "well-2", name: "Hillside well", x: 575, ground: 348 },
    ],
    communities: [
      { id: "clinic", name: "The clinic", x: 118, ground: 348 },
      { id: "school", name: "The school", x: 690, ground: 212 },
      { id: "family", name: "Amina's family", x: 870, ground: 468 },
    ],
    hazards: [
      { id: "pit-1", x: 250, y: 468, w: 75, h: 72 },
      { id: "pit-2", x: 640, y: 468, w: 80, h: 72 },
    ],
  },
];

const stage = document.getElementById("stage");
const world = document.getElementById("world");
const playerEl = document.getElementById("player");
const scoreEl = document.getElementById("score");
const canStatus = document.getElementById("can-status");
const progressEl = document.getElementById("progress");
const toastEl = document.getElementById("toast");
const floatLayer = document.getElementById("floaters");
const flashEl = document.getElementById("flash");
const confetti = document.getElementById("confetti");
const winBanner = document.getElementById("win");
const failBanner = document.getElementById("fail");
const failTitle = document.getElementById("fail-title");
const failNote = document.getElementById("fail-note");
const timeEl = document.getElementById("time-left");
const modeEl = document.getElementById("mode-label");
const difficultyScreen = document.getElementById("screen-difficulty");
const difficultyMenu = document.getElementById("difficulty-menu");
const hud = document.getElementById("hud");
const missionEl = document.getElementById("mission");
const titleScreen = document.getElementById("screen-title");
const selectScreen = document.getElementById("screen-select");
const creditsScreen = document.getElementById("screen-credits");
const titleItems = [...document.querySelectorAll("#title-menu .menu-item")];
const levelMenu = document.getElementById("level-menu");

const keys = { left: false, right: false, jumpPressed: false };
const view = { scale: 1, follow: false };
const menu = { screen: "title", titleIndex: 0, levelIndex: 0, difficultyIndex: 1 };

const player = {
  x: 36,
  y: 468 - PLAYER_H,
  vx: 0,
  vy: 0,
  onGround: true,
  facing: 1,
};

const checkpoint = { x: player.x, y: player.y };
const state = {
  score: 0,
  carrying: false,
  served: {},
  won: false,
  failed: false,
  hazardLock: 0,
  timeLeft: 0,
  timerStamp: 0,
};

let currentLevel = null;
let wellEls = [];
let communityEls = [];
function mode() {
  return DIFFICULTIES[menu.difficultyIndex];
}

function levelSeconds() {
  const scale = LEVEL_TIME[menu.levelIndex] ?? 1;
  return Math.round(mode().seconds * scale);
}

function scoreGoal() {
  if (!mode().scoreGoal || !currentLevel) return 0;
  return currentLevel.communities.length * mode().deliver;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildDifficultyMenu() {
  difficultyMenu.replaceChildren();
  DIFFICULTIES.forEach((option, index) => {
    const item = document.createElement("li");
    item.className = "menu-item";
    item.dataset.difficulty = String(index);
    const title = document.createElement("strong");
    title.textContent = option.label;
    const detail = document.createElement("span");
    detail.textContent = option.summary;
    item.append(title, detail);
    difficultyMenu.appendChild(item);
  });
}

function refreshDifficultyLabel() {
  const item = titleItems.find((entry) => entry.dataset.menu === "difficulty");
  if (item) item.textContent = `Difficulty: ${mode().label}`;
}

function buildLevelMenu() {
  levelMenu.replaceChildren();
  LEVELS.forEach((level, index) => {
    const item = document.createElement("li");
    item.className = "menu-item";
    item.dataset.level = String(index);
    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${level.name}`;
    const detail = document.createElement("span");
    detail.textContent = level.summary;
    item.append(title, detail);
    levelMenu.appendChild(item);
  });
}

function clearLayer(id) {
  document.getElementById(id).replaceChildren();
}

function buildLevel() {
  clearLayer("platforms");
  clearLayer("hazards");
  clearLayer("actors");
  floatLayer.replaceChildren();

  const platformLayer = document.getElementById("platforms");
  for (const platform of currentLevel.platforms) {
    const el = document.createElement("div");
    el.className = `platform ${platform.kind}`;
    el.style.left = `${platform.x}px`;
    el.style.top = `${platform.y}px`;
    el.style.width = `${platform.w}px`;
    el.style.height = `${platform.h}px`;
    const cap = document.createElement("span");
    cap.className = "cap";
    el.appendChild(cap);
    platformLayer.appendChild(el);
  }

  const hazardLayer = document.getElementById("hazards");
  for (const hazard of currentLevel.hazards) {
    const el = document.createElement("div");
    el.className = "hazard";
    el.textContent = "Unsafe";
    el.style.left = `${hazard.x}px`;
    el.style.top = `${hazard.y}px`;
    el.style.width = `${hazard.w}px`;
    el.style.height = `${hazard.h}px`;
    hazardLayer.appendChild(el);
  }

  const actors = document.getElementById("actors");
  wellEls = currentLevel.wells.map((well) => {
    const el = document.createElement("div");
    el.className = "well";
    el.dataset.id = well.id;
    el.dataset.name = well.name;
    const label = document.createElement("span");
    label.className = "actor-label";
    label.textContent = well.name;
    const art = document.createElement("span");
    art.className = "well-art";
    art.innerHTML = '<span class="well-ring"></span><span class="jerrycan"></span>';
    el.append(label, art);
    actors.appendChild(el);
    placeStanding(el, well.x, well.ground);
    return el;
  });

  const shirts = ["shirt-blue", "shirt-orange", "shirt-aqua"];
  const tones = ["tone-a", "tone-b", "tone-c"];
  communityEls = currentLevel.communities.map((place) => {
    const el = document.createElement("div");
    el.className = "community";
    el.dataset.id = place.id;
    el.dataset.name = place.name;
    const label = document.createElement("span");
    label.className = "actor-label";
    label.textContent = place.name;
    const group = document.createElement("span");
    group.className = "group";
    for (let i = 0; i < 3; i += 1) {
      const person = document.createElement("span");
      person.className = `person ${tones[i % 3]} ${shirts[i % 3]}`;
      group.appendChild(person);
    }
    el.append(label, group);
    actors.appendChild(el);
    placeStanding(el, place.x, place.ground);
    return el;
  });
}

function placeStanding(el, centerX, groundY) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  el.style.left = `${centerX - width / 2}px`;
  el.style.top = `${groundY - height}px`;
  el.dataset.x = String(centerX);
  el.dataset.y = String(groundY - height / 2);
}

function freshServed() {
  const served = {};
  for (const place of currentLevel.communities) served[place.id] = false;
  return served;
}

function renderHud(flash) {
  scoreEl.textContent = String(state.score);
  canStatus.textContent = state.carrying ? "Full" : "Empty";
  canStatus.classList.toggle("is-full", state.carrying);
  canStatus.classList.toggle("is-empty", !state.carrying);
  const done = Object.values(state.served).filter(Boolean).length;
  const total = currentLevel ? currentLevel.communities.length : 0;
  progressEl.textContent = `${done} / ${total}`;
  timeEl.textContent = String(Math.ceil(state.timeLeft));
  timeEl.classList.toggle("is-empty", state.timeLeft <= 10);
  modeEl.textContent = mode().label;
  if (flash) {
    scoreEl.classList.remove("pop-up", "pop-down");
    void scoreEl.offsetWidth;
    scoreEl.classList.add(flash === "up" ? "pop-up" : "pop-down");
  }
}

function toast(message) {
  toastEl.textContent = message;
}

function floater(x, y, text, kind) {
  const el = document.createElement("span");
  el.className = `floater ${kind}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  floatLayer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function near(el) {
  const dx = player.x + PLAYER_W / 2 - Number(el.dataset.x);
  const dy = player.y + PLAYER_H / 2 - Number(el.dataset.y);
  return dx * dx + dy * dy <= NEAR * NEAR;
}

function wellHasCan(well) {
  return Boolean(well.querySelector(".jerrycan"));
}

function takeCan(well) {
  const can = well.querySelector(".jerrycan");
  if (can) can.remove();
  well.classList.add("drawn");
}

function restoreCans() {
  for (const well of wellEls) {
    well.classList.remove("drawn");
    if (well.querySelector(".jerrycan")) continue;
    const art = well.querySelector(".well-art");
    const can = document.createElement("span");
    can.className = "jerrycan";
    art.appendChild(can);
  }
}

function updateRange() {
  for (const well of wellEls) {
    well.classList.toggle("in-range", !state.won && !state.failed && !state.carrying && wellHasCan(well) && near(well));
  }
  for (const place of communityEls) {
    const open = !state.served[place.dataset.id];
    place.classList.toggle("in-range", !state.won && state.carrying && open && near(place));
  }
}

function tryCollect(well) {
  if (state.won || state.failed || state.carrying || !wellHasCan(well) || !near(well)) return;
  state.carrying = true;
  state.score += mode().collect;
  takeCan(well);
  renderHud("up");
  floater(Number(well.dataset.x), Number(well.dataset.y), `+${mode().collect}`, "good");
  toast("Jerry can filled. The can left the well. Walk it to the people.");
}

function tryDeliver(place) {
  if (state.won || state.failed || !state.carrying || !near(place)) return;
  const id = place.dataset.id;
  if (state.served[id]) return;
  state.carrying = false;
  state.served[id] = true;
  place.classList.add("served");
  place.querySelector(".actor-label").textContent = `${place.dataset.name} ✓`;
  const gift = document.createElement("span");
  gift.className = "given-can";
  gift.setAttribute("aria-hidden", "true");
  place.querySelector(".actor-label").after(gift);
  restoreCans();
  state.score += mode().deliver;
  renderHud("up");
  floater(Number(place.dataset.x), Number(place.dataset.y), `+${mode().deliver}`, "good");
  const done = Object.values(state.served).every(Boolean);
  if (!done) {
    toast("Clean water delivered. A can is beside them now.");
    return;
  }
  const goal = scoreGoal();
  if (goal && state.score < goal) {
    failLevel(`Hard needs ${goal} points. You finished with ${state.score}.`);
    return;
  }
  toast("Every community on this level has clean water.");
  winGame();
}

function handleProximity() {
  if (state.won) return;
  if (state.carrying) {
    const place = communityEls.find((el) => !state.served[el.dataset.id] && near(el));
    if (place) tryDeliver(place);
    return;
  }
  const well = wellEls.find((el) => wellHasCan(el) && near(el));
  if (well) tryCollect(well);
}

function hitHazard() {
  if (state.won || state.failed) return;
  const now = performance.now();
  if (now < state.hazardLock) return;
  state.hazardLock = now + 900;
  const spilled = state.carrying;
  state.carrying = false;
  if (spilled) restoreCans();
  state.score = Math.max(0, state.score - mode().penalty);
  renderHud("down");
  floater(player.x + PLAYER_W / 2, player.y, `-${mode().penalty}`, "bad");
  flashEl.classList.remove("on");
  void flashEl.offsetWidth;
  flashEl.classList.add("on");
  playerEl.classList.add("hurt");
  window.setTimeout(() => playerEl.classList.remove("hurt"), 350);
  toast(spilled
    ? `Unsafe water spilled the jerry can. -${mode().penalty} points.`
    : `Unsafe water. -${mode().penalty} points.`);
  respawn();
}

function respawn() {
  player.x = checkpoint.x;
  player.y = checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
}

function saveCheckpoint(platform) {
  const minX = platform.x + 6;
  const maxX = Math.max(minX, platform.x + platform.w - PLAYER_W - 6);
  checkpoint.x = clamp(player.x, minX, maxX);
  checkpoint.y = platform.y - PLAYER_H;
}

function failLevel(message) {
  if (state.won || state.failed) return;
  state.failed = true;
  keys.left = false;
  keys.right = false;
  keys.jumpPressed = false;
  failTitle.textContent = state.timeLeft <= 0 ? "Time's up." : "Score too low.";
  failNote.textContent = message;
  failBanner.hidden = false;
  failBanner.setAttribute("aria-hidden", "false");
  toast(message);
}

function tickTimer() {
  const now = performance.now();
  if (!state.timerStamp) state.timerStamp = now;
  state.timeLeft = Math.max(0, state.timeLeft - (now - state.timerStamp) / 1000);
  state.timerStamp = now;
  timeEl.textContent = String(Math.ceil(state.timeLeft));
  timeEl.classList.toggle("is-empty", state.timeLeft <= 10);
  if (state.timeLeft <= 0) failLevel("The clock ran out before every delivery.");
}

function winGame() {
  if (state.won || state.failed) return;
  state.won = true;
  keys.left = false;
  keys.right = false;
  keys.jumpPressed = false;
  spawnConfetti();
  winBanner.hidden = false;
  winBanner.setAttribute("aria-hidden", "false");
}

function spawnConfetti() {
  confetti.replaceChildren();
  const colors = ["#FFC907", "#2E9DF7", "#4FCB53", "#FF902A", "#8BD1CB", "#F16061"];
  for (let i = 0; i < 80; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.animationDuration = `${1.5 + Math.random() * 1.4}s`;
    piece.style.setProperty("--drift", `${Math.random() * 140 - 70}px`);
    piece.style.setProperty("--spin", `${180 + Math.random() * 360}deg`);
    if (i % 3 === 0) piece.style.borderRadius = "50%";
    confetti.appendChild(piece);
  }
}

function resetGame() {
  if (!currentLevel) return;
  state.score = 0;
  state.carrying = false;
  state.won = false;
  state.failed = false;
  state.served = freshServed();
  state.hazardLock = 0;
  state.timeLeft = levelSeconds();
  state.timerStamp = performance.now();
  player.x = currentLevel.start.x;
  player.y = currentLevel.start.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.facing = 1;
  checkpoint.x = player.x;
  checkpoint.y = player.y;
  keys.left = false;
  keys.right = false;
  keys.jumpPressed = false;
  restoreCans();
  for (const well of wellEls) well.classList.remove("in-range");
  for (const place of communityEls) {
    place.classList.remove("served", "in-range");
    place.querySelector(".actor-label").textContent = place.dataset.name;
    place.querySelectorAll(".given-can").forEach((can) => can.remove());
  }
  floatLayer.replaceChildren();
  confetti.replaceChildren();
  winBanner.hidden = true;
  winBanner.setAttribute("aria-hidden", "true");
  failBanner.hidden = true;
  failBanner.setAttribute("aria-hidden", "true");
  playerEl.classList.remove("hurt");
  renderHud();
  toast(`${currentLevel.name}. ${currentLevel.summary}`);
}

function startLevel(index) {
  menu.levelIndex = index;
  currentLevel = LEVELS[index];
  buildLevel();
  setScreen("play");
  resetGame();
  const goal = scoreGoal();
  missionEl.textContent = goal
    ? `${currentLevel.summary} ${mode().label}: finish in time with at least ${goal} points.`
    : `${currentLevel.summary} ${mode().label}: ${levelSeconds()} seconds.`;
}

function updateMenuHighlight() {
  titleItems.forEach((item, index) => {
    item.classList.toggle("is-selected", index === menu.titleIndex);
  });
  [...levelMenu.children].forEach((item, index) => {
    item.classList.toggle("is-selected", index === menu.levelIndex);
  });
  [...difficultyMenu.children].forEach((item, index) => {
    item.classList.toggle("is-selected", index === menu.difficultyIndex);
  });
  refreshDifficultyLabel();
}

function setScreen(name) {
  menu.screen = name;
  titleScreen.hidden = name !== "title";
  selectScreen.hidden = name !== "select";
  difficultyScreen.hidden = name !== "difficulty";
  creditsScreen.hidden = name !== "credits";
  hud.hidden = name !== "play";
  if (name !== "play") {
    winBanner.hidden = true;
    winBanner.setAttribute("aria-hidden", "true");
    failBanner.hidden = true;
    failBanner.setAttribute("aria-hidden", "true");
    keys.left = false;
    keys.right = false;
    keys.jumpPressed = false;
  }
  updateMenuHighlight();
  if (name === "title") {
    missionEl.textContent = "Use the arrow keys and Enter. No mouse needed.";
    toast("Arrow keys to choose. Enter to start.");
  } else if (name === "select") {
    missionEl.textContent = "Pick a level with the arrow keys, then press Enter.";
    toast("Enter to play. Esc to go back.");
  } else if (name === "difficulty") {
    missionEl.textContent = `${mode().label}: ${mode().summary}`;
    toast("Arrow keys to choose. Enter or Esc to go back.");
  } else if (name === "credits") {
    missionEl.textContent = "Created by Bradley Leon.";
    toast("Enter or Esc to go back.");
  }
}

function chooseTitleItem() {
  const choice = titleItems[menu.titleIndex].dataset.menu;
  if (choice === "play") startLevel(0);
  else if (choice === "select") setScreen("select");
  else if (choice === "difficulty") setScreen("difficulty");
  else setScreen("credits");
}

function handleMenuKey(event) {
  if (event.repeat) return;
  if (menu.screen === "title") {
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      menu.titleIndex = (menu.titleIndex + titleItems.length - 1) % titleItems.length;
      updateMenuHighlight();
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      menu.titleIndex = (menu.titleIndex + 1) % titleItems.length;
      updateMenuHighlight();
    } else if (event.code === "Enter" || event.code === "Space") {
      chooseTitleItem();
    }
    return;
  }
  if (menu.screen === "select") {
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      menu.levelIndex = (menu.levelIndex + LEVELS.length - 1) % LEVELS.length;
      updateMenuHighlight();
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      menu.levelIndex = (menu.levelIndex + 1) % LEVELS.length;
      updateMenuHighlight();
    } else if (event.code === "Enter" || event.code === "Space") {
      startLevel(menu.levelIndex);
    } else if (event.code === "Escape") {
      setScreen("title");
    }
    return;
  }
  if (menu.screen === "difficulty") {
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      menu.difficultyIndex = (menu.difficultyIndex + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
      updateMenuHighlight();
      missionEl.textContent = `${mode().label}: ${mode().summary}`;
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      menu.difficultyIndex = (menu.difficultyIndex + 1) % DIFFICULTIES.length;
      updateMenuHighlight();
      missionEl.textContent = `${mode().label}: ${mode().summary}`;
    } else if (event.code === "Enter" || event.code === "Space" || event.code === "Escape") {
      setScreen("title");
    }
    return;
  }
  if (menu.screen === "credits") {
    if (event.code === "Enter" || event.code === "Space" || event.code === "Escape") {
      setScreen("title");
    }
  }
}

function layoutStage() {
  const viewW = stage.clientWidth;
  const fitScale = viewW / WORLD_W;
  if (fitScale >= 0.85) {
    view.scale = fitScale;
    view.follow = false;
    stage.style.height = `${WORLD_H * fitScale}px`;
  } else {
    view.scale = 1;
    view.follow = true;
    const height = Math.max(260, Math.min(340, Math.round(window.innerHeight * 0.36)));
    stage.style.height = `${height}px`;
  }
  updateCamera();
}

function updateCamera() {
  const scale = view.scale;
  const viewW = stage.clientWidth / scale;
  const viewH = stage.clientHeight / scale;
  let camX = 0;
  let camY = 0;
  if (view.follow && menu.screen === "play") {
    camX = player.x + PLAYER_W / 2 - viewW / 2;
    camY = player.y + PLAYER_H / 2 - viewH * 0.62;
    camX = clamp(camX, 0, Math.max(0, WORLD_W - viewW));
    camY = clamp(camY, 0, Math.max(0, WORLD_H - viewH));
  }
  world.style.transform = `translate(${-camX * scale}px, ${-camY * scale}px) scale(${scale})`;
}

function update() {
  if (menu.screen === "play" && currentLevel && !state.won && !state.failed) {
    tickTimer();
    if (state.failed) {
      playerEl.style.left = `${player.x}px`;
      playerEl.style.top = `${player.y}px`;
      updateCamera();
      requestAnimationFrame(update);
      return;
    }
    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    player.vx = direction * mode().speed;
    if (direction !== 0) player.facing = direction;

    if (keys.jumpPressed && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
    }
    keys.jumpPressed = false;

    player.vy = Math.min(player.vy + GRAVITY, 14);
    player.x = clamp(player.x + player.vx, 0, WORLD_W - PLAYER_W);
    player.y += player.vy;

    const feet = player.y + PLAYER_H;
    const prevFeet = feet - player.vy;
    let landed = null;
    for (const platform of currentLevel.platforms) {
      const overlap = player.x + PLAYER_W - 8 > platform.x && player.x + 8 < platform.x + platform.w;
      const crosses = player.vy >= 0 && prevFeet <= platform.y + 12 && feet >= platform.y;
      if (overlap && crosses && (!landed || platform.y < landed.y)) landed = platform;
    }

    player.onGround = false;
    if (landed) {
      player.y = landed.y - PLAYER_H;
      player.vy = 0;
      player.onGround = true;
      saveCheckpoint(landed);
    } else if (player.y > WORLD_H) {
      hitHazard();
    }

    handleProximity();
  }

  playerEl.style.left = `${player.x}px`;
  playerEl.style.top = `${player.y}px`;
  playerEl.classList.toggle("face-left", player.facing < 0);
  playerEl.classList.toggle("carrying", state.carrying);
  playerEl.classList.toggle("walking", menu.screen === "play" && !state.won && player.onGround && player.vx !== 0);
  if (menu.screen === "play") updateRange();
  updateCamera();
  requestAnimationFrame(update);
}

function bindInput() {
  document.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
      event.preventDefault();
    }

    if (menu.screen !== "play") {
      handleMenuKey(event);
      return;
    }

    if (state.won || state.failed) {
      if (event.repeat) return;
      if (event.code === "Enter") setScreen("select");
      if (event.code === "KeyR") resetGame();
      if (event.code === "Escape") setScreen("title");
      return;
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = true;
    if (event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space") {
      if (!event.repeat) keys.jumpPressed = true;
    }
    if (event.code === "KeyR" && !event.repeat) resetGame();
    if (event.code === "Escape" && !event.repeat) setScreen("title");
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
  });

  window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;
  });

  window.addEventListener("resize", layoutStage);
}

buildLevelMenu();
buildDifficultyMenu();
setScreen("title");
bindInput();
layoutStage();
requestAnimationFrame(update);
