// ---------- 저장소 ----------
const STORE_KEY = "planner-v1";
const COLORS = ["#2ed3c0", "#9bdc3c", "#f6a5a0", "#c9a8f0", "#ffd166", "#8ec5ff"];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const defaultState = () => ({
  goal: "",
  routines: [
    { id: uid(), name: "07:00 기상", time: "07:00", days: [0, 1, 2, 3, 4, 5, 6], color: COLORS[0] },
    { id: uid(), name: "영어 단어 30개", time: "08:00", days: [1, 2, 3, 4, 5], color: COLORS[1] },
    { id: uid(), name: "독서 30분", time: "22:00", days: [0, 1, 2, 3, 4, 5, 6], color: COLORS[2] },
  ],
  logs: {}, // { "YYYY-MM-DD": [routineId, ...] }
  tasks: [
    { id: uid(), title: "레포트 초안 쓰기", subject: "예시 과제", start: todayKey(), due: addDays(todayKey(), 2), color: COLORS[2], done: false },
    { id: uid(), title: "중간 발표 준비", subject: "예시 과제", start: todayKey(), due: addDays(todayKey(), 10), color: COLORS[0], done: false },
  ],
});

let state = load();
const ui = { date: todayKey() };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && Array.isArray(saved.routines)) return saved;
  } catch (e) {}
  return defaultState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

// ---------- 날짜 유틸 ----------
function uid() { return Math.random().toString(36).slice(2, 10); }
function pad(n) { return String(n).padStart(2, "0"); }
function keyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function todayKey() { return keyOf(new Date()); }
function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); }
function diffDays(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }

function dday(due) {
  const n = diffDays(todayKey(), due);
  if (n === 0) return { label: "D-day", cls: "soon" };
  if (n > 0) return { label: `D-${n}`, cls: n <= 3 ? "soon" : "" };
  return { label: `D+${-n}`, cls: "over" };
}

// ---------- 루틴 로직 ----------
const routinesOn = (key) => state.routines
  .filter((r) => r.days.includes(parseKey(key).getDay()))
  .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
const isDone = (key, id) => (state.logs[key] || []).includes(id);
function toggleRoutine(key, id) {
  const list = new Set(state.logs[key] || []);
  list.has(id) ? list.delete(id) : list.add(id);
  state.logs[key] = [...list];
  commit();
}

// ---------- 과제 로직 ----------
function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  t.done = !t.done;
  t.doneAt = t.done ? todayKey() : null;
  commit();
}

// ---------- 렌더링 ----------
const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};

function commit() { save(); render(); }

// 삭제는 두 번 눌러야 실행 (첫 클릭은 '삭제?'로 바뀌고 3초 뒤 원래대로)
function armDelete(btn) {
  if (btn.classList.contains("armed")) return true;
  btn.classList.add("armed");
  btn.textContent = "삭제?";
  setTimeout(() => { btn.classList.remove("armed"); btn.textContent = "×"; }, 3000);
  return false;
}
function flash(form, msg) {
  let el = form.querySelector(".form-msg");
  if (!el) { el = h("p", { class: "form-msg" }); form.append(el); }
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.remove(), 3500);
}
const delBtn = (onDelete) => h("button", { class: "del", title: "삭제", onclick: (e) => { if (armDelete(e.currentTarget)) onDelete(); } }, "×");

function render() {
  const d = parseKey(ui.date);
  $("#monthTitle").textContent = `${d.getFullYear()} ${MONTHS[d.getMonth()]}`;
  $("#todayTitle").textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;

  const routines = routinesOn(ui.date);
  const done = routines.filter((r) => isDone(ui.date, r.id)).length;
  $("#routineRate").textContent = routines.length ? `${Math.round((done / routines.length) * 100)}%` : "";
  $("#todayRoutinesEmpty").hidden = routines.length > 0;
  $("#todayRoutines").replaceChildren(...routines.map((r) => {
    const ok = isDone(ui.date, r.id);
    return h("li", { class: ok ? "done" : "" },
      h("span", { class: "marker", style: `background:${r.color}` }),
      h("span", { class: "time" }, r.time || ""),
      h("span", { class: "text hand" }, r.name),
      h("span", { class: "meta" }, r.days.length === 7 ? "매일" : r.days.slice().sort().map((x) => DOW[x]).join(" ")),
      delBtn(() => { state.routines = state.routines.filter((x) => x.id !== r.id); commit(); }),
      h("input", { type: "checkbox", class: "check", checked: ok, onchange: () => toggleRoutine(ui.date, r.id) }),
    );
  }));

  // 선택한 날짜 기준 14일 안에 마감인 미완료 과제 + 그날 완료한 과제
  const tasks = state.tasks
    .filter((t) => (!t.done && diffDays(ui.date, t.due) <= 14) || (t.done && t.doneAt === ui.date))
    .sort((a, b) => a.done - b.done || a.due.localeCompare(b.due));
  $("#todayTasksEmpty").hidden = tasks.length > 0;
  $("#todayTasks").replaceChildren(...tasks.map((t) => {
    const dd = dday(t.due);
    return h("li", { class: t.done ? "done" : "" },
      h("input", { type: "checkbox", class: "check", checked: t.done, onchange: () => toggleTask(t.id) }),
      h("span", { class: "marker", style: `background:${t.color}` }),
      h("span", { class: "text" },
        h("span", { class: "hand" }, t.title),
        t.subject ? h("span", { class: "meta" }, `  · ${t.subject}`) : null),
      h("span", { class: `dday ${dd.cls}` }, dd.label),
      delBtn(() => { state.tasks = state.tasks.filter((x) => x.id !== t.id); commit(); }),
    );
  }));
}

// ---------- 이벤트 ----------
function init() {
  const shiftMonth = (n) => {
    const d = parseKey(ui.date);
    ui.date = keyOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
    render();
  };
  $("#prevMonth").onclick = () => shiftMonth(-1);
  $("#nextMonth").onclick = () => shiftMonth(1);
  $("#prevDay").onclick = () => { ui.date = addDays(ui.date, -1); render(); };
  $("#nextDay").onclick = () => { ui.date = addDays(ui.date, 1); render(); };
  $("#gotoToday").onclick = () => { ui.date = todayKey(); render(); };

  const goal = $("#goalInput");
  goal.value = state.goal;
  goal.addEventListener("input", () => { state.goal = goal.value; save(); });

  $("#dayPicker").replaceChildren(...DOW.map((d, i) =>
    h("label", {}, h("input", { type: "checkbox", name: "days", value: i, checked: true }), h("span", {}, d))));

  $("#routineForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const days = [...f.querySelectorAll("[name=days]:checked")].map((x) => Number(x.value));
    if (!days.length) return flash(f, "요일을 하나 이상 골라주세요.");
    state.routines.push({
      id: uid(), name: f.elements.name.value.trim(), time: f.elements.time.value, days,
      color: COLORS[state.routines.length % COLORS.length],
    });
    f.elements.name.value = ""; f.elements.time.value = "";
    commit();
  });

  $("#quickTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const due = f.elements.due.value;
    state.tasks.push({
      id: uid(), title: f.elements.title.value.trim(), subject: "", start: due < todayKey() ? due : todayKey(), due,
      color: COLORS[state.tasks.length % COLORS.length], done: false,
    });
    f.reset();
    commit();
  });

  render();
}

init();
