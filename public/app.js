const state = {
  overview: null,
  selectedPlanId: null,
  socket: null,
  supportThread: null,
  currentUser: null,
  activeAuthTab: "register",
  priceSeries: {
    BTC: [],
  },
};

const dom = {
  heroHashrate: document.querySelector("#heroHashrate"),
  heroMiners: document.querySelector("#heroMiners"),
  heroDaily: document.querySelector("#heroDaily"),
  marketTicker: document.querySelector("#marketTicker"),
  roadmapGrid: document.querySelector("#roadmapGrid"),
  trustPoints: document.querySelector("#trustPoints"),
  plansGrid: document.querySelector("#plansGrid"),
  marketGrid: document.querySelector("#marketGrid"),
  hardwareGrid: document.querySelector("#hardwareGrid"),
  customerCareCard: document.querySelector("#customerCareCard"),
  companyCard: document.querySelector("#companyCard"),
  disclosureList: document.querySelector("#disclosureList"),
  legalNote: document.querySelector("#legalNote"),
  faqList: document.querySelector("#faqList"),
  heroChart: document.querySelector("#heroChart"),
  consoleRefresh: document.querySelector("#consoleRefresh"),
  planSelect: document.querySelector("#planSelect"),
  coinSelect: document.querySelector("#coinSelect"),
  electricityInput: document.querySelector("#electricityInput"),
  electricityValue: document.querySelector("#electricityValue"),
  termInput: document.querySelector("#termInput"),
  termValue: document.querySelector("#termValue"),
  calculatorForm: document.querySelector("#calculatorForm"),
  estimateOutput: document.querySelector("#estimateOutput"),
  authModal: document.querySelector("#authModal"),
  authClose: document.querySelector("#authClose"),
  authStatus: document.querySelector("#authStatus"),
  registerForm: document.querySelector("#registerForm"),
  loginForm: document.querySelector("#loginForm"),
  verifyForm: document.querySelector("#verifyForm"),
  supportToggle: document.querySelector("#supportToggle"),
  supportPanel: document.querySelector("#supportPanel"),
  supportClose: document.querySelector("#supportClose"),
  supportFeed: document.querySelector("#supportFeed"),
  supportContactList: document.querySelector("#supportContactList"),
  supportForm: document.querySelector("#supportForm"),
  supportInput: document.querySelector("#supportInput"),
};

init();

async function init() {
  bindEvents();
  await loadOverview();
  await hydrateSession();
  connectSocket();
  updateSliderLabels();
}

function bindEvents() {
  document.querySelectorAll("[data-open-auth]").forEach((button) => {
    button.addEventListener("click", () => openAuth(button.dataset.openAuth));
  });

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
  });

  dom.authClose.addEventListener("click", closeAuth);
  dom.supportToggle.addEventListener("click", () => {
    const hidden = dom.supportPanel.getAttribute("aria-hidden") === "true";
    dom.supportPanel.setAttribute("aria-hidden", String(!hidden));
  });
  dom.supportClose.addEventListener("click", () => dom.supportPanel.setAttribute("aria-hidden", "true"));

  dom.registerForm.addEventListener("submit", handleRegister);
  dom.loginForm.addEventListener("submit", handleLogin);
  dom.verifyForm.addEventListener("submit", handleVerify);
  dom.calculatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateEstimate();
  });
  dom.supportForm.addEventListener("submit", handleSupportMessage);

  [dom.electricityInput, dom.termInput].forEach((input) =>
    input.addEventListener("input", () => {
      updateSliderLabels();
      updateEstimate();
    })
  );
  dom.planSelect.addEventListener("change", () => {
    populateCoinOptions();
    updateEstimate();
  });
  dom.coinSelect.addEventListener("change", updateEstimate);
}

async function loadOverview() {
  try {
    state.overview = await Northstar.api("/api/public/overview");
    renderOverview();
    populatePlanControls();
    updateEstimate();
  } catch (error) {
    dom.authStatus.textContent = error.message;
  }
}

