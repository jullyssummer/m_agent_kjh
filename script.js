const LEGACY_KEY = "ggb-entries";
const STORE_KEY = "ggb-v2";

const ICONS = ["🍜","🚌","🧺","🛍️","🎬","💊","🏠","✨","💼","💌","🌟","🎁","📚","🐾","⚽","☕","🎮","💻","🚗","🧾"];
const COLORS = ["#ff8fab","#ffb787","#ffe08a","#b9e8a4","#8fe3c0","#8fd3f4","#a8b6f5","#c9a8f5","#f2a8e0","#c2b8a3"];
const ACCOUNT_ICONS = { cash: "💵", card: "💳", bank: "🏦" };

const DEFAULT_CATEGORIES = [
  { name: "식비", type: "expense", icon: "🍜", color: "#ff8fab" },
  { name: "교통", type: "expense", icon: "🚌", color: "#8fd3f4" },
  { name: "생활", type: "expense", icon: "🧺", color: "#b9e8a4" },
  { name: "쇼핑", type: "expense", icon: "🛍️", color: "#f2a8e0" },
  { name: "문화/여가", type: "expense", icon: "🎬", color: "#a8b6f5" },
  { name: "의료", type: "expense", icon: "💊", color: "#ffb787" },
  { name: "주거", type: "expense", icon: "🏠", color: "#c2b8a3" },
  { name: "기타", type: "expense", icon: "✨", color: "#c9a8f5" },
  { name: "급여", type: "income", icon: "💼", color: "#8fe3c0" },
  { name: "용돈", type: "income", icon: "💌", color: "#ffe08a" },
  { name: "부수입", type: "income", icon: "🌟", color: "#ffc94a" },
  { name: "기타", type: "income", icon: "🎁", color: "#c9a8f5" },
];

function uid() { return crypto.randomUUID(); }

function defaultState() {
  const categories = DEFAULT_CATEGORIES.map((c) => ({ id: uid(), budget: 0, ...c }));
  return {
    accounts: [{ id: uid(), name: "현금", type: "cash", initialBalance: 0 }],
    categories,
    transactions: [],
    recurringRules: [],
    savingsGoals: [],
    settings: { theme: "system" },
  };
}

function daysAgoISO(n) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  const tz = dt.getTimezoneOffset() * 60000;
  return new Date(dt - tz).toISOString().slice(0, 10);
}
function thisMonthDayISO(n) {
  const clamped = Math.max(0, Math.min(n, new Date().getDate() - 1));
  return daysAgoISO(clamped);
}
function firstOfNextMonthISO() {
  const now = new Date();
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const m = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function seedExampleData(base) {
  const accId = base.accounts[0].id;
  const catId = (name, type) => base.categories.find((c) => c.name === name && c.type === type).id;

  base.categories.find((c) => c.name === "식비" && c.type === "expense").budget = 90000;
  base.categories.find((c) => c.name === "교통" && c.type === "expense").budget = 5000;
  base.categories.find((c) => c.name === "쇼핑" && c.type === "expense").budget = 100000;
  base.categories.find((c) => c.name === "문화/여가" && c.type === "expense").budget = 30000;

  const mk = (date, type, catName, amount, memo, tags = []) => ({
    id: uid(), date, type, accountId: accId,
    categoryId: catId(catName, type), amount, memo, tags, isExample: true,
  });

  base.transactions = [
    mk(thisMonthDayISO(0), "income", "급여", 2800000, "이번 달 급여"),
    mk(thisMonthDayISO(1), "expense", "식비", 8500, "편의점 도시락"),
    mk(thisMonthDayISO(1), "expense", "교통", 1500, "버스"),
    mk(thisMonthDayISO(2), "expense", "쇼핑", 45000, "운동화", ["쇼핑몰"]),
    mk(thisMonthDayISO(3), "expense", "식비", 32000, "친구랑 저녁", ["모임"]),
    mk(thisMonthDayISO(4), "expense", "문화/여가", 15000, "영화"),
    mk(thisMonthDayISO(5), "expense", "생활", 22000, "생필품"),
    mk(thisMonthDayISO(5), "expense", "식비", 41000, "장보기"),
    mk(thisMonthDayISO(6), "expense", "교통", 4200, "지하철"),
    mk(thisMonthDayISO(6), "income", "용돈", 50000, "용돈"),
    mk(daysAgoISO(30), "expense", "식비", 12000, "저녁"),
    mk(daysAgoISO(33), "expense", "쇼핑", 68000, "생일 선물", ["선물"]),
    mk(daysAgoISO(38), "income", "급여", 2800000, "지난달 급여"),
    mk(daysAgoISO(45), "expense", "문화/여가", 25000, "공연 티켓"),
    mk(daysAgoISO(50), "expense", "교통", 30000, "택시"),
    mk(daysAgoISO(58), "expense", "식비", 9500, "저녁"),
    mk(daysAgoISO(65), "income", "용돈", 80000, "용돈"),
    mk(daysAgoISO(75), "expense", "생활", 18000, "생필품"),
  ];

  base.recurringRules = [{
    id: uid(), type: "expense", accountId: accId,
    categoryId: catId("문화/여가", "expense"),
    amount: 13500, memo: "넷플릭스", dayOfMonth: 1,
    nextRunDate: firstOfNextMonthISO(),
    active: true, isExample: true,
  }];

  base.savingsGoals = [{
    id: uid(), name: "제주도 여행", targetAmount: 1000000, currentAmount: 350000,
    targetDate: null, isExample: true,
  }];

  return base;
}

function hasExampleData() {
  return state.transactions.some((t) => t.isExample)
    || state.recurringRules.some((r) => r.isExample)
    || state.savingsGoals.some((g) => g.isExample);
}

function clearExampleData() {
  state.transactions = state.transactions.filter((t) => !t.isExample);
  state.recurringRules = state.recurringRules.filter((r) => !r.isExample);
  state.savingsGoals = state.savingsGoals.filter((g) => !g.isExample);
  saveState();
  renderActiveView();
}

function migrateFromLegacy(base) {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return base;
  let legacy = [];
  try { legacy = JSON.parse(raw) || []; } catch { legacy = []; }
  if (!legacy.length) return base;

  const defaultAccountId = base.accounts[0].id;
  const findCategoryId = (name, type) => {
    const found = base.categories.find((c) => c.name === name && c.type === type);
    return found ? found.id : base.categories.find((c) => c.type === type).id;
  };
  base.transactions = legacy.map((e) => ({
    id: e.id || uid(),
    date: e.date,
    type: e.type === "income" ? "income" : "expense",
    accountId: defaultAccountId,
    categoryId: findCategoryId(e.category, e.type === "income" ? "income" : "expense"),
    amount: e.amount,
    memo: e.memo || "",
    tags: [],
  }));
  return base;
}

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.accounts && parsed.categories) return parsed;
    } catch { /* fall through */ }
  }
  const hadLegacyData = !!localStorage.getItem(LEGACY_KEY);
  const base = migrateFromLegacy(defaultState());
  if (!hadLegacyData) seedExampleData(base);
  return base;
}

