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
  earningsChart: document.querySelector("#earningsChart"),
  announcementList: document.querySelector("#announcementList"),
  contractList: document.querySelector("#contractList"),
  withdrawForm: document.querySelector("#withdrawForm"),
  withdrawAsset: document.querySelector("#withdrawAsset"),
  withdrawNetwork: document.querySelector("#withdrawNetwork"),
  withdrawalList: document.querySelector("#withdrawalList"),
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
  const { user, metrics, announcements, contracts, withdrawals, notifications, support } = dashboardState.summary;

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
  drawEarningsChart(dashboardState.summary.earningsHistory);
}

function drawEarningsChart(points) {
  const canvas = dashboardDom.earningsChart;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) {
    return;
  }

  const values = points.map((item) => item.netUsd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 28;
  const step = (canvas.width - pad * 2) / Math.max(values.length - 1, 1);

  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.lineWidth = 1;
  for (let line = 0; line < 4; line += 1) {
    const y = pad + ((canvas.height - pad * 2) / 3) * line;
    context.beginPath();
    context.moveTo(pad, y);
    context.lineTo(canvas.width - pad, y);
    context.stroke();
  }

  context.beginPath();
  values.forEach((value, index) => {
    const x = pad + step * index;
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
}

async function handleWithdrawal(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    await Northstar.api("/api/dashboard/withdraw", {
      method: "POST",
      body: {
        amountUsd: Number(formData.get("amountUsd")),
        asset: formData.get("asset"),
        network: formData.get("network"),
        address: formData.get("address"),
      },
    });
    event.currentTarget.reset();
    populateWithdrawalAssets();
    await refreshDashboard();
  } catch (error) {
    alert(error.message);
  }
}

async function handleTicket(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    await Northstar.api("/api/dashboard/tickets", {
      method: "POST",
      body: {
        subject: formData.get("subject"),
        message: formData.get("message"),
      },
    });
    event.currentTarget.reset();
    await refreshDashboard();
  } catch (error) {
    alert(error.message);
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