async function hydrateSession() {
  if (!Northstar.getToken()) {
    updateSupportState(false);
    return;
  }

  try {
    const session = await Northstar.api("/api/auth/session");
    state.currentUser = session.user;
    if (session.user.role === "admin") {
      window.location.href = "/admin";
      return;
    }
    updateSupportState(true, session.user);
  } catch {
    Northstar.clearToken();
    updateSupportState(false);
  }
}

function renderOverview() {
  const { heroStats, roadmap, trustPoints, plans, market, hardware, faqs, company, disclosures, transparency } = state.overview;

  dom.heroHashrate.textContent = heroStats.totalHashrateLabel;
  dom.heroMiners.textContent = Northstar.formatNumber(heroStats.activeMiners, 0);
  dom.heroDaily.textContent = heroStats.dailyEstimateLabel;
  dom.consoleRefresh.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  dom.roadmapGrid.innerHTML = roadmap
    .map(
      (item) => `
        <article>
          <h3>${item.title}</h3>
          <p>${item.detail}</p>
        </article>
      `
    )
    .join("");

  dom.trustPoints.innerHTML = trustPoints.map((item) => `<div>${item}</div>`).join("");
  dom.plansGrid.innerHTML = plans.map(renderPlanCard).join("");
  dom.marketGrid.innerHTML = Object.values(market).map(renderMarketCard).join("");
  dom.hardwareGrid.innerHTML = hardware.map(renderHardwareCard).join("");
  dom.disclosureList.innerHTML = disclosures.map((item) => `<li>${item}</li>`).join("");
  dom.legalNote.textContent = transparency.legal;
  dom.customerCareCard.innerHTML = `
    <p class="eyebrow">Customer care</p>
    <h3>Talk to support before you fund.</h3>
    <p>Reach the Northstar customer desk for onboarding help, payment confirmation, or account questions.</p>
    <div class="contact-stack">
      <a class="sales-contact inline" href="${company.whatsappUrl}" target="_blank" rel="noreferrer">WhatsApp: ${company.whatsappNumber}</a>
      <a class="sales-contact inline" href="${company.customerEmailUrl}">Email: ${company.customerEmail}</a>
    </div>
  `;
  dom.companyCard.className = "disclosure-card";
  dom.companyCard.innerHTML = `
    <h3>Company information</h3>
    <p>${company.trustCopy}</p>
    <div class="metric-list">
      <div><span>Founded</span><strong>${company.founded}</strong></div>
      <div><span>Headquarters</span><strong>${company.headquarters}</strong></div>
      <div><span>Facilities</span><strong>${company.operations.join(" • ")}</strong></div>
      <div><span>Support coverage</span><strong>${company.supportCoverage}</strong></div>
      <div><span>WhatsApp care</span><strong><a class="contact-link" href="${company.whatsappUrl}" target="_blank" rel="noreferrer">${company.whatsappNumber}</a></strong></div>
      <div><span>Customer email</span><strong><a class="contact-link" href="${company.customerEmailUrl}">${company.customerEmail}</a></strong></div>
    </div>
  `;
  dom.supportContactList.innerHTML = `
    <a class="sales-contact inline" href="${company.whatsappUrl}" target="_blank" rel="noreferrer">WhatsApp customer care: ${company.whatsappNumber}</a>
    <a class="sales-contact inline" href="${company.customerEmailUrl}">Customer email: ${company.customerEmail}</a>
  `;
  dom.faqList.innerHTML = faqs
    .map(
      (faq) => `
        <details class="faq-item">
          <summary>${faq.question}</summary>
          <p>${faq.answer}</p>
        </details>
      `
    )
    .join("");

  Object.values(market).forEach((coin) => pushSeries(coin.symbol, coin.priceUsd));
  renderMarketTicker();
  drawHeroChart();
}

