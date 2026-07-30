// Budget Tracker — vanilla JavaScript, local-first, no backend.

const STORAGE_KEY = "budget-tracker-state-v1";
const STORAGE_VERSION = 1;
const defaultCategories = ["طعام", "مواصلات", "راتب", "ترفيه", "إيجار", "صحة", "أخرى"];

const defaultState = {
  version: STORAGE_VERSION,
  transactions: [],
  categories: [...defaultCategories],
  budget: 50000,
  theme: "light",
  displayCurrency: "DZD",
  userName: "",
};

const validCurrencies = ["DZD", "USD", "EUR", "SAR", "AED", "QAR", "GBP"];

let state = loadState();
let charts = {};
let undoState = null;

const els = {};

function initializeApp() {
  cacheDomElements();
  applyTheme();
  populateCurrencySelect();
  bindEvents();
  render({ refreshCharts: false });
  requestAnimationFrame(() => {
    render({ refreshCharts: true });
  });
}

function cacheDomElements() {
  els.balanceValue = document.getElementById("balanceValue");
  els.incomeValue = document.getElementById("incomeValue");
  els.expenseValue = document.getElementById("expenseValue");
  els.remainingValue = document.getElementById("remainingValue");
  els.budgetRatioValue = document.getElementById("budgetRatioValue");
  els.budgetValue = document.getElementById("budgetValue");
  els.budgetSpentValue = document.getElementById("budgetSpentValue");
  els.budgetRemainingValue = document.getElementById("budgetRemainingValue");
  els.budgetProgressBar = document.getElementById("budgetProgressBar");
  els.budgetAlert = document.getElementById("budgetAlert");
  els.themeToggle = document.getElementById("themeToggle");
  els.openTransactionModal = document.getElementById("openTransactionModal");
  els.transactionModal = document.getElementById("transactionModal");
  els.closeModalBtn = document.getElementById("closeModalBtn");
  els.cancelModalBtn = document.getElementById("cancelModalBtn");
  els.transactionForm = document.getElementById("transactionForm");
  els.transactionId = document.getElementById("transactionId");
  els.transactionType = document.getElementById("transactionType");
  els.transactionAmount = document.getElementById("transactionAmount");
  els.transactionCurrency = document.getElementById("transactionCurrency");
  els.transactionCategory = document.getElementById("transactionCategory");
  els.transactionDate = document.getElementById("transactionDate");
  els.transactionNotes = document.getElementById("transactionNotes");
  els.modalTitle = document.getElementById("modalTitle");
  els.searchInput = document.getElementById("searchInput");
  els.typeFilter = document.getElementById("typeFilter");
  els.categoryFilter = document.getElementById("categoryFilter");
  els.monthFilter = document.getElementById("monthFilter");
  els.transactionsTableBody = document.getElementById("transactionsTableBody");
  els.categoryForm = document.getElementById("categoryForm");
  els.newCategoryInput = document.getElementById("newCategoryInput");
  els.categoriesList = document.getElementById("categoriesList");
  els.displayCurrencySelect = document.getElementById("displayCurrencySelect");
  els.userNameInput = document.getElementById("userNameInput");
  els.resetDataBtn = document.getElementById("resetDataBtn");
  els.exportJsonBtn = document.getElementById("exportJsonBtn");
  els.exportCsvBtn = document.getElementById("exportCsvBtn");
  els.importFileInput = document.getElementById("importFileInput");
  els.editBudgetBtn = document.getElementById("editBudgetBtn");
  els.balanceHint = document.getElementById("balanceHint");
  els.toastContainer = document.getElementById("toastContainer");
  els.insightsGrid = document.getElementById("insightsGrid");
  els.healthScore = document.getElementById("healthScore");
  els.openSupportModalBtn = document.getElementById("openSupportModalBtn");
  els.supportModal = document.getElementById("supportModal");
  els.closeSupportModalBtn = document.getElementById("closeSupportModalBtn");
}