const state = loadState();
state.cursor = startOfMonth(new Date());

function saveState() {
  const { cursor, ...persisted } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify(persisted));
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }
function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}
function formatWon(n) { return `${Math.round(n).toLocaleString("ko-KR")}원`; }
function formatMonth(d) { return `${d.getFullYear()}년 ${d.getMonth() + 1}월`; }
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function accountById(id) { return state.accounts.find((a) => a.id === id); }
function categoryById(id) { return state.categories.find((c) => c.id === id); }

function applyRecurringRules() {
  const today = todayISO();
  let changed = false;
  for (const rule of state.recurringRules) {
    if (!rule.active) continue;
    let guard = 0;
    while (rule.nextRunDate <= today && guard < 36) {
      state.transactions.push({
        id: uid(),
        date: rule.nextRunDate,
        type: rule.type,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        amount: rule.amount,
        memo: rule.memo,
        tags: [],
        recurringRuleId: rule.id,
      });
      const d = new Date(rule.nextRunDate);
      const y = d.getFullYear(), m = d.getMonth();
      const nextMonth = m === 11 ? 0 : m + 1;
      const nextYear = m === 11 ? y + 1 : y;
      const day = Math.min(rule.dayOfMonth, daysInMonth(nextYear, nextMonth));
      rule.nextRunDate = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      changed = true;
      guard++;
    }
  }
  if (changed) saveState();
}

/* ---------- navigation ---------- */

const views = ["home", "list", "stats", "settings"];
let activeView = "home";
let charts = { category: null, trend: null };

function switchView(name) {
  activeView = name;
  for (const v of views) {
    document.getElementById(`view-${v}`).classList.toggle("active", v === name);
  }
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
  renderActiveView();
}

function renderActiveView() {
  if (activeView === "home") renderHome();
  else if (activeView === "list") renderList();
  else if (activeView === "stats") renderStats();
  else if (activeView === "settings") renderSettings();
}

/* ---------- theme ---------- */

function applyTheme() {
  const t = state.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
  document.querySelectorAll("#themeSwitch .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === t);
  });
}

/* ---------- month helpers ---------- */

