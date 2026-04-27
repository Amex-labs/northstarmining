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
  siteTopbar: document.querySelector("#siteTopbar"),
  topbarPanel: document.querySelector("#topbarPanel"),
  menuToggle: document.querySelector("#menuToggle"),
  heroHashrate: document.querySelector("#heroHashrate"),
  heroMiners: document.querySelector("#heroMiners"),
  heroDaily: document.querySelector("#heroDaily"),
  marketTicker: document.querySelector("#marketTicker"),
  roadmapGrid: document.querySelector("#roadmapGrid"),
  trustPoints: document.querySelector("#trustPoints"),
  bonusOffer: document.querySelector("#bonusOffer"),
  plansGrid: document.querySelector("#plansGrid"),
  marketGrid: document.querySelector("#marketGrid"),
  hardwareGrid: document.querySelector("#hardwareGrid"),
  customerCareCard: document.querySelector("#customerCareCard"),
  companyCard: document.querySelector("#companyCard"),
  disclosureList: document.querySelector("#disclosureList"),
  legalNote: document.querySelector("#legalNote"),
  faqList: document.querySelector("#faqList"),
  heroChart: document.querySelector("#heroChart"),
  heroChartPrice: document.querySelector("#heroChartPrice"),
  heroChartChange: document.querySelector("#heroChartChange"),
  heroChartRange: document.querySelector("#heroChartRange"),
  heroChartStatus: document.querySelector("#heroChartStatus"),
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
  resendVerification: document.querySelector("#resendVerification"),
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
  syncViewportHeight();
  bindEvents();
  syncResponsiveChrome();
  await loadOverview();
  await hydrateSession();
  connectSocket();
  updateSliderLabels();
}

function bindEvents() {
  document.querySelectorAll("[data-open-auth]").forEach((button) => {
    button.addEventListener("click", () => {
      closeMobileMenu();
      openAuth(button.dataset.openAuth);
    });
  });

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
  });

  document.querySelectorAll(".topnav a").forEach((link) => {
    link.addEventListener("click", () => closeMobileMenu());
  });

  dom.authModal.addEventListener("focusin", handleAuthFieldFocus);
  dom.authClose.addEventListener("click", closeAuth);
  dom.menuToggle?.addEventListener("click", () => toggleMobileMenu());
  dom.supportToggle.addEventListener("click", () => {
    const hidden = dom.supportPanel.getAttribute("aria-hidden") === "true";
    dom.supportPanel.setAttribute("aria-hidden", String(!hidden));
  });
  dom.supportClose.addEventListener("click", () => dom.supportPanel.setAttribute("aria-hidden", "true"));
  bindPasswordToggles();

  dom.registerForm.addEventListener("submit", handleRegister);
  dom.loginForm.addEventListener("submit", handleLogin);
  dom.verifyForm.addEventListener("submit", handleVerifyEmail);
  dom.resendVerification.addEventListener("click", handleResendVerification);
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
  window.addEventListener("resize", () => {
    syncViewportHeight();
    syncResponsiveChrome();
    if (state.overview) {
      drawHeroChart();
    }
  });
  window.visualViewport?.addEventListener("resize", syncViewportHeight);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });
  document.addEventListener("click", (event) => {
    if (!dom.siteTopbar?.classList.contains("menu-open")) {
      return;
    }
    if (window.innerWidth > 720) {
      return;
    }
    if (dom.siteTopbar.contains(event.target)) {
      return;
    }
    closeMobileMenu();
  });
}

function syncViewportHeight() {
  const height = Math.round(window.visualViewport?.height || window.innerHeight);
  document.documentElement.style.setProperty("--viewport-height", `${height}px`);
}

function handleAuthFieldFocus(event) {
  if (window.innerWidth > 720) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select")) {
    return;
  }

  window.setTimeout(() => {
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, 180);
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    syncPasswordToggle(button);
    button.addEventListener("click", () => {
      const input = document.querySelector(button.dataset.passwordToggle);
      if (!input) {
        return;
      }
      input.type = input.type === "password" ? "text" : "password";
      syncPasswordToggle(button);
      input.focus({ preventScroll: true });
    });
  });
}