function renderPlanCard(plan) {
  const estimate = plan.estimates[0];
  return `
    <article class="plan-card">
      <img src="${plan.image}" alt="${plan.name} mining hardware photo" loading="lazy" />
      <div>
        <p class="eyebrow">${plan.algorithm}</p>
        <h3>${plan.name}</h3>
        <p>${plan.description}</p>
      </div>
      <div class="meta-list">
        <div class="meta-row"><span>Starts from</span><strong>${Northstar.formatCurrency(plan.startingPriceUsd)}</strong></div>
        <div class="meta-row"><span>Hashrate</span><strong>${plan.hashrateLabel}</strong></div>
        <div class="meta-row"><span>Power draw</span><strong>${plan.powerLabel}</strong></div>
        <div class="meta-row"><span>Efficiency</span><strong>${plan.efficiencyLabel}</strong></div>
        <div class="meta-row"><span>Payment method</span><strong>USD | BTC | USDC | USDT</strong></div>
        <div class="meta-row"><span>Est. daily net</span><strong>${Northstar.formatCurrency(estimate.netDailyUsd)}</strong></div>
        <div class="meta-row"><span>Optimization factor</span><strong>+${estimate.optimizationFactorPct}%</strong></div>
        <div class="meta-row"><span>Electricity assumption</span><strong>$0.08/kWh</strong></div>
        <div class="meta-row"><span>Deployment window</span><strong>${plan.deploymentWindowDays} business days</strong></div>
      </div>
      <button class="secondary-button wide" type="button" data-plan-pick="${plan.id}">View earnings assumptions</button>
    </article>
  `;
}

function renderMarketCard(coin) {
  return `
    <article class="market-card">
      <div class="market-stat">
        <div>
          <p class="eyebrow">${coin.algorithm}</p>
          <h3>${coin.name}</h3>
        </div>
        <strong class="${Northstar.signedClass(coin.priceChange24hPct)}">${Northstar.formatPercent(coin.priceChange24hPct)}</strong>
      </div>
      <div class="metric-list">
        <div><span>Spot price</span><strong>${Northstar.formatCurrency(coin.priceUsd)}</strong></div>
        <div><span>Network hashrate</span><strong>${coin.networkHashrateLabel}</strong></div>
        <div><span>Difficulty</span><strong>${Northstar.formatNumber(coin.difficulty, 2)}</strong></div>
      </div>
    </article>
  `;
}

function renderHardwareCard(item) {
  return `
    <article class="hardware-card">
      <img src="${item.image}" alt="${item.name} hardware photo" loading="lazy" />
      <div>
        <p class="eyebrow">${item.algorithm}</p>
        <h3>${item.name}</h3>
        <p>${item.summary}</p>
      </div>
      <div class="metric-list">
        <div><span>Hashrate</span><strong>${item.hashrateLabel}</strong></div>
        <div><span>Power draw</span><strong>${item.powerLabel}</strong></div>
        <div><span>Efficiency</span><strong>${item.efficiencyLabel}</strong></div>
        <div><span>Price</span><strong>${Northstar.formatCurrency(item.priceUsd)}</strong></div>
      </div>
    </article>
  `;
}