function transactionsInMonth(cursor) {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  return state.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

function sumByType(list, type) {
  return list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

/* ---------- render: home ---------- */

function renderHome() {
  document.getElementById("exampleBanner").hidden = !hasExampleData();

  document.getElementById("currentMonth").textContent = formatMonth(state.cursor);
  const monthTx = transactionsInMonth(state.cursor);
  const income = sumByType(monthTx, "income");
  const expense = sumByType(monthTx, "expense");

  document.getElementById("homeIncome").textContent = formatWon(income);
  document.getElementById("homeExpense").textContent = formatWon(expense);
  document.getElementById("homeBalance").textContent = formatWon(income - expense);

  const budgetList = document.getElementById("budgetList");
  const budgeted = state.categories.filter((c) => c.type === "expense" && c.budget > 0);
  if (!budgeted.length) {
    budgetList.innerHTML = `<p class="empty-message">설정에서 카테고리 예산을 정해보세요.</p>`;
  } else {
    budgetList.innerHTML = budgeted.map((c) => {
      const spent = monthTx.filter((t) => t.type === "expense" && t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
      const pct = Math.min(100, (spent / c.budget) * 100);
      const cls = spent > c.budget ? "over" : pct >= 80 ? "warn" : "";
      return `
        <div class="budget-item">
          <div class="b-top">
            <span class="b-cat"><span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.name)}</span>
            <span class="b-amt">${formatWon(spent)} / ${formatWon(c.budget)}</span>
          </div>
          <div class="b-track"><div class="b-fill ${cls}" style="width:${pct}%"></div></div>
        </div>`;
    }).join("");
  }

  const goalPanel = document.getElementById("goalPanel");
  const goalPreview = document.getElementById("goalPreview");
  if (!state.savingsGoals.length) {
    goalPanel.hidden = true;
  } else {
    goalPanel.hidden = false;
    const g = state.savingsGoals[0];
    const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
    goalPreview.innerHTML = `
      <div class="g-name">🐷 ${escapeHtml(g.name)} ${pct >= 100 ? "🎉" : ""}</div>
      <div class="g-track"><div class="g-fill" style="width:${pct}%"></div></div>
      <div class="g-sub">${formatWon(g.currentAmount)} / ${formatWon(g.targetAmount)}</div>`;
  }

  const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  renderTxList(document.getElementById("recentList"), recent);
  document.getElementById("recentEmpty").hidden = recent.length > 0;
}

/* ---------- shared transaction list renderer ---------- */

function renderTxList(container, list) {
  container.innerHTML = list.map((t) => {
    let icon = "🔁", bg = "var(--accent-soft)", catName = "이체";
    if (t.type !== "transfer") {
      const c = categoryById(t.categoryId);
      icon = c ? c.icon : "✨";
      bg = c ? c.color + "33" : "var(--accent-soft)";
      catName = c ? c.name : "삭제된 카테고리";
    }
    const acc = accountById(t.accountId);
    const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : "";
    const day = t.date.slice(5, 10).replace("-", "/");
    const tags = (t.tags || []).map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join("");
    return `
      <li class="entry-item ${t.type}" data-id="${t.id}">
        <span class="e-icon" style="background:${bg}">${icon}</span>
        <span class="e-info">
          <span class="e-cat">${escapeHtml(catName)}${t.type === "transfer" ? " → " + escapeHtml(accountById(t.toAccountId)?.name || "") : ""}</span>
          <span class="e-meta">${day} · ${escapeHtml(acc ? acc.name : "")}${t.memo ? " · " + escapeHtml(t.memo) : ""}</span>
          ${tags ? `<span class="e-tags">${tags}</span>` : ""}
        </span>
        <span class="e-amount">${sign}${formatWon(t.amount)}</span>
        <button class="e-del" data-del="${t.id}" aria-label="삭제">✕</button>
      </li>`;
  }).join("");
}

/* ---------- render: list ---------- */

function populateFilterSelects() {
  const accSel = document.getElementById("filterAccount");
  const catSel = document.getElementById("filterCategory");
  accSel.innerHTML = `<option value="all">전체 계좌</option>` + state.accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  catSel.innerHTML = `<option value="all">전체 카테고리</option>` + state.categories.map((c) => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join("");
}

function renderList() {
  const kw = document.getElementById("searchInput").value.trim().toLowerCase();
  const accF = document.getElementById("filterAccount").value;
  const catF = document.getElementById("filterCategory").value;
  const typeF = document.getElementById("filterType").value;
  const allTime = document.getElementById("filterAllTime").checked;

  let list = allTime ? state.transactions : transactionsInMonth(state.cursor);
  if (accF !== "all") list = list.filter((t) => t.accountId === accF || t.toAccountId === accF);
  if (catF !== "all") list = list.filter((t) => t.categoryId === catF);
  if (typeF !== "all") list = list.filter((t) => t.type === typeF);
  if (kw) {
    list = list.filter((t) => {
      const cat = categoryById(t.categoryId);
      const hay = [t.memo, cat?.name, ...(t.tags || [])].join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }
  list = [...list].sort((a, b) => b.date.localeCompare(a.date));

  renderTxList(document.getElementById("entryList"), list);
  document.getElementById("listEmpty").hidden = list.length > 0;

  const tagSet = new Set();
  state.transactions.forEach((t) => (t.tags || []).forEach((tag) => tagSet.add(tag)));
  document.getElementById("tagSuggestions").innerHTML = [...tagSet].map((t) => `<option value="${escapeHtml(t)}">`).join("");
}

/* ---------- render: stats ---------- */

function renderStats() {
  const monthTx = transactionsInMonth(state.cursor);
  const expenses = monthTx.filter((t) => t.type === "expense");

  const byCategory = {};
  for (const t of expenses) {
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
  }
  const catIds = Object.keys(byCategory);
  const catCanvas = document.getElementById("categoryChart");
  document.getElementById("categoryChartEmpty").hidden = catIds.length > 0;
  catCanvas.style.display = catIds.length ? "block" : "none";

  if (charts.category) { charts.category.destroy(); charts.category = null; }
  if (catIds.length) {
    const labels = catIds.map((id) => categoryById(id)?.name || "기타");
    const colors = catIds.map((id) => categoryById(id)?.color || "#ccc");
    const data = catIds.map((id) => byCategory[id]);
    charts.category = new Chart(catCanvas, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: getComputedStyle(document.body).getPropertyValue("--surface") }] },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { color: inkColor(), font: { family: "Gowun Dodum" }, padding: 12 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatWon(ctx.raw)}` } },
        },
      },
    });
  }

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - i, 1);
    months.push(d);
  }
  const incomeData = months.map((d) => sumByType(transactionsInMonth(d), "income"));
  const expenseData = months.map((d) => sumByType(transactionsInMonth(d), "expense"));
  const trendCanvas = document.getElementById("trendChart");
  if (charts.trend) { charts.trend.destroy(); charts.trend = null; }
  charts.trend = new Chart(trendCanvas, {
    type: "bar",
    data: {
      labels: months.map((d) => `${d.getMonth() + 1}월`),
      datasets: [
        { label: "수입", data: incomeData, backgroundColor: cssVar("--income") },
        { label: "지출", data: expenseData, backgroundColor: cssVar("--expense") },
      ],
    },
    options: {
      scales: {
        x: { ticks: { color: mutedColor() }, grid: { display: false } },
        y: { ticks: { color: mutedColor(), callback: (v) => `${v / 10000}만` }, grid: { color: cssVar("--border") } },
      },
      plugins: { legend: { labels: { color: inkColor(), font: { family: "Gowun Dodum" } } } },
    },
  });

  const thisMonth = sumByType(monthTx, "expense");
  const prevCursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
  const prevMonth = sumByType(transactionsInMonth(prevCursor), "expense");
  const compareEl = document.getElementById("compareCard");
  if (prevMonth === 0) {
    compareEl.innerHTML = `<span class="c-icon">🌱</span><span>비교할 지난달 데이터가 없어요.</span>`;
  } else {
    const diff = thisMonth - prevMonth;
    const pct = Math.round((diff / prevMonth) * 100);
    const up = diff > 0;
    compareEl.innerHTML = `
      <span class="c-icon">${up ? "📈" : "📉"}</span>
      <span>이번 달 지출이 지난달보다 <b>${Math.abs(pct)}%</b> ${up ? "늘었어요" : "줄었어요"}</span>`;
  }
}

function cssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
function inkColor() { return cssVar("--ink"); }
function mutedColor() { return cssVar("--muted"); }

/* ---------- render: settings ---------- */

function renderSettings() {
  const accList = document.getElementById("accountList");
  accList.innerHTML = state.accounts.map((a) => {
    const balance = a.initialBalance
      + state.transactions.filter((t) => t.type === "income" && t.accountId === a.id).reduce((s, t) => s + t.amount, 0)
      - state.transactions.filter((t) => t.type === "expense" && t.accountId === a.id).reduce((s, t) => s + t.amount, 0)
      - state.transactions.filter((t) => t.type === "transfer" && t.accountId === a.id).reduce((s, t) => s + t.amount, 0)
      + state.transactions.filter((t) => t.type === "transfer" && t.toAccountId === a.id).reduce((s, t) => s + t.amount, 0);
    return `
      <li class="manage-item">
        <span class="m-icon">${ACCOUNT_ICONS[a.type] || "💰"}</span>
        <span class="m-info"><span class="m-title">${escapeHtml(a.name)}</span><span class="m-sub">${formatWon(balance)}</span></span>
        <span class="m-actions">
          <button class="icon-btn" data-edit-account="${a.id}">✏️</button>
          <button class="icon-btn" data-del-account="${a.id}">🗑️</button>
        </span>
      </li>`;
  }).join("");

  const catList = document.getElementById("categoryManageList");
  catList.innerHTML = state.categories.map((c) => `
    <li class="manage-item">
      <span class="m-icon" style="background:${c.color}55;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">${c.icon}</span>
      <span class="m-info"><span class="m-title">${escapeHtml(c.name)}</span><span class="m-sub">${c.type === "income" ? "수입" : "지출"}${c.budget ? " · 예산 " + formatWon(c.budget) : ""}</span></span>
      <span class="m-actions">
        <button class="icon-btn" data-edit-category="${c.id}">✏️</button>
        <button class="icon-btn" data-del-category="${c.id}">🗑️</button>
      </span>
    </li>`).join("");

  const recList = document.getElementById("recurringList");
  document.getElementById("recurringEmpty").hidden = state.recurringRules.length > 0;
  recList.innerHTML = state.recurringRules.map((r) => {
    const cat = categoryById(r.categoryId);
    return `
      <li class="manage-item">
        <span class="m-icon">${cat ? cat.icon : "🔁"}</span>
        <span class="m-info"><span class="m-title">${escapeHtml(r.memo || cat?.name || "반복 거래")}</span><span class="m-sub">매월 ${r.dayOfMonth}일 · ${formatWon(r.amount)}</span></span>
        <span class="m-actions">
          <button class="icon-btn" data-toggle-recurring="${r.id}">${r.active ? "⏸️" : "▶️"}</button>
          <button class="icon-btn" data-del-recurring="${r.id}">🗑️</button>
        </span>
      </li>`;
  }).join("");

  const goalList = document.getElementById("goalManageList");
  document.getElementById("goalEmpty").hidden = state.savingsGoals.length > 0;
  goalList.innerHTML = state.savingsGoals.map((g) => {
    const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
    return `
      <li class="manage-item">
        <span class="m-icon">🐷</span>
        <span class="m-info"><span class="m-title">${escapeHtml(g.name)}</span><span class="m-sub">${formatWon(g.currentAmount)} / ${formatWon(g.targetAmount)} (${pct}%)</span></span>
        <span class="m-actions">
          <button class="icon-btn" data-add-goal-money="${g.id}">➕</button>
          <button class="icon-btn" data-del-goal="${g.id}">🗑️</button>
        </span>
      </li>`;
  }).join("");
}

/* ---------- modal system ---------- */

const backdrop = document.getElementById("modalBackdrop");
const modalSheet = document.getElementById("modalSheet");

function openModal(html) {
  modalSheet.innerHTML = html;
  backdrop.hidden = false;
}
function closeModal() {
  backdrop.hidden = true;
  modalSheet.innerHTML = "";
}
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

function accountOptions(selectedId) {
  return state.accounts.map((a) => `<option value="${a.id}" ${a.id === selectedId ? "selected" : ""}>${ACCOUNT_ICONS[a.type]} ${escapeHtml(a.name)}</option>`).join("");
}
function categoryOptions(type, selectedId) {
  return state.categories.filter((c) => c.type === type).map((c) => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${c.icon} ${escapeHtml(c.name)}</option>`).join("");
}

/* ---- transaction modal ---- */

function openTxModal(existing) {
  const t = existing || { date: todayISO(), type: "expense", accountId: state.accounts[0]?.id, amount: "", memo: "", tags: [] };
  openModal(`
    <h3>${existing ? "내역 수정" : "내역 추가"} ✏️</h3>
    <form id="txForm">
      <div class="form-row">
        <div class="form-field"><label>날짜</label><input type="date" id="txDate" class="cute-input" value="${t.date}" required></div>
        <div class="form-field"><label>종류</label>
          <select id="txType" class="cute-select">
            <option value="expense" ${t.type === "expense" ? "selected" : ""}>지출</option>
            <option value="income" ${t.type === "income" ? "selected" : ""}>수입</option>
            <option value="transfer" ${t.type === "transfer" ? "selected" : ""}>이체</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>계좌</label><select id="txAccount" class="cute-select">${accountOptions(t.accountId)}</select></div>
        <div class="form-field" id="txCategoryWrap"><label>카테고리</label><select id="txCategory" class="cute-select">${categoryOptions(t.type === "income" ? "income" : "expense", t.categoryId)}</select></div>
      </div>
      <div class="form-field" id="txToAccountWrap" hidden><label>받는 계좌</label><select id="txToAccount" class="cute-select">${accountOptions(t.toAccountId)}</select></div>
      <div class="form-field"><label>금액</label><input type="number" id="txAmount" class="cute-input" min="0" value="${t.amount}" required></div>
      <div class="form-field"><label>메모</label><input type="text" id="txMemo" class="cute-input" value="${escapeHtml(t.memo || "")}" placeholder="선택"></div>
      <div class="form-field"><label>태그 (콤마로 구분)</label><input type="text" id="txTags" class="cute-input" list="tagSuggestions" value="${(t.tags || []).join(", ")}" placeholder="#여행, #선물"></div>
      <div class="modal-actions">
        ${existing ? `<button type="button" class="pill-btn ghost" id="txDeleteBtn">삭제</button>` : ""}
        <button type="submit" class="pill-btn">${existing ? "저장" : "추가"} 🌟</button>
      </div>
    </form>
  `);

  const typeSel = document.getElementById("txType");
  const catWrap = document.getElementById("txCategoryWrap");
  const toAccWrap = document.getElementById("txToAccountWrap");
  const catSel = document.getElementById("txCategory");

  function syncTypeUI() {
    const isTransfer = typeSel.value === "transfer";
    catWrap.hidden = isTransfer;
    toAccWrap.hidden = !isTransfer;
    if (!isTransfer) catSel.innerHTML = categoryOptions(typeSel.value, existing?.categoryId);
  }
  typeSel.addEventListener("change", syncTypeUI);
  syncTypeUI();

  if (existing) {
    document.getElementById("txDeleteBtn").addEventListener("click", () => {
      state.transactions = state.transactions.filter((x) => x.id !== existing.id);
      saveState(); closeModal(); renderActiveView();
    });
  }

  document.getElementById("txForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const amount = Number(document.getElementById("txAmount").value);
    if (!amount || amount <= 0) return;
    const type = typeSel.value;
    const tags = document.getElementById("txTags").value.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      date: document.getElementById("txDate").value,
      type,
      accountId: document.getElementById("txAccount").value,
      categoryId: type === "transfer" ? null : catSel.value,
      toAccountId: type === "transfer" ? document.getElementById("txToAccount").value : undefined,
      amount,
      memo: document.getElementById("txMemo").value.trim(),
      tags,
    };
    if (existing) {
      Object.assign(existing, payload);
    } else {
      state.transactions.push({ id: uid(), ...payload });
    }
    saveState();
    closeModal();
    renderActiveView();
  });
}

/* ---- account modal ---- */

function openAccountModal(existing) {
  const a = existing || { name: "", type: "cash", initialBalance: 0 };
  openModal(`
    <h3>${existing ? "계좌 수정" : "계좌 추가"} 🏦</h3>
    <form id="accForm">
      <div class="form-field"><label>이름</label><input type="text" id="accName" class="cute-input" value="${escapeHtml(a.name)}" required></div>
      <div class="form-field"><label>종류</label>
        <select id="accType" class="cute-select">
          <option value="cash" ${a.type === "cash" ? "selected" : ""}>💵 현금</option>
          <option value="card" ${a.type === "card" ? "selected" : ""}>💳 카드</option>
          <option value="bank" ${a.type === "bank" ? "selected" : ""}>🏦 계좌</option>
        </select>
      </div>
      <div class="form-field"><label>시작 잔액</label><input type="number" id="accBalance" class="cute-input" value="${a.initialBalance}"></div>
      <div class="modal-actions"><button type="submit" class="pill-btn block">${existing ? "저장" : "추가"} 🌟</button></div>
    </form>
  `);
  document.getElementById("accForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const payload = {
      name: document.getElementById("accName").value.trim(),
      type: document.getElementById("accType").value,
      initialBalance: Number(document.getElementById("accBalance").value) || 0,
    };
    if (!payload.name) return;
    if (existing) Object.assign(existing, payload);
    else state.accounts.push({ id: uid(), ...payload });
    saveState(); closeModal(); renderActiveView();
  });
}