function syncPasswordToggle(button) {
  const input = document.querySelector(button.dataset.passwordToggle);
  if (!input) {
    return;
  }
  const isVisible = input.type === "text";
  button.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
  button.setAttribute("aria-pressed", String(isVisible));
  const hiddenIcon = button.querySelector(".icon-hidden");
  const visibleIcon = button.querySelector(".icon-visible");
  if (hiddenIcon) {
    hiddenIcon.hidden = isVisible;
  }
  if (visibleIcon) {
    visibleIcon.hidden = !isVisible;
  }
}

function toggleMobileMenu(forceOpen) {
  if (!dom.siteTopbar || !dom.menuToggle) {
    return;
  }
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !dom.siteTopbar.classList.contains("menu-open");
  dom.siteTopbar.classList.toggle("menu-open", shouldOpen);
  dom.menuToggle.setAttribute("aria-expanded", String(shouldOpen));
  dom.menuToggle.setAttribute("aria-label", shouldOpen ? "Close navigation" : "Open navigation");
}

function closeMobileMenu() {
  toggleMobileMenu(false);
}

function syncResponsiveChrome() {
  if (window.innerWidth > 720) {
    closeMobileMenu();
  }
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
  dom.bonusOffer.innerHTML = renderBonusOffer(plans);
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
  const actionLabel = plan.paymentUrl ? "Pay now" : "Review estimate";
  const actionMarkup = plan.paymentUrl
    ? `<a class="primary-button wide plan-action" href="${plan.paymentUrl}" target="_blank" rel="noreferrer">Pay now</a>`
    : `<button class="secondary-button wide plan-action" type="button" data-plan-pick="${plan.id}">Review estimate</button>`;
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
      ${actionMarkup}
      <p class="plan-footnote">${actionLabel === "Pay now" ? "Complete payment securely through our partner checkout and keep your support desk available for confirmation." : "Open the calculator to compare how live market inputs can affect this machine."}</p>
    </article>
  `;
}

function renderBonusOffer(plans) {
  const items = plans
    .map(
      (plan) => `
        <article class="bonus-plan-item">
          <strong>${plan.name}</strong>
          <span>${Northstar.formatCurrency(plan.startingPriceUsd)} plan</span>
          <p>Up to ${Northstar.formatCurrency(plan.featuredDailyUsd)} daily (${Northstar.formatCurrency(plan.featuredMonthlyUsd)}/month)</p>
        </article>
      `
    )
    .join("");

  return `
    <div class="bonus-offer-copy">
      <p class="eyebrow">Welcome bonus</p>
      <h3>Open your account with a $500 welcome balance and pick the plan that fits your pace.</h3>
      <p>
        With Northstar Mining, new registrations receive a $500 welcome bonus, and active users can earn daily based on their selected plan.
      </p>
    </div>
    <div class="bonus-plan-grid">
      ${items}
    </div>
    <div class="bonus-offer-notes">
      <p>Designed as a side income stream, not a full-time job replacement. Start at your own pace and scale as you get comfortable.</p>
      <p>The $500 welcome bonus is available for withdrawal once you are an active subscriber on the platform.</p>
    </div>
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
  state.activeAuthTab = ["register", "login", "verify"].includes(tab) ? tab : "register";
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === state.activeAuthTab);
  });
  dom.registerForm.classList.toggle("hidden", state.activeAuthTab !== "register");
  dom.loginForm.classList.toggle("hidden", state.activeAuthTab !== "login");
  dom.verifyForm.classList.toggle("hidden", state.activeAuthTab !== "verify");
}

function fillAuthEmail(email) {
  const normalized = String(email || "").trim();
  if (!normalized) {
    return;
  }
  ["#registerEmail", "#loginEmail", "#verifyEmail"].forEach((selector) => {
    const input = document.querySelector(selector);
    if (input) {
      input.value = normalized;
    }
  });
}