function bindEvents() {
  els.themeToggle.addEventListener("click", toggleTheme);
  els.openTransactionModal.addEventListener("click", () => openTransactionModal());
  els.closeModalBtn.addEventListener("click", closeTransactionModal);
  els.cancelModalBtn.addEventListener("click", closeTransactionModal);
  els.transactionForm.addEventListener("submit", handleTransactionSubmit);
  els.searchInput.addEventListener("input", renderTransactions);
  els.typeFilter.addEventListener("change", renderTransactions);
  els.categoryFilter.addEventListener("change", renderTransactions);
  els.monthFilter.addEventListener("change", renderTransactions);
  els.categoryForm.addEventListener("submit", handleCategorySubmit);
  els.displayCurrencySelect.addEventListener("change", (event) => {
    state.displayCurrency = event.target.value;
    saveState();
    render({ refreshCharts: true });
  });
  els.userNameInput.addEventListener("input", (event) => {
    state.userName = event.target.value;
    saveState();
    render();
  });
  els.resetDataBtn.addEventListener("click", () => showConfirm("هل تريد حذف جميع البيانات؟ هذه الخطوة لا يمكن التراجع عنها.", resetAllData));
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.importFileInput.addEventListener("change", importJsonFile);
  els.editBudgetBtn.addEventListener("click", editBudget);
  document.addEventListener("keydown", handleKeyboardShortcuts);
  els.transactionModal.addEventListener("click", (event) => {
    if (event.target === els.transactionModal) closeTransactionModal();
  });
  els.transactionsTableBody.addEventListener("click", handleTransactionTableClick);
  els.categoriesList.addEventListener("click", handleCategoryListClick);
  if (els.openSupportModalBtn) {
    els.openSupportModalBtn.addEventListener("click", openSupportModal);
  }
  if (els.closeSupportModalBtn) {
    els.closeSupportModalBtn.addEventListener("click", closeSupportModal);
  }
  if (els.supportModal) {
    els.supportModal.addEventListener("click", (event) => {
      if (event.target === els.supportModal) closeSupportModal();
    });
  }
}

function cloneData(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function createInitialState() {
  return normalizeState(defaultState);
}

function normalizeState(input = {}) {
  const base = cloneData(defaultState);
  const normalizeTransaction = (tx) => {
    if (!tx || typeof tx !== "object") return null;
    const amount = Number(tx.amount);
    const date = typeof tx.date === "string" && tx.date ? tx.date : new Date().toISOString().slice(0, 10);
    const currency = typeof tx.currency === "string" && validCurrencies.includes(tx.currency) ? tx.currency : base.displayCurrency;
    const type = tx.type === "income" ? "income" : "expense";
    const category = typeof tx.category === "string" && tx.category.trim() ? tx.category.trim() : "أخرى";
    const notes = typeof tx.notes === "string" ? tx.notes : "";
    const id = typeof tx.id === "string" ? tx.id : typeof tx.id === "number" ? String(tx.id) : crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    return {
      id,
      type,
      amount: Number.isFinite(amount) ? amount : 0,
      currency,
      category,
      date,
      notes,
    };
  };

  const next = {
    ...base,
    ...input,
    version: STORAGE_VERSION,
    transactions: Array.isArray(input.transactions) ? input.transactions.map(normalizeTransaction).filter(Boolean) : [],
    budget: Number.isFinite(Number(input.budget)) ? Number(input.budget) : base.budget,
    theme: input.theme === "dark" ? "dark" : "light",
    displayCurrency: typeof input.displayCurrency === "string" && validCurrencies.includes(input.displayCurrency) ? input.displayCurrency : base.displayCurrency,
    userName: typeof input.userName === "string" ? input.userName : "",
  };

  next.categories = Array.isArray(input.categories) && input.categories.length ? input.categories.filter(Boolean) : [...defaultCategories];
  if (!next.categories.includes("أخرى")) {
    next.categories.push("أخرى");
  }
  return next;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.error("Failed to load state", error);
    return createInitialState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Unable to save state", error);
    showToast("تعذر حفظ البيانات في المتصفح. حاول تقليل عدد العناصر.");
  }
}