/* ---- category modal ---- */

function openCategoryModal(existing) {
  const c = existing || { name: "", type: "expense", icon: ICONS[0], color: COLORS[0], budget: 0 };
  openModal(`
    <h3>${existing ? "카테고리 수정" : "카테고리 추가"} 🎨</h3>
    <form id="catForm">
      <div class="form-field"><label>이름</label><input type="text" id="catName" class="cute-input" value="${escapeHtml(c.name)}" required></div>
      <div class="form-field"><label>종류</label>
        <select id="catType" class="cute-select">
          <option value="expense" ${c.type === "expense" ? "selected" : ""}>지출</option>
          <option value="income" ${c.type === "income" ? "selected" : ""}>수입</option>
        </select>
      </div>
      <div class="form-field"><label>아이콘</label><div class="icon-picker" id="iconPicker">
        ${ICONS.map((i) => `<span class="icon-opt ${i === c.icon ? "selected" : ""}" data-icon="${i}">${i}</span>`).join("")}
      </div></div>
      <div class="form-field"><label>색상</label><div class="color-picker" id="colorPicker">
        ${COLORS.map((col) => `<span class="color-opt ${col === c.color ? "selected" : ""}" data-color="${col}" style="background:${col}"></span>`).join("")}
      </div></div>
      <div class="form-field"><label>월 예산 (지출 카테고리만)</label><input type="number" id="catBudget" class="cute-input" value="${c.budget || 0}" min="0"></div>
      <div class="modal-actions">
        ${existing ? `<button type="button" class="pill-btn ghost" id="catDeleteBtn">삭제</button>` : ""}
        <button type="submit" class="pill-btn">${existing ? "저장" : "추가"} 🌟</button>
      </div>
    </form>
  `);

  let selIcon = c.icon, selColor = c.color;
  document.getElementById("iconPicker").addEventListener("click", (e) => {
    const opt = e.target.closest(".icon-opt");
    if (!opt) return;
    selIcon = opt.dataset.icon;
    document.querySelectorAll("#iconPicker .icon-opt").forEach((el) => el.classList.toggle("selected", el === opt));
  });
  document.getElementById("colorPicker").addEventListener("click", (e) => {
    const opt = e.target.closest(".color-opt");
    if (!opt) return;
    selColor = opt.dataset.color;
    document.querySelectorAll("#colorPicker .color-opt").forEach((el) => el.classList.toggle("selected", el === opt));
  });

  if (existing) {
    document.getElementById("catDeleteBtn").addEventListener("click", () => {
      const inUse = state.transactions.some((t) => t.categoryId === existing.id);
      if (inUse) { alert("이 카테고리를 사용하는 내역이 있어서 삭제할 수 없어요."); return; }
      state.categories = state.categories.filter((x) => x.id !== existing.id);
      saveState(); closeModal(); renderActiveView();
    });
  }

  document.getElementById("catForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const payload = {
      name: document.getElementById("catName").value.trim(),
      type: document.getElementById("catType").value,
      icon: selIcon,
      color: selColor,
      budget: Number(document.getElementById("catBudget").value) || 0,
    };
    if (!payload.name) return;
    if (existing) Object.assign(existing, payload);
    else state.categories.push({ id: uid(), ...payload });
    saveState(); closeModal(); renderActiveView();
  });
}