function redirectAfterAuth(user) {
  window.location.href = user.role === "admin" ? "/admin" : "/dashboard";
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
    event.currentTarget.reset();
    fillAuthEmail(response.email || formData.get("email"));
    setAuthTab("verify");
    dom.authStatus.textContent = response.message || "We sent a verification code to your email. Enter it to finish activating your account.";
    document.querySelector("#verifyCode")?.focus();
  } catch (error) {
    if (error.requiresVerification) {
      fillAuthEmail(error.email || formData.get("email"));
      setAuthTab("verify");
    }
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
    redirectAfterAuth(response.user);
  } catch (error) {
    if (error.requiresVerification) {
      fillAuthEmail(error.email || formData.get("email"));
      setAuthTab("verify");
    }
    dom.authStatus.textContent = error.message;
  }
}

async function handleVerifyEmail(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const response = await Northstar.api("/api/auth/verify-email", {
      method: "POST",
      body: {
        email: formData.get("email"),
        code: formData.get("code"),
      },
    });
    Northstar.setToken(response.token);
    dom.authStatus.textContent = response.message || "Email verified. Redirecting to your dashboard...";
    closeAuth();
    redirectAfterAuth(response.user);
  } catch (error) {
    dom.authStatus.textContent = error.message;
  }
}

async function handleResendVerification() {
  const verifyEmail = document.querySelector("#verifyEmail")?.value?.trim() || document.querySelector("#loginEmail")?.value?.trim();
  if (!verifyEmail) {
    dom.authStatus.textContent = "Enter your email first so we know where to send the new code.";
    setAuthTab("verify");
    document.querySelector("#verifyEmail")?.focus();
    return;
  }

  try {
    const response = await Northstar.api("/api/auth/resend-verification", {
      method: "POST",
      body: {
        email: verifyEmail,
      },
    });
    fillAuthEmail(response.email || verifyEmail);
    setAuthTab("verify");
    dom.authStatus.textContent = response.message || "A fresh verification code is on the way to your inbox.";
    document.querySelector("#verifyCode")?.focus();
  } catch (error) {
    if (error.requiresVerification) {
      fillAuthEmail(error.email || verifyEmail);
      setAuthTab("verify");
    }
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
  const btc = state.overview?.market?.BTC;
  if (!canvas || !btc) {
    return;
  }

  syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  const values = buildRenderableSeries("BTC", btc.priceUsd, btc.priceChange24hPct);
  const candles = buildCandles(values);
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!candles.length) {
    return;
  }

  const plot = {
    left: 18,
    right: canvas.width - 70,
    top: 16,
    bottom: canvas.height - 26,
  };
  const volumeTop = canvas.height - 54;
  const min = Math.min(...candles.map((candle) => candle.low));
  const max = Math.max(...candles.map((candle) => candle.high));
  const volumeMax = Math.max(...candles.map((candle) => candle.volume));
  const xStep = (plot.right - plot.left) / candles.length;
  const candleWidth = Math.max(xStep * 0.58, 8);
  const labelValues = Array.from({ length: 4 }, (_, index) => max - ((max - min) / 3) * index);

  const backdrop = context.createLinearGradient(0, plot.top, 0, plot.bottom);
  backdrop.addColorStop(0, "rgba(116, 230, 245, 0.05)");
  backdrop.addColorStop(1, "rgba(8, 16, 28, 0)");
  context.fillStyle = backdrop;
  context.fillRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);

  context.lineWidth = 1;
  context.strokeStyle = "rgba(255,255,255,0.06)";
  context.setLineDash([5, 6]);
  labelValues.forEach((value) => {
    const y = mapRange(value, min, max, plot.bottom, plot.top);
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(plot.right, y);
    context.stroke();
    context.fillStyle = "rgba(197, 214, 235, 0.72)";
    context.font = "12px Plus Jakarta Sans";
    context.textAlign = "left";
    context.fillText(shortCurrency(value), plot.right + 12, y + 4);
  });
  context.setLineDash([]);

  candles.forEach((candle, index) => {
    const centerX = plot.left + xStep * index + xStep / 2;
    const openY = mapRange(candle.open, min, max, plot.bottom, plot.top);
    const closeY = mapRange(candle.close, min, max, plot.bottom, plot.top);
    const highY = mapRange(candle.high, min, max, plot.bottom, plot.top);
    const lowY = mapRange(candle.low, min, max, plot.bottom, plot.top);
    const rising = candle.close >= candle.open;
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 3);
    const candleColor = rising ? "#74e6f5" : "#f4b25d";

    context.strokeStyle = candleColor;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(centerX, highY);
    context.lineTo(centerX, lowY);
    context.stroke();

    context.fillStyle = candleColor;
    context.fillRect(centerX - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

    const volumeHeight = ((candle.volume / volumeMax) * 20) || 2;
    context.fillStyle = rising ? "rgba(116, 230, 245, 0.22)" : "rgba(244, 178, 93, 0.22)";
    context.fillRect(centerX - candleWidth / 2, volumeTop + (20 - volumeHeight), candleWidth, volumeHeight);
  });

  const movingAverage = buildMovingAverage(candles.map((candle) => candle.close), 4);
  context.strokeStyle = "rgba(201, 230, 255, 0.84)";
  context.lineWidth = 2;
  context.beginPath();
  movingAverage.forEach((value, index) => {
    const centerX = plot.left + xStep * index + xStep / 2;
    const y = mapRange(value, min, max, plot.bottom, plot.top);
    if (index === 0) {
      context.moveTo(centerX, y);
    } else {
      context.lineTo(centerX, y);
    }
  });
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(plot.left, volumeTop - 8, plot.right - plot.left, 1);

  renderHeroChartMeta(values, btc);
}