function applyTheme() {
  document.body.setAttribute("data-theme", state.theme || "light");
  if (els.themeToggle) {
    els.themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
  }
}

function openSupportModal() {
  if (els.supportModal) {
    els.supportModal.classList.remove("hidden");
    els.supportModal.setAttribute("aria-hidden", "false");
  }
}

function closeSupportModal() {
  if (els.supportModal) {
    els.supportModal.classList.add("hidden");
    els.supportModal.setAttribute("aria-hidden", "true");
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
}

function populateCurrencySelect() {
  if (els.transactionCurrency) {
    els.transactionCurrency.value = state.displayCurrency || "DZD";
  }
  if (els.displayCurrencySelect) {
    els.displayCurrencySelect.value = state.displayCurrency || "DZD";
  }
  if (els.userNameInput) {
    els.userNameInput.value = state.userName || "";
  }
}

function render(options = {}) {
  const { refreshCharts = false } = options;
  renderSummary();
  renderBudget();
  renderCategories();
  populateCategoryOptions();
  populateFilters();
  renderTransactions();
  renderInsights();
  if (refreshCharts) {
    renderCharts();
  }
}

function getMetrics() {
  const visibleTransactions = state.transactions.filter((tx) => tx.currency === state.displayCurrency);
  const income = visibleTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expense = visibleTransactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const balance = income - expense;
  const remaining = state.budget - expense;
  const ratio = state.budget > 0 ? Math.min(100, Math.round((expense / state.budget) * 100)) : 0;
  return { income, expense, balance, remaining, ratio, visibleTransactions };
}

function renderSummary() {
  const { income, expense, balance, remaining, ratio } = getMetrics();
  els.balanceValue.textContent = `${formatAmount(balance, state.displayCurrency)}`;
  els.incomeValue.textContent = `${formatAmount(income, state.displayCurrency)}`;
  els.expenseValue.textContent = `${formatAmount(expense, state.displayCurrency)}`;
  els.remainingValue.textContent = `${formatAmount(remaining, state.displayCurrency)}`;
  els.budgetRatioValue.textContent = `${ratio}%`;
  const otherCurrencyCount = state.transactions.filter((tx) => tx.currency !== state.displayCurrency).length;
  const baseHint = balance >= 0 ? "أنت في وضع جيد هذا الشهر." : "راجع نفقاتك لتقليل الضغوط المالية.";
  els.balanceHint.textContent = otherCurrencyCount
    ? `${baseHint} يوجد ${otherCurrencyCount} عملية بعملات أخرى غير محسوبة في الملخص الحالي.`
    : baseHint;
}

function renderBudget() {
  const { expense, remaining, ratio } = getMetrics();
  els.budgetValue.textContent = `${formatAmount(state.budget, state.displayCurrency)}`;
  els.budgetSpentValue.textContent = `${formatAmount(expense, state.displayCurrency)}`;
  els.budgetRemainingValue.textContent = `${formatAmount(remaining, state.displayCurrency)}`;
  els.budgetProgressBar.style.width = `${ratio}%`;
  els.budgetProgressBar.classList.toggle("warning", ratio >= 90);
  els.budgetProgressBar.parentElement.setAttribute("aria-valuenow", String(ratio));

  if (ratio >= 100) {
    els.budgetAlert.textContent = "⚠ تجاوزت الميزانية المحددة.";
  } else if (ratio >= 90) {
    els.budgetAlert.textContent = "⚠ اقتربت من تجاوز ميزانيتك.";
  } else {
    els.budgetAlert.textContent = "لا توجد تنبيهات حالياً.";
  }
}

function getMonthKey(dateString) {
  return String(dateString || "").slice(0, 7);
}

function renderInsights() {
  const { expense, balance, ratio } = getMetrics();
  const currentMonth = new Date();
  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const previousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;

  const currentMonthExpenses = state.transactions
    .filter((tx) => tx.type === "expense" && tx.currency === state.displayCurrency && getMonthKey(tx.date) === currentMonthKey)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const previousMonthExpenses = state.transactions
    .filter((tx) => tx.type === "expense" && tx.currency === state.displayCurrency && getMonthKey(tx.date) === previousMonthKey)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const deltaPercent = previousMonthExpenses > 0 ? ((currentMonthExpenses - previousMonthExpenses) / previousMonthExpenses) * 100 : currentMonthExpenses > 0 ? 100 : 0;
  const dailyAverage = currentMonthExpenses / Math.max(1, currentMonth.getDate());
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - currentMonth.getDate());
  const daysToBudget = dailyAverage > 0 && currentMonthExpenses < state.budget ? Math.ceil((state.budget - currentMonthExpenses) / dailyAverage) : 0;

  const expenseByCategory = state.transactions
    .filter((tx) => tx.type === "expense" && tx.currency === state.displayCurrency)
    .reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
      return acc;
    }, {});
  const topCategory = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];

  let healthLabel = "جيد";
  let healthTone = "good";
  if (ratio >= 90) {
    healthLabel = "تنبيه";
    healthTone = "alert";
  } else if (ratio >= 70) {
    healthLabel = "مراقبة";
    healthTone = "warning";
  }

  const insights = [
    {
      title: "أكثر فئة تستنزف ميزانيتك",
      value: topCategory ? `${topCategory[0]}` : "لا توجد مصروفات",
      caption: topCategory ? `${formatAmount(topCategory[1], state.displayCurrency)} هذا الشهر` : "ابدأ بإضافة مصروفات لرؤية الاتجاهات",
    },
    {
      title: "مقارنة بالشهر الماضي",
      value: `${deltaPercent >= 0 ? "+" : ""}${Math.round(deltaPercent)}%`,
      caption: deltaPercent >= 0 ? "أعلى من الشهر الماضي" : "أقل من الشهر الماضي",
    },
    {
      title: "متوسط الإنفاق اليومي",
      value: formatAmount(dailyAverage, state.displayCurrency),
      caption: `متبقي ${daysLeft} يومًا في هذا الشهر`,
    },
    {
      title: "تقدير تجاوز الميزانية",
      value: daysToBudget > 0 ? `${daysToBudget} يومًا` : currentMonthExpenses >= state.budget ? "تمت تجاوز الميزانية" : "ضمن الميزانية",
      caption: currentMonthExpenses >= state.budget ? "معدل الإنفاق الحالي أعلى من الميزانية" : `إذا استمر المعدل الحالي، ستصل للميزانية خلال ${daysToBudget || "أقل من يوم"}`,
    },
  ];

  els.insightsGrid.innerHTML = insights
    .map(
      (item) => `
        <article class="insight-card">
          <p class="insight-label">${escapeHtml(item.title)}</p>
          <strong class="insight-value">${escapeHtml(item.value)}</strong>
          <p class="insight-caption">${escapeHtml(item.caption)}</p>
        </article>
      `
    )
    .join("");

  els.healthScore.textContent = `الصحة المالية: ${healthLabel}`;
  els.healthScore.className = `health-pill ${healthTone}`;
}