/* ---- recurring modal ---- */

function openRecurringModal() {
  openModal(`
    <h3>반복 거래 추가 🔁</h3>
    <form id="recForm">
      <div class="form-row">
        <div class="form-field"><label>종류</label>
          <select id="recType" class="cute-select">
            <option value="expense">지출</option>
            <option value="income">수입</option>
          </select>
        </div>
        <div class="form-field"><label>매월 며칠</label><input type="number" id="recDay" class="cute-input" min="1" max="31" value="1" required></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>계좌</label><select id="recAccount" class="cute-select">${accountOptions(state.accounts[0]?.id)}</select></div>
        <div class="form-field"><label>카테고리</label><select id="recCategory" class="cute-select">${categoryOptions("expense")}</select></div>
      </div>
      <div class="form-field"><label>금액</label><input type="number" id="recAmount" class="cute-input" min="0" required></div>
      <div class="form-field"><label>이름</label><input type="text" id="recMemo" class="cute-input" placeholder="예: 월세, 넷플릭스" required></div>
      <div class="modal-actions"><button type="submit" class="pill-btn block">추가 🌟</button></div>
    </form>
  `);
  const typeSel = document.getElementById("recType");
  const catSel = document.getElementById("recCategory");
  typeSel.addEventListener("change", () => { catSel.innerHTML = categoryOptions(typeSel.value); });

  document.getElementById("recForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const amount = Number(document.getElementById("recAmount").value);
    const dayOfMonth = Number(document.getElementById("recDay").value);
    if (!amount || amount <= 0 || !dayOfMonth) return;
    const now = new Date();
    let nextRunDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.min(dayOfMonth, daysInMonth(now.getFullYear(), now.getMonth()))).padStart(2, "0")}`;
    state.recurringRules.push({
      id: uid(),
      type: typeSel.value,
      accountId: document.getElementById("recAccount").value,
      categoryId: catSel.value,
      amount,
      memo: document.getElementById("recMemo").value.trim(),
      dayOfMonth,
      nextRunDate,
      active: true,
    });
    saveState();
    applyRecurringRules();
    closeModal(); renderActiveView();
  });
}

/* ---- goal modal ---- */

function openGoalModal() {
  openModal(`
    <h3>저축 목표 추가 🎯</h3>
    <form id="goalForm">
      <div class="form-field"><label>목표 이름</label><input type="text" id="goalName" class="cute-input" placeholder="예: 여행 자금" required></div>
      <div class="form-field"><label>목표 금액</label><input type="number" id="goalAmount" class="cute-input" min="1" required></div>
      <div class="form-field"><label>목표일 (선택)</label><input type="date" id="goalDate" class="cute-input"></div>
      <div class="modal-actions"><button type="submit" class="pill-btn block">추가 🌟</button></div>
    </form>
  `);
  document.getElementById("goalForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const targetAmount = Number(document.getElementById("goalAmount").value);
    const name = document.getElementById("goalName").value.trim();
    if (!name || !targetAmount) return;
    state.savingsGoals.push({
      id: uid(), name, targetAmount,
      targetDate: document.getElementById("goalDate").value || null,
      currentAmount: 0,
    });
    saveState(); closeModal(); renderActiveView();
  });
}

/* ---------- event wiring ---------- */

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});
document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.nav));
});

document.getElementById("prevMonth").addEventListener("click", () => {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
  renderActiveView();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
  renderActiveView();
});

document.getElementById("fabAdd").addEventListener("click", () => openTxModal(null));

document.getElementById("clearExampleBtn").addEventListener("click", () => {
  if (confirm("예시 데이터를 모두 지울까요?")) clearExampleData();
});

document.getElementById("recentList").addEventListener("click", handleTxListClick);
document.getElementById("entryList").addEventListener("click", handleTxListClick);
function handleTxListClick(e) {
  const del = e.target.closest("[data-del]");
  if (del) {
    state.transactions = state.transactions.filter((t) => t.id !== del.dataset.del);
    saveState(); renderActiveView();
    return;
  }
  const item = e.target.closest(".entry-item");
  if (item) openTxModal(state.transactions.find((t) => t.id === item.dataset.id));
}

["searchInput", "filterAccount", "filterCategory", "filterType", "filterAllTime"].forEach((id) => {
  document.getElementById(id).addEventListener("input", renderList);
  document.getElementById(id).addEventListener("change", renderList);
});

document.getElementById("themeSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  state.settings.theme = btn.dataset.theme;
  saveState(); applyTheme();
});

document.getElementById("addAccountBtn").addEventListener("click", () => openAccountModal(null));
document.getElementById("accountList").addEventListener("click", (e) => {
  const editId = e.target.closest("[data-edit-account]")?.dataset.editAccount;
  const delId = e.target.closest("[data-del-account]")?.dataset.delAccount;
  if (editId) openAccountModal(accountById(editId));
  if (delId) {
    if (state.accounts.length <= 1) { alert("최소 1개의 계좌가 필요해요."); return; }
    const inUse = state.transactions.some((t) => t.accountId === delId || t.toAccountId === delId);
    if (inUse) { alert("이 계좌를 사용하는 내역이 있어서 삭제할 수 없어요."); return; }
    state.accounts = state.accounts.filter((a) => a.id !== delId);
    saveState(); renderActiveView();
  }
});

document.getElementById("addCategoryBtn").addEventListener("click", () => openCategoryModal(null));
document.getElementById("categoryManageList").addEventListener("click", (e) => {
  const editId = e.target.closest("[data-edit-category]")?.dataset.editCategory;
  const delId = e.target.closest("[data-del-category]")?.dataset.delCategory;
  if (editId) openCategoryModal(categoryById(editId));
  if (delId) {
    const inUse = state.transactions.some((t) => t.categoryId === delId);
    if (inUse) { alert("이 카테고리를 사용하는 내역이 있어서 삭제할 수 없어요."); return; }
    state.categories = state.categories.filter((c) => c.id !== delId);
    saveState(); renderActiveView();
  }
});

document.getElementById("addRecurringBtn").addEventListener("click", () => openRecurringModal());
document.getElementById("recurringList").addEventListener("click", (e) => {
  const toggleId = e.target.closest("[data-toggle-recurring]")?.dataset.toggleRecurring;
  const delId = e.target.closest("[data-del-recurring]")?.dataset.delRecurring;
  if (toggleId) {
    const r = state.recurringRules.find((x) => x.id === toggleId);
    r.active = !r.active;
    saveState(); renderActiveView();
  }
  if (delId) {
    state.recurringRules = state.recurringRules.filter((r) => r.id !== delId);
    saveState(); renderActiveView();
  }
});

document.getElementById("addGoalBtn").addEventListener("click", () => openGoalModal());
document.getElementById("goalManageList").addEventListener("click", (e) => {
  const addId = e.target.closest("[data-add-goal-money]")?.dataset.addGoalMoney;
  const delId = e.target.closest("[data-del-goal]")?.dataset.delGoal;
  if (addId) {
    const amountStr = prompt("얼마를 저축할까요? (원)");
    const amount = Number(amountStr);
    if (amountStr && amount > 0) {
      const g = state.savingsGoals.find((x) => x.id === addId);
      g.currentAmount += amount;
      saveState(); renderActiveView();
    }
  }
  if (delId) {
    state.savingsGoals = state.savingsGoals.filter((g) => g.id !== delId);
    saveState(); renderActiveView();
  }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const { cursor, ...persisted } = state;
  const blob = new Blob([JSON.stringify(persisted, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `가계부-백업-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.accounts || !parsed.categories || !parsed.transactions) throw new Error("invalid");
      if (!confirm("현재 데이터를 불러온 파일로 덮어쓸까요?")) return;
      Object.assign(state, {
        accounts: parsed.accounts,
        categories: parsed.categories,
        transactions: parsed.transactions,
        recurringRules: parsed.recurringRules || [],
        savingsGoals: parsed.savingsGoals || [],
        settings: parsed.settings || { theme: "system" },
      });
      saveState(); applyTheme(); populateFilterSelects(); renderActiveView();
    } catch {
      alert("올바른 백업 파일이 아니에요.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ---------- init ---------- */

applyRecurringRules();
applyTheme();
populateFilterSelects();
switchView("home");