function populatePlanControls() {
  const plans = state.overview.plans;
  dom.planSelect.innerHTML = plans.map((plan) => `<option value="${plan.id}">${plan.name}</option>`).join("");
  state.selectedPlanId = state.selectedPlanId || plans[0].id;
  dom.planSelect.value = state.selectedPlanId;
  populateCoinOptions();

  document.querySelectorAll("[data-plan-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      dom.planSelect.value = button.dataset.planPick;
      state.selectedPlanId = button.dataset.planPick;
      populateCoinOptions();
      updateEstimate();
      document.querySelector("#calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function populateCoinOptions() {
  state.selectedPlanId = dom.planSelect.value;
  const plan = state.overview.plans.find((entry) => entry.id === state.selectedPlanId);
  dom.coinSelect.innerHTML = plan.supportedCoins.map((coin) => `<option value="${coin}">${coin}</option>`).join("");
}

async function updateEstimate() {
  try {
    const payload = await Northstar.api("/api/public/calculate", {
      method: "POST",
      body: {
        planId: dom.planSelect.value,
        coin: dom.coinSelect.value,
        electricityRate: Number(dom.electricityInput.value),
        termMonths: Number(dom.termInput.value),
      },
    });
    renderEstimate(payload.estimate);
  } catch (error) {
    dom.estimateOutput.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderEstimate(estimate) {
  dom.estimateOutput.innerHTML = `
    <div class="estimate-summary">
      <div>
        <p class="eyebrow">${estimate.coinName}</p>
        <h3>${Northstar.formatCurrency(estimate.netDailyUsd)} daily net estimate</h3>
        <p>${estimate.disclaimer}</p>
      </div>
      <div class="estimate-kpis">
        <article><span>Starter plan</span><strong>${Northstar.formatCurrency(estimate.startingPriceUsd)}</strong></article>
        <article><span>Gross / day</span><strong>${Northstar.formatCurrency(estimate.grossDailyUsd)}</strong></article>
        <article><span>Energy / day</span><strong>${Northstar.formatCurrency(estimate.energyDailyUsd)}</strong></article>
        <article><span>Low case / day</span><strong>${Northstar.formatCurrency(estimate.lowCaseUsd)}</strong></article>
        <article><span>High case / day</span><strong>${Northstar.formatCurrency(estimate.highCaseUsd)}</strong></article>
        <article><span>Monthly estimate</span><strong>${Northstar.formatCurrency(estimate.netMonthlyUsd)}</strong></article>
        <article><span>Indicative ROI</span><strong>${estimate.roiMonths ? `${estimate.roiMonths} mo` : "N/A"}</strong></article>
      </div>
      <div class="metric-list">
        <div><span>Network hashrate</span><strong>${estimate.networkHashrateLabel}</strong></div>
        <div><span>Electricity</span><strong>$${estimate.electricityRate.toFixed(3)}/kWh</strong></div>
        <div><span>Hosting fee</span><strong>${Northstar.formatCurrency(estimate.hostingFeeDailyUsd)}</strong></div>
        <div><span>Optimization factor</span><strong>+${estimate.optimizationFactorPct}% current fleet uplift</strong></div>
      </div>
      <div class="estimate-note">
        <strong>Payment Method: USD | BTC | USDC | USDT</strong>
        <p>Miner prices can move quickly. Verify the latest quote with our sales team before sending payment.</p>
        <a class="sales-contact inline" href="mailto:frankiebreeuwsma@myself.com">frankiebreeuwsma@myself.com</a>
      </div>
    </div>
  `;
}

function updateSliderLabels() {
  dom.electricityValue.textContent = `$${Number(dom.electricityInput.value).toFixed(3)}`;
  dom.termValue.textContent = `${dom.termInput.value} months`;
}

function openAuth(tab) {
  setAuthTab(tab || "register");
  dom.authModal.classList.remove("hidden");
  dom.authModal.setAttribute("aria-hidden", "false");
}

function closeAuth() {
  dom.authModal.classList.add("hidden");
  dom.authModal.setAttribute("aria-hidden", "true");
}

function setAuthTab(tab) {
  state.activeAuthTab = tab;
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === tab);
  });
  dom.registerForm.classList.toggle("hidden", tab !== "register");
  dom.loginForm.classList.toggle("hidden", tab !== "login");
  dom.verifyForm.classList.toggle("hidden", tab !== "verify");
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const response = await Northstar.api("/api/auth/register", {
      method: "POST",
      body: {
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        password: formData.get("password"),
        demoMode: formData.get("demoMode") === "on",
      },
    });
    dom.authStatus.textContent = `Account created. Verification preview code: ${response.previewCode}`;
    dom.verifyForm.elements.email.value = formData.get("email");
    setAuthTab("verify");
  } catch (error) {
    dom.authStatus.textContent = error.message;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const response = await Northstar.api("/api/auth/login", {
      method: "POST",
      body: {
        email: formData.get("email"),
        password: formData.get("password"),
        code: formData.get("code"),
      },
    });
    Northstar.setToken(response.token);
    dom.authStatus.textContent = "Login successful. Redirecting to your dashboard...";
    closeAuth();
    if (response.user.role === "admin") {
      window.location.href = "/admin";
      return;
    }
    window.location.href = "/dashboard";
  } catch (error) {
    dom.authStatus.textContent = error.message;
    if (error.message.toLowerCase().includes("verify")) {
      setAuthTab("verify");
    }
  }
}

