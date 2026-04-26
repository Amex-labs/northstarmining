const dashboardState = {
  summary: null,
  socket: null,
  pendingSecret: "",
};

const dashboardDom = {
  userIdentity: document.querySelector("#userIdentity"),
  logoutButton: document.querySelector("#logoutButton"),
  demoModeBadge: document.querySelector("#demoModeBadge"),
  walletBalance: document.querySelector("#walletBalance"),
  pendingBalance: document.querySelector("#pendingBalance"),
  dailyEstimate: document.querySelector("#dailyEstimate"),
  monthlyEstimate: document.querySelector("#monthlyEstimate"),
  powerDraw: document.querySelector("#powerDraw"),
  contractCount: document.querySelector("#contractCount"),
  riskLabel: document.querySelector("#riskLabel"),
  availablePlanList: document.querySelector("#availablePlanList"),
  earningsChart: document.querySelector("#earningsChart"),
  earningsLatest: document.querySelector("#earningsLatest"),
  earningsAverage: document.querySelector("#earningsAverage"),
  earningsBest: document.querySelector("#earningsBest"),
  announcementList: document.querySelector("#announcementList"),
  contractList: document.querySelector("#contractList"),
  withdrawForm: document.querySelector("#withdrawForm"),
  withdrawAsset: document.querySelector("#withdrawAsset"),
  withdrawNetwork: document.querySelector("#withdrawNetwork"),
  withdrawalList: document.querySelector("#withdrawalList"),
  withdrawalStatus: document.querySelector("#withdrawalStatus"),
  securityState: document.querySelector("#securityState"),
  setup2faButton: document.querySelector("#setup2faButton"),
  enable2faButton: document.querySelector("#enable2faButton"),
  disable2faButton: document.querySelector("#disable2faButton"),
  twoFactorCode: document.querySelector("#twoFactorCode"),
  twoFactorSecret: document.querySelector("#twoFactorSecret"),
  dashboardSupportFeed: document.querySelector("#dashboardSupportFeed"),
  dashboardSupportForm: document.querySelector("#dashboardSupportForm"),
  dashboardSupportInput: document.querySelector("#dashboardSupportInput"),
  ticketForm: document.querySelector("#ticketForm"),
  ticketStatus: document.querySelector("#ticketStatus"),
  notificationList: document.querySelector("#notificationList"),
};

bootstrap();

async function bootstrap() {
  if (!Northstar.getToken()) {
    window.location.href = "/";
    return;
  }

  bindDashboardEvents();
  await refreshDashboard();
  connectDashboardSocket();
}

function bindDashboardEvents() {
  dashboardDom.logoutButton.addEventListener("click", () => {
    Northstar.clearToken();
    window.location.href = "/";
  });

  dashboardDom.withdrawForm.addEventListener("submit", handleWithdrawal);
  dashboardDom.ticketForm.addEventListener("submit", handleTicket);
  dashboardDom.dashboardSupportForm.addEventListener("submit", handleSupportReply);
  dashboardDom.setup2faButton.addEventListener("click", startTwoFactorSetup);
  dashboardDom.enable2faButton.addEventListener("click", enableTwoFactor);
  dashboardDom.disable2faButton.addEventListener("click", disableTwoFactor);
  dashboardDom.withdrawAsset.addEventListener("change", populateWithdrawalNetworks);
  window.addEventListener("resize", () => {
    if (dashboardState.summary?.earningsHistory?.length) {
      drawEarningsChart(dashboardState.summary.earningsHistory);
    }
  });
}

async function refreshDashboard() {
  try {
    dashboardState.summary = await Northstar.api("/api/dashboard/summary");
    if (dashboardState.summary.user.role === "admin") {
      window.location.href = "/admin";
      return;
    }
    renderDashboard();
  } catch {
    Northstar.clearToken();
    window.location.href = "/";
  }
}