function populateCategoryOptions() {
  const currentCategory = els.transactionCategory.value;
  const options = state.categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
  els.transactionCategory.innerHTML = options;
  els.categoryFilter.innerHTML = `<option value="all">الكل</option>${options}`;
  if (state.categories.includes(currentCategory)) {
    els.transactionCategory.value = currentCategory;
  }
}

function populateFilters() {
  const months = new Set(state.transactions.map((tx) => tx.date.slice(0, 7)));
  const monthOptions = ['<option value="all">كل الأشهر</option>'];
  Array.from(months).sort().forEach((month) => {
    monthOptions.push(`<option value="${month}">${month}</option>`);
  });
  els.monthFilter.innerHTML = monthOptions.join("");
}

function getFilteredTransactions() {
  const term = els.searchInput.value.trim().toLowerCase();
  const type = els.typeFilter.value;
  const category = els.categoryFilter.value;
  const month = els.monthFilter.value;

  return state.transactions
    .filter((tx) => {
      const matchesTerm = [tx.category, tx.notes, tx.currency, tx.type, tx.amount.toString()].some((value) =>
        String(value).toLowerCase().includes(term)
      );
      const matchesType = type === "all" || tx.type === type;
      const matchesCategory = category === "all" || tx.category === category;
      const matchesMonth = month === "all" || tx.date.startsWith(month);
      return matchesTerm && matchesType && matchesCategory && matchesMonth;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions() {
  const filtered = getFilteredTransactions();

  if (!filtered.length) {
    els.transactionsTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            لا توجد عمليات بعد.
            <div>ابدأ بإضافة أول دخل أو مصروف.</div>
            <button type="button" class="primary-btn" data-empty-action="add">إضافة عملية</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  els.transactionsTableBody.innerHTML = filtered
    .map((tx) => {
      const typeLabel = tx.type === "income" ? "دخل" : "مصروف";
      const amountClass = tx.type === "income" ? "amount-income" : "amount-expense";
      const symbol = tx.type === "income" ? "+" : "-";
      return `
        <tr>
          <td>${escapeHtml(tx.date)}</td>
          <td><span class="badge ${tx.type === "income" ? "income" : "expense"}">${escapeHtml(typeLabel)}</span></td>
          <td>${escapeHtml(tx.category)}</td>
          <td class="${amountClass}">${symbol}${escapeHtml(formatAmount(tx.amount, tx.currency))}</td>
          <td>${escapeHtml(tx.notes || "—")}</td>
          <td>
            <button class="text-btn" data-action="edit" data-id="${escapeHtml(tx.id)}">تعديل</button>
            <button class="text-btn" data-action="delete" data-id="${escapeHtml(tx.id)}">حذف</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function handleTransactionTableClick(event) {
  const editButton = event.target.closest("[data-action='edit']");
  if (editButton) {
    editTransaction(editButton.getAttribute("data-id"));
    return;
  }

  const deleteButton = event.target.closest("[data-action='delete']");
  if (deleteButton) {
    deleteTransaction(deleteButton.getAttribute("data-id"));
    return;
  }

  const emptyButton = event.target.closest("[data-empty-action='add']");
  if (emptyButton) {
    openTransactionModal();
  }
}

function renderCategories() {
  els.categoriesList.innerHTML = state.categories
    .map(
      (category) => `
        <span class="category-pill">
          ${escapeHtml(category)}
          <button class="icon-btn" data-category="${escapeHtml(category)}" aria-label="حذف الفئة">✕</button>
        </span>
      `
    )
    .join("");
}

function handleCategoryListClick(event) {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  deleteCategory(button.getAttribute("data-category"));
}

function renderCharts() {
  const ctxIncomeExpense = document.getElementById("incomeExpenseChart");
  const ctxCategory = document.getElementById("categoryChart");
  const ctxMonthly = document.getElementById("monthlyChart");

  if (!ctxIncomeExpense || !ctxCategory || !ctxMonthly) return;
  if (typeof window.Chart === "undefined") {
    return;
  }

  const incomeSeries = buildIncomeExpenseSeries();
  const categorySeries = buildCategorySeries();
  const monthlySeries = buildMonthlySeries();

  if (charts.incomeExpense) charts.incomeExpense.destroy();
  if (charts.category) charts.category.destroy();
  if (charts.monthly) charts.monthly.destroy();

  charts.incomeExpense = new Chart(ctxIncomeExpense, {
    type: "bar",
    data: {
      labels: ["الدخل", "المصروف"],
      datasets: [
        {
          label: "المبلغ",
          data: [incomeSeries.income, incomeSeries.expense],
          backgroundColor: ["#16a34a", "#dc2626"],
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  charts.category = new Chart(ctxCategory, {
    type: "doughnut",
    data: {
      labels: categorySeries.labels.length ? categorySeries.labels : ["لا توجد بيانات"],
      datasets: [
        {
          data: categorySeries.labels.length ? categorySeries.values : [1],
          backgroundColor: ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0f766e", "#64748b"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });

  charts.monthly = new Chart(ctxMonthly, {
    type: "line",
    data: {
      labels: monthlySeries.labels,
      datasets: [
        {
          label: "المصروف",
          data: monthlySeries.expenses,
          borderColor: "#dc2626",
          backgroundColor: "rgba(220, 38, 38, 0.15)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function buildIncomeExpenseSeries() {
  const { income, expense } = getMetrics();
  return { income, expense };
}

function buildCategorySeries() {
  const expenses = state.transactions.filter((tx) => tx.type === "expense" && tx.currency === state.displayCurrency);
  const grouped = expenses.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
    return acc;
  }, {});

  return {
    labels: Object.keys(grouped),
    values: Object.values(grouped),
  };
}

function buildMonthlySeries() {
  const now = new Date();
  const labels = [];
  const expenses = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    labels.push(key);
    const amount = state.transactions
      .filter((tx) => tx.type === "expense" && tx.currency === state.displayCurrency && tx.date.startsWith(key))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    expenses.push(amount);
  }
  return { labels, expenses };
}

function openTransactionModal(transaction = null) {
  els.transactionForm.reset();
  els.transactionId.value = "";
  els.transactionType.value = "expense";
  els.transactionCurrency.value = state.displayCurrency;
  els.transactionDate.value = new Date().toISOString().slice(0, 10);
  els.modalTitle.textContent = "إضافة عملية";

  if (transaction) {
    els.transactionId.value = transaction.id;
    els.transactionType.value = transaction.type;
    els.transactionAmount.value = transaction.amount;
    els.transactionCurrency.value = transaction.currency;
    els.transactionCategory.value = transaction.category;
    els.transactionDate.value = transaction.date;
    els.transactionNotes.value = transaction.notes || "";
    els.modalTitle.textContent = "تعديل عملية";
  }

  els.transactionModal.classList.remove("hidden");
  els.transactionModal.setAttribute("aria-hidden", "false");
  els.transactionAmount.focus();
}

function closeTransactionModal() {
  els.transactionModal.classList.add("hidden");
  els.transactionModal.setAttribute("aria-hidden", "true");
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  const payload = {
    id: els.transactionId.value || crypto.randomUUID(),
    type: els.transactionType.value,
    amount: Number(els.transactionAmount.value),
    currency: els.transactionCurrency.value,
    category: els.transactionCategory.value,
    date: els.transactionDate.value,
    notes: els.transactionNotes.value.trim(),
  };

  if (!payload.amount || !payload.category || !payload.date) return;

  if (els.transactionId.value) {
    state.transactions = state.transactions.map((tx) => (tx.id === payload.id ? payload : tx));
  } else {
    state.transactions.unshift(payload);
  }

  saveState();
  render({ refreshCharts: true });
  closeTransactionModal();
}

function editTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (transaction) openTransactionModal(transaction);
}

function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  undoState = transaction;
  saveState();
  render({ refreshCharts: true });
  showToast("تم حذف العملية", "تراجع", undoLastDelete);
}

function undoLastDelete() {
  if (!undoState) return;
  state.transactions.unshift(undoState);
  undoState = null;
  saveState();
  render({ refreshCharts: true });
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const value = els.newCategoryInput.value.trim();
  if (!value) return;
  if (!state.categories.includes(value)) {
    state.categories.push(value);
    saveState();
    render({ refreshCharts: true });
  }
  els.newCategoryInput.value = "";
}

function deleteCategory(categoryName) {
  if (categoryName === "أخرى" || state.categories.length <= 1) {
    showToast("لا يمكن حذف هذه الفئة الافتراضية.");
    return;
  }
  state.categories = state.categories.filter((name) => name !== categoryName);
  state.transactions = state.transactions.map((tx) => ({ ...tx, category: tx.category === categoryName ? "أخرى" : tx.category }));
  saveState();
  render({ refreshCharts: true });
}

function editBudget() {
  showPrompt("أدخل ميزانيتك الشهرية الجديدة", String(state.budget), (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast("القيمة غير صحيحة.");
      return;
    }
    state.budget = parsed;
    saveState();
    render({ refreshCharts: true });
  });
}

function resetAllData() {
  state = createInitialState();
  state.theme = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
  saveState();
  populateCurrencySelect();
  render({ refreshCharts: true });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, "budget-backup.json");
}

function csvEscape(value) {
  const escaped = String(value).replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function exportCsv() {
  const rows = ["date,type,category,amount,currency,notes"];
  state.transactions.forEach((tx) => {
    rows.push([
      csvEscape(tx.date),
      csvEscape(tx.type),
      csvEscape(tx.category),
      csvEscape(tx.amount),
      csvEscape(tx.currency),
      csvEscape(tx.notes || ""),
    ].join(","));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, "budget-export.csv");
}

function importJsonFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.transactions)) throw new Error("Invalid backup file");
      state = normalizeState(imported);
      saveState();
      populateCurrencySelect();
      render({ refreshCharts: true });
      showToast("تم استيراد البيانات بنجاح.");
    } catch (error) {
      showToast("تعذر استيراد الملف. تأكد من أنه نسخة احتياطية صحيحة.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function showToast(message, actionLabel = "", onAction = null) {
  if (!els.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  if (actionLabel && onAction) {
    const button = document.createElement("button");
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      onAction();
      toast.remove();
    });
    toast.appendChild(button);
  }
  els.toastContainer.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function showConfirm(message, onConfirm) {
  const backdrop = document.createElement("div");
  backdrop.className = "dialog-backdrop";
  backdrop.innerHTML = `
    <div class="dialog-card">
      <h3>تأكيد</h3>
      <p>${escapeHtml(message)}</p>
      <div class="dialog-actions">
        <button type="button" class="secondary-btn" data-action="cancel">إلغاء</button>
        <button type="button" class="danger-btn" data-action="confirm">تأكيد</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector("[data-action='cancel']").addEventListener("click", () => backdrop.remove());
  backdrop.querySelector("[data-action='confirm']").addEventListener("click", () => {
    backdrop.remove();
    onConfirm();
  });
}

function showPrompt(message, defaultValue, onSubmit) {
  const backdrop = document.createElement("div");
  backdrop.className = "dialog-backdrop";
  backdrop.innerHTML = `
    <div class="dialog-card">
      <h3>إدخال</h3>
      <p>${escapeHtml(message)}</p>
      <input type="number" value="${escapeHtml(defaultValue)}" />
      <div class="dialog-actions">
        <button type="button" class="secondary-btn" data-action="cancel">إلغاء</button>
        <button type="button" class="primary-btn" data-action="confirm">حفظ</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const input = backdrop.querySelector("input");
  input.focus();
  backdrop.querySelector("[data-action='cancel']").addEventListener("click", () => backdrop.remove());
  backdrop.querySelector("[data-action='confirm']").addEventListener("click", () => {
    backdrop.remove();
    onSubmit(input.value);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleKeyboardShortcuts(event) {
  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    openTransactionModal();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAmount(amount, currency) {
  const formatter = new Intl.NumberFormat(document.documentElement.lang || "ar-EG", {
    maximumFractionDigits: 0,
  });
  const value = formatter.format(Number(amount || 0));
  const symbols = {
    DZD: "د.ج",
    USD: "$",
    EUR: "€",
    SAR: "ر.س",
    AED: "د.إ",
    QAR: "ر.ق",
    GBP: "£",
  };
  return `${value} ${symbols[currency] || currency}`;
}

initializeApp();