async function handleVerify(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    await Northstar.api("/api/auth/verify-email", {
      method: "POST",
      body: {
        email: formData.get("email"),
        code: formData.get("code"),
      },
    });
    dom.authStatus.textContent = "Email verified. You can now log in.";
    dom.loginForm.elements.email.value = formData.get("email");
    setAuthTab("login");
  } catch (error) {
    dom.authStatus.textContent = error.message;
  }
}

function updateSupportState(isAuthenticated, user = null) {
  if (user) {
    state.currentUser = user;
  }
  dom.supportInput.disabled = !isAuthenticated;
  dom.supportForm.querySelector("button").disabled = !isAuthenticated;
  if (!isAuthenticated) {
    dom.supportInput.placeholder = "Login or register to start live support.";
    state.currentUser = null;
    return;
  }
  dom.supportInput.placeholder = `Chat as ${state.currentUser?.fullName || "your account"}`;
}

async function handleSupportMessage(event) {
  event.preventDefault();
  const body = dom.supportInput.value.trim();
  if (!body || !state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }
  state.socket.send(JSON.stringify({ type: "supportMessage", body }));
  dom.supportInput.value = "";
}

function connectSocket() {
  state.socket = Northstar.connectSocket((message, socket) => {
    if (message.type === "marketSnapshot") {
      state.overview = message.data;
      renderOverview();
      populatePlanControls();
      updateEstimate();
    }
    if (message.type === "supportThread") {
      state.supportThread = message.data;
      renderSupportThread();
    }
    if (message.type === "welcome" && message.viewer?.role === "user") {
      updateSupportState(true, message.viewer);
    }
    state.socket = socket;
  });
}

function renderSupportThread() {
  if (!state.supportThread) {
    return;
  }
  dom.supportFeed.innerHTML = state.supportThread.messages
    .map(
      (message) => `
        <article class="support-message ${message.role}">
          <strong>${message.senderName}</strong>
          <p>${message.body}</p>
          <small>${Northstar.formatDate(message.createdAt)}</small>
        </article>
      `
    )
    .join("");
}

function renderMarketTicker() {
  const items = Object.values(state.overview.market)
    .map(
      (coin) => `
        <article>
          <strong>${coin.symbol}</strong>
          <div>${Northstar.formatCurrency(coin.priceUsd)}</div>
          <small class="${Northstar.signedClass(coin.priceChange24hPct)}">${Northstar.formatPercent(coin.priceChange24hPct)}</small>
        </article>
      `
    )
    .join("");
  dom.marketTicker.innerHTML = items;
}

function pushSeries(symbol, price) {
  if (!state.priceSeries[symbol]) {
    state.priceSeries[symbol] = [];
  }
  const series = state.priceSeries[symbol];
  series.push(price);
  if (series.length > 20) {
    series.shift();
  }
}

function drawHeroChart() {
  const canvas = dom.heroChart;
  const context = canvas.getContext("2d");
  const values = state.priceSeries.BTC || [];
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!values.length) {
    return;
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(116, 230, 245, 0.35)");
  gradient.addColorStop(1, "rgba(116, 230, 245, 0)");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 26;
  const xStep = (canvas.width - pad * 2) / Math.max(values.length - 1, 1);

  context.beginPath();
  values.forEach((value, index) => {
    const x = pad + index * xStep;
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const y = canvas.height - pad - ratio * (canvas.height - pad * 2);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.lineWidth = 3;
  context.strokeStyle = "#74e6f5";
  context.stroke();

  context.lineTo(canvas.width - pad, canvas.height - pad);
  context.lineTo(pad, canvas.height - pad);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
}