function renderDashboard() {
  const { user, metrics, announcements, contracts, withdrawals, notifications, support, availablePlans } = dashboardState.summary;

  dashboardDom.userIdentity.textContent = `${user.fullName}\n${user.email}`;
  dashboardDom.demoModeBadge.textContent = user.demoMode ? "Guided onboarding active" : "Live portfolio";
  dashboardDom.walletBalance.textContent = Northstar.formatCurrency(metrics.walletBalanceUsd);
  dashboardDom.pendingBalance.textContent = Northstar.formatCurrency(metrics.pendingBalanceUsd);
  dashboardDom.dailyEstimate.textContent = Northstar.formatCurrency(metrics.estimatedDailyUsd);
  dashboardDom.monthlyEstimate.textContent = Northstar.formatCurrency(metrics.estimatedMonthlyUsd);
  dashboardDom.powerDraw.textContent = `${Northstar.formatNumber(metrics.deployedPowerKw)} kW`;
  dashboardDom.contractCount.textContent = metrics.totalContracts;
  dashboardDom.riskLabel.textContent = metrics.riskLabel;
  populateWithdrawalAssets();
  renderAvailablePlans(availablePlans || []);

  dashboardDom.announcementList.innerHTML = announcements
    .map(
      (item) => `
        <article>
          <strong>${item.title}</strong>
          <p>${item.message}</p>
          <small>${Northstar.formatDate(item.createdAt)}</small>
        </article>
      `
    )
    .join("");

  dashboardDom.contractList.innerHTML = contracts
    .map(
      (contract) => `
        <article class="contract-card">
          <div class="panel-head">
            <div>
              <p class="eyebrow">${contract.coinSymbol}</p>
              <h3>${contract.name}</h3>
            </div>
            <strong>${Northstar.formatCurrency(contract.netDailyUsd)}/day</strong>
          </div>
          <div class="metric-list">
            <div><span>Hashrate</span><strong>${contract.hashrateLabel}</strong></div>
            <div><span>Power draw</span><strong>${contract.powerLabel}</strong></div>
            <div><span>Data center</span><strong>${contract.dataCenter}</strong></div>
            <div><span>Monthly estimate</span><strong>${Northstar.formatCurrency(contract.netMonthlyUsd)}</strong></div>
            <div><span>Low / high case</span><strong>${Northstar.formatCurrency(contract.lowCaseUsd)} to ${Northstar.formatCurrency(contract.highCaseUsd)}</strong></div>
          </div>
          <div class="progress-bar"><span style="width:${contract.progressPct}%"></span></div>
        </article>
      `
    )
    .join("");

  dashboardDom.withdrawalList.innerHTML = withdrawals
    .map(
      (item) => `
        <article>
          <strong>${Northstar.formatCurrency(item.amountUsd)}</strong>
          <p>${item.assetLabel || item.asset} • ${item.network}</p>
          <p>${item.address}</p>
          <small>${item.status} • ${Northstar.formatDate(item.createdAt)}</small>
        </article>
      `
    )
    .join("");

  dashboardDom.securityState.innerHTML = `
    <p>Email verified: <strong>${user.emailVerified ? "Yes" : "No"}</strong></p>
    <p>Authenticator enabled: <strong>${user.twoFactorEnabled ? "Yes" : "No"}</strong></p>
  `;

  dashboardDom.notificationList.innerHTML = notifications
    .map(
      (item) => `
        <article>
          <strong>${item.title}</strong>
          <p>${item.message}</p>
          <small>${Northstar.formatDate(item.createdAt)}</small>
        </article>
      `
    )
    .join("");

  renderSupportMessages(support.messages);
  renderEarningsSummary(dashboardState.summary.earningsHistory);
  drawEarningsChart(dashboardState.summary.earningsHistory);
}

