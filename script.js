const STORAGE_KEY = "ggb-entries";

const CATEGORIES = {
  expense: ["식비", "교통", "생활", "쇼핑", "문화/여가", "의료", "주거", "기타"],
  income: ["급여", "용돈", "부수입", "기타"],
};

const state = {
  entries: loadEntries(),
  cursor: startOfMonth(new Date()),
};

const el = {
  currentMonth: document.getElementById("currentMonth"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  totalIncome: document.getElementById("totalIncome"),
  totalExpense: document.getElementById("totalExpense"),
  totalBalance: document.getElementById("totalBalance"),
  form: document.getElementById("entryForm"),
  date: document.getElementById("date"),
  type: document.getElementById("type"),
  category: document.getElementById("category"),
  memo: document.getElementById("memo"),
  amount: document.getElementById("amount"),
  entryList: document.getElementById("entryList"),
  emptyMessage: document.getElementById("emptyMessage"),
};

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatMonth(d) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function formatWon(n) {
  return `${n.toLocaleString("ko-KR")}원`;
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function populateCategories() {
  const options = CATEGORIES[el.type.value];
  el.category.innerHTML = options.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function entriesForCurrentMonth() {
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth();
  return state.entries.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

function render() {
  el.currentMonth.textContent = formatMonth(state.cursor);

  const monthEntries = entriesForCurrentMonth().sort((a, b) => b.date.localeCompare(a.date));

  const income = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);

  el.totalIncome.textContent = formatWon(income);
  el.totalExpense.textContent = formatWon(expense);
  el.totalBalance.textContent = formatWon(income - expense);

  el.entryList.innerHTML = "";
  el.emptyMessage.style.display = monthEntries.length ? "none" : "block";

  for (const entry of monthEntries) {
    const li = document.createElement("li");
    li.className = `entry-item ${entry.type}`;
    const day = entry.date.slice(8, 10);
    const sign = entry.type === "income" ? "+" : "-";
    li.innerHTML = `
      <span class="date">${day}일</span>
      <span class="info">
        <span class="category">${escapeHtml(entry.category)}</span>
        ${entry.memo ? `<span class="memo">${escapeHtml(entry.memo)}</span>` : ""}
      </span>
      <span class="amount">${sign}${formatWon(entry.amount)}</span>
      <button class="delete-btn" data-id="${entry.id}" aria-label="삭제">✕</button>
    `;
    el.entryList.appendChild(li);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

el.type.addEventListener("change", populateCategories);

el.form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const amount = Number(el.amount.value);
  if (!el.date.value || !amount || amount <= 0) return;

  state.entries.push({
    id: crypto.randomUUID(),
    date: el.date.value,
    type: el.type.value,
    category: el.category.value,
    memo: el.memo.value.trim(),
    amount,
  });

  saveEntries();

  const keepDate = el.date.value;
  el.form.reset();
  el.date.value = keepDate;
  populateCategories();

  render();
});

el.entryList.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".delete-btn");
  if (!btn) return;
  state.entries = state.entries.filter((e) => e.id !== btn.dataset.id);
  saveEntries();
  render();
});

el.prevMonth.addEventListener("click", () => {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
  render();
});

el.nextMonth.addEventListener("click", () => {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
  render();
});

el.date.value = todayISO();
populateCategories();
render();
