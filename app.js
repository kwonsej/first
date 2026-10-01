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
  tasks: [],
});

let state = load();
const ui = { view: "today", date: todayKey(), month: monthStart(new Date()), filter: "open", newRoutineColor: COLORS[0], newTaskColor: COLORS[0] };

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
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
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
function dayRate(key) {
  const list = routinesOn(key);
  if (!list.length) return null;
  return list.filter((r) => isDone(key, r.id)).length / list.length;
}

// ---------- 과제 로직 ----------
function taskProgress(t) {
  if (t.done) return 1;
  if (!t.steps.length) return 0;
  return t.steps.filter((s) => s.done).length / t.steps.length;
}
function addTask(data) {
  state.tasks.push({
    id: uid(), title: data.title.trim(), subject: (data.subject || "").trim(),
    start: data.start || todayKey(), due: data.due, memo: (data.memo || "").trim(),
    color: data.color || COLORS[0], done: false, steps: [],
  });
  commit();
}
const findTask = (id) => state.tasks.find((t) => t.id === id);

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

function render() {
  const m = ui.view === "today" ? parseKey(ui.date) : ui.month;
  $("#monthTitle").textContent = `${m.getFullYear()} ${MONTHS[m.getMonth()]}`;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.view === ui.view));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${ui.view}`));
  ({ today: renderToday, routine: renderRoutine, task: renderTasks, month: renderMonth })[ui.view]();
}

function renderToday() {
  const d = parseKey(ui.date);
  $("#todayTitle").textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;

  const routines = routinesOn(ui.date);
  const rate = dayRate(ui.date);
  $("#routineRate").textContent = rate == null ? "" : `${Math.round(rate * 100)}%`;
  $("#todayRoutinesEmpty").hidden = routines.length > 0;
  $("#todayRoutines").replaceChildren(...routines.map((r) => {
    const done = isDone(ui.date, r.id);
    return h("li", { class: done ? "done" : "" },
      h("span", { class: "marker", style: `background:${r.color}` }),
      h("span", { class: "time" }, r.time || ""),
      h("span", { class: "text hand" }, r.name),
      h("input", { type: "checkbox", class: "check", checked: done, onchange: () => toggleRoutine(ui.date, r.id) }),
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
    );
  }));
}

function toggleTask(id) {
  const t = findTask(id);
  t.done = !t.done;
  t.doneAt = t.done ? todayKey() : null;
  commit();
}

function renderRoutine() {
  // 트래커: 루틴 × 날짜 그리드 (레퍼런스의 월간 간트 표 느낌)
  const y = ui.month.getFullYear(), mo = ui.month.getMonth();
  const days = new Date(y, mo + 1, 0).getDate();
  const keys = Array.from({ length: days }, (_, i) => keyOf(new Date(y, mo, i + 1)));
  const today = todayKey();

  const head = h("tr", {}, h("th", { class: "name" }, "루틴"),
    keys.map((k, i) => {
      const dow = parseKey(k).getDay();
      return h("th", { class: [dow === 0 || dow === 6 ? "wkend" : "", k === today ? "today" : ""].join(" ") }, String(i + 1));
    }),
    h("th", {}, "달성"));

  const rows = state.routines.map((r) => {
    let planned = 0, done = 0;
    const cells = keys.map((k) => {
      const dow = parseKey(k).getDay();
      if (!r.days.includes(dow)) return h("td", { class: "off" });
      planned++;
      const ok = isDone(k, r.id);
      if (ok) done++;
      return h("td", {
        class: ["cell", dow === 0 || dow === 6 ? "wkend" : "", k === today ? "today" : ""].join(" "),
        title: `${k} ${r.name}`, onclick: () => toggleRoutine(k, r.id),
      }, ok ? h("span", { class: "pill", style: `background:${r.color}` }) : null);
    });
    return h("tr", {}, h("td", { class: "name hand" }, r.name), cells,
      h("td", { class: "rate" }, planned ? `${Math.round((done / planned) * 100)}%` : "-"));
  });
  $("#tracker").replaceChildren(h("thead", {}, head), h("tbody", {}, rows));

  $("#routineList").replaceChildren(...state.routines.map((r) =>
    h("li", {},
      h("span", { class: "marker", style: `background:${r.color}` }),
      h("span", { class: "time" }, r.time || "--:--"),
      h("span", { class: "text hand" }, r.name),
      h("span", { class: "meta" }, r.days.length === 7 ? "매일" : r.days.slice().sort().map((d) => DOW[d]).join(" ")),
      h("button", { class: "del", title: "삭제", onclick: () => {
        if (!confirm(`'${r.name}' 루틴을 삭제할까요?`)) return;
        state.routines = state.routines.filter((x) => x.id !== r.id);
        commit();
      } }, "×"),
    )));
}

function renderTasks() {
  const list = state.tasks
    .filter((t) => ui.filter === "all" || (ui.filter === "done" ? t.done : !t.done))
    .sort((a, b) => a.done - b.done || a.due.localeCompare(b.due));
  $("#taskListEmpty").hidden = list.length > 0;
  document.querySelectorAll("#taskFilters .chip").forEach((b) => b.classList.toggle("on", b.dataset.filter === ui.filter));

  $("#taskList").replaceChildren(...list.map((t) => {
    const dd = dday(t.due);
    const pct = Math.round(taskProgress(t) * 100);
    const stepInput = h("input", { class: "hand", placeholder: "+ 세부 단계" });
    return h("li", { class: `card ${t.done ? "done" : ""}`, style: `--c:${t.color}` },
      h("div", { class: "card-top" },
        h("input", { type: "checkbox", class: "check", checked: t.done, onchange: () => toggleTask(t.id) }),
        h("span", { class: "text hand" }, t.title),
        h("span", { class: `dday ${dd.cls}` }, dd.label),
        h("button", { class: "del", title: "삭제", onclick: () => {
          if (!confirm(`'${t.title}' 과제를 삭제할까요?`)) return;
          state.tasks = state.tasks.filter((x) => x.id !== t.id);
          commit();
        } }, "×")),
      h("div", { class: "sub" }, [t.subject, `${t.start.slice(5).replace("-", "/")} → ${t.due.slice(5).replace("-", "/")}`, `${pct}%`].filter(Boolean).join(" · ")),
      t.memo ? h("p", { class: "memo hand" }, t.memo) : null,
      h("div", { class: "progress" }, h("i", { style: `width:${pct}%` })),
      h("ul", { class: "steps" },
        t.steps.map((s) => h("li", { class: s.done ? "done" : "" },
          h("input", { type: "checkbox", class: "check", checked: s.done, onchange: () => { s.done = !s.done; commit(); } }),
          h("span", { class: "text hand" }, s.text),
          h("button", { class: "del", onclick: () => { t.steps = t.steps.filter((x) => x !== s); commit(); } }, "×"))),
        t.done ? null : h("li", {}, h("form", { style: "flex:1", onsubmit: (e) => {
          e.preventDefault();
          const text = stepInput.value.trim();
          if (!text) return;
          t.steps.push({ id: uid(), text, done: false });
          commit();
        } }, stepInput))),
    );
  }));
}

function renderMonth() {
  const y = ui.month.getFullYear(), mo = ui.month.getMonth();
  const first = new Date(y, mo, 1);
  const startKey = addDays(keyOf(first), -first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(y, mo + 1, 0).getDate()) / 7);
  const today = todayKey();

  const cells = DOW.map((d) => h("div", { class: "dow" }, d));
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(startKey, i);
    const d = parseKey(k);
    const rate = dayRate(k);
    const ring = rate == null || diffDays(k, today) < 0 ? null
      : h("span", { class: "ring", title: `루틴 ${Math.round(rate * 100)}%`, style: `background:${rate === 0 ? "var(--line)" : `color-mix(in srgb, var(--lime) ${Math.round(rate * 100)}%, var(--line))`}` });
    const bars = state.tasks
      .filter((t) => t.start <= k && k <= t.due)
      .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
      .map((t) => {
        const isFirst = k === t.start || d.getDay() === 0;
        return h("div", {
          class: ["bar", isFirst ? "first" : "", k === t.due || d.getDay() === 6 ? "last" : "", t.done ? "done" : ""].join(" "),
          style: `--c:${t.color}`, title: `${t.title} (~${t.due})`,
        }, isFirst ? t.title : " ");
      });
    cells.push(h("div", {
      class: ["day", d.getMonth() !== mo ? "muted" : "", d.getDay() === 0 ? "sun" : "", d.getDay() === 6 ? "sat" : "", k === today ? "is-today" : ""].join(" "),
      onclick: () => { ui.date = k; ui.view = "today"; render(); },
    }, h("div", { class: "num" }, h("b", {}, String(d.getDate())), ring), bars));
  }
  $("#calendar").replaceChildren(...cells);
}

// ---------- 이벤트 ----------
function setupSwatches(container, key) {
  const draw = () => container.replaceChildren(...COLORS.map((c) =>
    h("button", { type: "button", class: `swatch ${ui[key] === c ? "on" : ""}`, style: `background:${c}`,
      onclick: () => { ui[key] = c; draw(); } })));
  draw();
}

function init() {
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    ui.view = b.dataset.view;
    if (ui.view !== "today") ui.month = monthStart(parseKey(ui.date));
    render();
  }));

  const shiftMonth = (n) => {
    if (ui.view === "today") {
      const d = parseKey(ui.date);
      ui.date = keyOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
    } else {
      ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + n, 1);
      ui.date = keyOf(ui.month);
    }
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

  // 요일 선택
  $("#dayPicker").replaceChildren(...DOW.map((d, i) =>
    h("label", {}, h("input", { type: "checkbox", name: "days", value: i, checked: true }), h("span", {}, d))));
  setupSwatches($("#routineForm .swatches"), "newRoutineColor");
  setupSwatches($("#taskForm .swatches"), "newTaskColor");

  $("#routineForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const days = [...f.querySelectorAll("[name=days]:checked")].map((x) => Number(x.value));
    if (!days.length) return alert("요일을 하나 이상 골라주세요.");
    state.routines.push({ id: uid(), name: f.elements.name.value.trim(), time: f.elements.time.value, days, color: ui.newRoutineColor });
    f.elements.name.value = ""; f.elements.time.value = "";
    commit();
  });

  $("#taskForm").elements.start.value = todayKey();
  $("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.elements.start.value && f.elements.start.value > f.elements.due.value) return alert("마감일이 시작일보다 빨라요.");
    addTask({ title: f.elements.title.value, subject: f.elements.subject.value, start: f.elements.start.value, due: f.elements.due.value, memo: f.elements.memo.value, color: ui.newTaskColor });
    f.reset(); f.elements.start.value = todayKey();
  });

  $("#quickTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const start = f.elements.due.value < todayKey() ? f.elements.due.value : todayKey();
    addTask({ title: f.elements.title.value, due: f.elements.due.value, start, color: COLORS[state.tasks.length % COLORS.length] });
    f.reset();
  });

  $("#taskFilters").addEventListener("click", (e) => {
    if (!e.target.dataset.filter) return;
    ui.filter = e.target.dataset.filter;
    render();
  });

  render();
}

init();