function drawEarningsChart(points) {
  const canvas = dashboardDom.earningsChart;
  if (!canvas) {
    return;
  }
  syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) {
    return;
  }

  const values = points.map((item) => item.netUsd);
  const movingAverage = buildMovingAverage(values, 7);
  const min = Math.min(...values, ...movingAverage) * 0.96;
  const max = Math.max(...values, ...movingAverage) * 1.04;
  const plot = {
    left: 18,
    right: canvas.width - 76,
    top: 22,
    bottom: canvas.height - 44,
  };
  const barStep = (plot.right - plot.left) / points.length;
  const barWidth = Math.max(barStep * 0.62, 8);
  const referenceValues = Array.from({ length: 4 }, (_, index) => max - ((max - min) / 3) * index);

  const backdrop = context.createLinearGradient(0, plot.top, 0, plot.bottom);
  backdrop.addColorStop(0, "rgba(116, 230, 245, 0.06)");
  backdrop.addColorStop(1, "rgba(8, 16, 28, 0)");
  context.fillStyle = backdrop;
  context.fillRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);

  context.strokeStyle = "rgba(255,255,255,0.07)";
  context.lineWidth = 1;
  context.font = "12px Plus Jakarta Sans";
  context.fillStyle = "rgba(197, 214, 235, 0.74)";
  context.textAlign = "left";
  referenceValues.forEach((value) => {
    const y = mapRange(value, min, max, plot.bottom, plot.top);
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(plot.right, y);
    context.stroke();
    context.fillText(shortCurrency(value), plot.right + 12, y + 4);
  });

  points.forEach((point, index) => {
    const x = plot.left + index * barStep + (barStep - barWidth) / 2;
    const top = mapRange(point.netUsd, min, max, plot.bottom, plot.top);
    const previous = points[index - 1]?.netUsd ?? point.netUsd;
    const rising = point.netUsd >= previous;
    const gradient = context.createLinearGradient(0, top, 0, plot.bottom);
    if (rising) {
      gradient.addColorStop(0, "rgba(116, 230, 245, 0.94)");
      gradient.addColorStop(1, "rgba(116, 230, 245, 0.18)");
    } else {
      gradient.addColorStop(0, "rgba(244, 178, 93, 0.94)");
      gradient.addColorStop(1, "rgba(244, 178, 93, 0.18)");
    }
    context.fillStyle = gradient;
    fillRoundedRect(context, x, top, barWidth, plot.bottom - top, 10);
  });

  context.beginPath();
  movingAverage.forEach((value, index) => {
    const x = plot.left + index * barStep + barStep / 2;
    const y = mapRange(value, min, max, plot.bottom, plot.top);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.lineWidth = 3;
  context.strokeStyle = "rgba(223, 245, 255, 0.92)";
  context.stroke();

  const latest = points[points.length - 1];
  const latestX = plot.left + (points.length - 1) * barStep + barStep / 2;
  const latestY = mapRange(latest.netUsd, min, max, plot.bottom, plot.top);
  context.fillStyle = "#74e6f5";
  context.beginPath();
  context.arc(latestX, latestY, 5, 0, Math.PI * 2);
  context.fill();
  drawValueBadge(context, latestX - 54, latestY - 34, shortCurrency(latest.netUsd));

  context.fillStyle = "rgba(197, 214, 235, 0.72)";
  context.textAlign = "center";
  [0, Math.floor(points.length / 2), points.length - 1].forEach((index) => {
    const labelX = plot.left + index * barStep + barStep / 2;
    context.fillText(formatChartDate(points[index].date), labelX, canvas.height - 16);
  });
}

function renderAvailablePlans(plans) {
  if (!plans.length) {
    dashboardDom.availablePlanList.innerHTML = `
      <article class="dashboard-plan-card empty">
        <h3>Plans are updating</h3>
        <p>Our operations desk can still help you choose a machine while live inventory refreshes.</p>
      </article>
    `;
    return;
  }

  dashboardDom.availablePlanList.innerHTML = plans
    .map(
      (plan) => `
        <article class="dashboard-plan-card">
          <img src="${plan.image}" alt="${plan.name} mining hardware photo" loading="lazy" />
          <div class="dashboard-plan-copy">
            <p class="eyebrow">${plan.algorithm}</p>
            <h3>${plan.name}</h3>
            <p>${plan.description}</p>
          </div>
          <div class="metric-list">
            <div><span>Starts from</span><strong>${Northstar.formatCurrency(plan.startingPriceUsd)}</strong></div>
            <div><span>Hashrate</span><strong>${plan.hashrateLabel}</strong></div>
            <div><span>Power draw</span><strong>${plan.powerLabel}</strong></div>
            <div><span>Efficiency</span><strong>${plan.efficiencyLabel}</strong></div>
            <div><span>Up to daily</span><strong>${plan.featuredDailyUsd ? Northstar.formatCurrency(plan.featuredDailyUsd) : "Variable"}</strong></div>
            <div><span>Up to monthly</span><strong>${plan.featuredMonthlyUsd ? Northstar.formatCurrency(plan.featuredMonthlyUsd) : "Variable"}</strong></div>
          </div>
          <div class="dashboard-plan-actions">
            ${
              plan.paymentUrl
                ? `<a class="primary-button wide" href="${plan.paymentUrl}" target="_blank" rel="noreferrer">Subscribe now</a>`
                : `<button class="primary-button wide" type="button" data-plan-support="${plan.id}" data-plan-name="${escapeAttribute(plan.name)}" data-plan-price="${plan.startingPriceUsd}">Contact support</button>`
            }
            <button class="secondary-button wide" type="button" data-plan-support="${plan.id}" data-plan-name="${escapeAttribute(plan.name)}" data-plan-price="${plan.startingPriceUsd}">Ask operations</button>
          </div>
        </article>
      `
    )
    .join("");

  dashboardDom.availablePlanList.querySelectorAll("[data-plan-support]").forEach((button) => {
    button.addEventListener("click", () => {
      const planName = button.dataset.planName;
      const planPrice = Number(button.dataset.planPrice || 0);
      dashboardDom.dashboardSupportInput.value = `Hi Northstar team, I would like help activating the ${planName} plan starting from ${Northstar.formatCurrency(planPrice)}. Please guide me on the next step.`;
      dashboardDom.dashboardSupportInput.focus();
      document.querySelector("#support")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderEarningsSummary(points) {
  if (!points.length) {
    dashboardDom.earningsLatest.textContent = "-";
    dashboardDom.earningsAverage.textContent = "-";
    dashboardDom.earningsBest.textContent = "-";
    return;
  }

  const latest = points[points.length - 1].netUsd;
  const average = points.reduce((sum, item) => sum + item.netUsd, 0) / points.length;
  const best = Math.max(...points.map((item) => item.netUsd));
  dashboardDom.earningsLatest.textContent = Northstar.formatCurrency(latest);
  dashboardDom.earningsAverage.textContent = Northstar.formatCurrency(average);
  dashboardDom.earningsBest.textContent = Northstar.formatCurrency(best);
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

function fillRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

function drawValueBadge(context, x, y, label) {
  context.font = "12px Plus Jakarta Sans";
  const width = Math.max(78, context.measureText(label).width + 20);
  context.fillStyle = "rgba(6, 16, 28, 0.94)";
  fillRoundedRect(context, x, y, width, 28, 14);
  context.strokeStyle = "rgba(116, 230, 245, 0.25)";
  context.stroke();
  context.fillStyle = "#e8f3ff";
  context.textAlign = "center";
  context.fillText(label, x + width / 2, y + 18);
}

function shortCurrency(value) {
  if (Math.abs(value) >= 1000) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return Northstar.formatCurrency(value);
}

function formatChartDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function handleWithdrawal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  setFormStatus(dashboardDom.withdrawalStatus, "");
  try {
    const response = await Northstar.api("/api/dashboard/withdraw", {
      method: "POST",
      body: {
        amountUsd: Number(formData.get("amountUsd")),
        asset: formData.get("asset"),
        network: formData.get("network"),
        address: formData.get("address"),
      },
    });
    form.reset();
    await refreshDashboard();
    populateWithdrawalAssets();
    setFormStatus(
      dashboardDom.withdrawalStatus,
      response.message || "Withdrawal request submitted. It is currently under review.",
      "success"
    );
  } catch (error) {
    setFormStatus(dashboardDom.withdrawalStatus, error.message, "error");
  }
}

async function handleTicket(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  setFormStatus(dashboardDom.ticketStatus, "");
  try {
    const response = await Northstar.api("/api/dashboard/tickets", {
      method: "POST",
      body: {
        subject: formData.get("subject"),
        message: formData.get("message"),
      },
    });
    form.reset();
    await refreshDashboard();
    setFormStatus(dashboardDom.ticketStatus, response.message || "Support ticket submitted.", "success");
  } catch (error) {
    setFormStatus(dashboardDom.ticketStatus, error.message, "error");
  }
}

function connectDashboardSocket() {
  dashboardState.socket = Northstar.connectSocket(async (message, socket) => {
    dashboardState.socket = socket;
    if (message.type === "supportThread") {
      dashboardState.summary.support = message.data;
      renderSupportMessages(message.data.messages);
    }
    if (message.type === "marketSnapshot") {
      await refreshDashboard();
    }
  });
}

function renderSupportMessages(messages) {
  dashboardDom.dashboardSupportFeed.innerHTML = messages
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

function populateWithdrawalAssets() {
  const options = dashboardState.summary?.withdrawalOptions || {};
  const assetEntries = Object.entries(options);
  if (!assetEntries.length) {
    return;
  }

  const selectedAsset = dashboardDom.withdrawAsset.value && options[dashboardDom.withdrawAsset.value] ? dashboardDom.withdrawAsset.value : assetEntries[0][0];
  dashboardDom.withdrawAsset.innerHTML = assetEntries
    .map(([symbol, config]) => `<option value="${symbol}">${config.label} (${symbol})</option>`)
    .join("");
  dashboardDom.withdrawAsset.value = selectedAsset;
  populateWithdrawalNetworks();
}

function populateWithdrawalNetworks() {
  const options = dashboardState.summary?.withdrawalOptions || {};
  const config = options[dashboardDom.withdrawAsset.value];
  if (!config) {
    dashboardDom.withdrawNetwork.innerHTML = "";
    return;
  }
  dashboardDom.withdrawNetwork.innerHTML = config.networks.map((network) => `<option value="${network}">${network}</option>`).join("");
}

function handleSupportReply(event) {
  event.preventDefault();
  const body = dashboardDom.dashboardSupportInput.value.trim();
  if (!body || !dashboardState.socket || dashboardState.socket.readyState !== WebSocket.OPEN) {
    return;
  }
  dashboardState.socket.send(JSON.stringify({ type: "supportMessage", body }));
  dashboardDom.dashboardSupportInput.value = "";
}

function setFormStatus(element, message, tone) {
  if (!element) {
    return;
  }
  element.textContent = message || "";
  element.className = "form-status";
  if (tone) {
    element.classList.add(tone);
  }
}

async function startTwoFactorSetup() {
  try {
    const response = await Northstar.api("/api/auth/two-factor/setup", { method: "POST" });
    dashboardState.pendingSecret = response.secret;
    dashboardDom.twoFactorSecret.textContent = `Manual key: ${response.secret}\n\n${response.otpauthUri}`;
  } catch (error) {
    alert(error.message);
  }
}

async function enableTwoFactor() {
  try {
    await Northstar.api("/api/auth/two-factor/enable", {
      method: "POST",
      body: {
        code: dashboardDom.twoFactorCode.value,
      },
    });
    dashboardDom.twoFactorCode.value = "";
    await refreshDashboard();
  } catch (error) {
    alert(error.message);
  }
}

async function disableTwoFactor() {
  try {
    await Northstar.api("/api/auth/two-factor/disable", {
      method: "POST",
      body: {
        code: dashboardDom.twoFactorCode.value,
      },
    });
    dashboardDom.twoFactorCode.value = "";
    dashboardDom.twoFactorSecret.textContent = "";
    await refreshDashboard();
  } catch (error) {
    alert(error.message);
  }
}