function renderHeroChartMeta(values, btc) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  dom.heroChartPrice.textContent = Northstar.formatCurrency(btc.priceUsd);
  dom.heroChartChange.textContent = Northstar.formatPercent(btc.priceChange24hPct);
  dom.heroChartChange.className = Northstar.signedClass(btc.priceChange24hPct);
  dom.heroChartRange.textContent = `${shortCurrency(min)} - ${shortCurrency(max)}`;
  dom.heroChartStatus.textContent = `Market-linked BTC view updated ${formatShortTime(new Date())}`;
}

function buildRenderableSeries(symbol, latestPrice, changePct) {
  const liveSeries = [...(state.priceSeries[symbol] || [])];
  const targetLength = 18;
  if (liveSeries.length >= targetLength) {
    return liveSeries.slice(-targetLength);
  }

  const generated = [];
  const basePrice = latestPrice || liveSeries[liveSeries.length - 1] || 0;
  const amplitude = Math.max(Math.abs(changePct || 0) / 100, 0.006);
  for (let index = 0; index < targetLength - liveSeries.length; index += 1) {
    const progress = index / Math.max(targetLength - liveSeries.length - 1, 1);
    const swing = Math.sin(progress * Math.PI * 3.2) * basePrice * amplitude * 0.55;
    const pullback = Math.cos(progress * Math.PI * 4.8) * basePrice * 0.0036;
    const drift = (progress - 0.5) * basePrice * amplitude * -0.8;
    generated.push(roundPrice(basePrice + swing + pullback + drift));
  }

  const series = generated.concat(liveSeries).slice(-targetLength);
  if (series.length) {
    series[series.length - 1] = roundPrice(latestPrice);
  }
  return series;
}

function buildCandles(series) {
  return series.map((close, index) => {
    const open = index === 0 ? close * 0.996 : series[index - 1];
    const midpoint = (open + close) / 2;
    const wick = Math.max(Math.abs(close - open) * 0.7, midpoint * 0.0014);
    return {
      open,
      close,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      volume: Math.max(wick * 260, midpoint * 0.08),
    };
  });
}

function buildMovingAverage(values, period) {
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    const slice = values.slice(start, index + 1);
    const total = slice.reduce((sum, value) => sum + value, 0);
    return total / slice.length;
  });
}

function syncCanvasSize(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) {
    return (outMin + outMax) / 2;
  }
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * ratio;
}

function shortCurrency(value) {
  if (Math.abs(value) >= 1000) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return Northstar.formatCurrency(value);
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function formatShortTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
