const adminState = {
  overview: null,
  socket: null,
  selectedThreadId: null,
  selectedAdjustmentUserId: null,
};

const adminDom = {
  adminIdentity: document.querySelector("#adminIdentity"),
  adminLogoutButton: document.querySelector("#adminLogoutButton"),
  adminLoginButton: document.querySelector("#adminLoginButton"),
  adminAuthModal: document.querySelector("#adminAuthModal"),
  adminAuthClose: document.querySelector("#adminAuthClose"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminStatus: document.querySelector("#adminStatus"),
  metricUsers: document.querySelector("#metricUsers"),
  metricVerified: document.querySelector("#metricVerified"),
  metricContracts: document.querySelector("#metricContracts"),
  metricWithdrawals: document.querySelector("#metricWithdrawals"),
  metricThreads: document.querySelector("#metricThreads"),
  metricPayout: document.querySelector("#metricPayout"),
  pendingWithdrawalList: document.querySelector("#pendingWithdrawalList"),
  userTableBody: document.querySelector("#userTableBody"),
  adjustUserSelect: document.querySelector("#adjustUserSelect"),
  adjustmentForm: document.querySelector("#adjustmentForm"),
  adjustmentStatus: document.querySelector("#adjustmentStatus"),
  threadList: document.querySelector("#threadList"),
  adminSupportFeed: document.querySelector("#adminSupportFeed"),
  adminSupportForm: document.querySelector("#adminSupportForm"),
  adminSupportInput: document.querySelector("#adminSupportInput"),
  broadcastForm: document.querySelector("#broadcastForm"),
  broadcastStatus: document.querySelector("#broadcastStatus"),
  auditLog: document.querySelector("#auditLog"),
};

startAdmin();

async function startAdmin() {
  bindAdminEvents();
  if (!Northstar.getToken()) {
    openAdminLogin();
    return;
  }
  await refreshAdmin();
  connectAdminSocket();
}

function bindAdminEvents() {
  adminDom.adminLoginButton.addEventListener("click", openAdminLogin);
  adminDom.adminAuthClose.addEventListener("click", closeAdminLogin);
  adminDom.adminLoginForm.addEventListener("submit", handleAdminLogin);
  adminDom.adminLogoutButton.addEventListener("click", () => {
    Northstar.clearToken();
    window.location.href = "/";
  });
  adminDom.adjustmentForm.addEventListener("submit", handleAdjustment);
  adminDom.adjustUserSelect.addEventListener("change", () => {
    adminState.selectedAdjustmentUserId = adminDom.adjustUserSelect.value;
  });
  adminDom.broadcastForm.addEventListener("submit", handleBroadcast);
  adminDom.adminSupportForm.addEventListener("submit", handleAdminReply);
}

function openAdminLogin() {
  adminDom.adminAuthModal.classList.remove("hidden");
}

function closeAdminLogin() {
  adminDom.adminAuthModal.classList.add("hidden");
}

async function handleAdminLogin(event) {
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
    if (response.user.role !== "admin") {
      window.location.href = "/dashboard";
      return;
    }
    Northstar.setToken(response.token);
    closeAdminLogin();
    await refreshAdmin();
    connectAdminSocket();
  } catch (error) {
    adminDom.adminStatus.textContent = error.message;
  }
}

async function refreshAdmin() {
  try {
    adminState.overview = await Northstar.api("/api/admin/overview");
    renderAdmin();
  } catch {
    Northstar.clearToken();
    openAdminLogin();
  }
}

function renderAdmin() {
  const { metrics, users, threads, auditLog, pendingWithdrawals } = adminState.overview;

  adminDom.adminIdentity.textContent = "Northstar Operations";
  adminDom.metricUsers.textContent = metrics.totalUsers;
  adminDom.metricVerified.textContent = metrics.verifiedUsers;
  adminDom.metricContracts.textContent = metrics.activeContracts;
  adminDom.metricWithdrawals.textContent = metrics.pendingWithdrawals;
  adminDom.metricThreads.textContent = metrics.openThreads;
  adminDom.metricPayout.textContent = Northstar.formatCurrency(metrics.estimatedDailyPayoutUsd);

  adminDom.userTableBody.innerHTML = users
    .map(
      (user) => `
        <tr data-user-pick="${user.id}">
          <td><strong>${user.fullName}</strong><br /><small>${user.email}</small></td>
          <td>${Northstar.formatCurrency(user.walletBalanceUsd)}<br /><small>Pending ${Northstar.formatCurrency(user.pendingBalanceUsd)}</small></td>
          <td>${user.contractCount}<br /><small>${user.demoMode ? "Demo" : "Live"}</small></td>
          <td>${user.emailVerified ? "Verified" : "Pending"}<br /><small>${user.twoFactorEnabled ? "2FA on" : "2FA off"}</small></td>
          <td>${user.lastLoginAt ? Northstar.formatDate(user.lastLoginAt) : "Never"}</td>
        </tr>
      `
    )
    .join("");

  const currentAdjustUserId = adminState.selectedAdjustmentUserId || adminDom.adjustUserSelect.value || users[0]?.id || "";
  adminDom.adjustUserSelect.innerHTML = users
    .map((user) => `<option value="${user.id}">${user.fullName} (${user.email})</option>`)
    .join("");
  if (users.some((user) => user.id === currentAdjustUserId)) {
    adminDom.adjustUserSelect.value = currentAdjustUserId;
  }
  adminState.selectedAdjustmentUserId = adminDom.adjustUserSelect.value;

  adminDom.pendingWithdrawalList.innerHTML = pendingWithdrawals.length
    ? pendingWithdrawals
        .map(
          (item) => `
            <article>
              <strong>${item.userName} • ${Northstar.formatCurrency(item.amountUsd)}</strong>
              <p>${item.assetLabel || item.asset} on ${item.network}</p>
              <p>${item.address}</p>
              <small>${item.status} • ${Northstar.formatDate(item.createdAt)}</small>
              ${item.threadId ? `<button class="ghost-button small" type="button" data-thread-jump="${item.threadId}">Open chat</button>` : ""}
            </article>
          `
        )
        .join("")
    : "<p class='support-system'>No withdrawals are pending review.</p>";

  adminDom.threadList.innerHTML = threads
    .map(
      (thread) => `
        <article class="thread-card ${thread.id === adminState.selectedThreadId ? "selected" : ""}" data-thread-id="${thread.id}">
          <strong>${thread.user?.fullName || "Unknown user"}</strong>
          <p>${thread.title}</p>
          <small>${thread.status} • ${Northstar.formatDate(thread.updatedAt)}</small>
        </article>
      `
    )
    .join("");

  adminDom.auditLog.innerHTML = auditLog
    .map(
      (item) => `
        <article>
          <strong>${item.type}</strong>
          <p>${item.detail}</p>
          <small>${Northstar.formatDate(item.createdAt)}</small>
        </article>
      `
    )
    .join("");

  if (!adminState.selectedThreadId && threads[0]) {
    adminState.selectedThreadId = threads[0].id;
  }

  renderSelectedThread();

  document.querySelectorAll("[data-thread-id]").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.selectedThreadId = button.dataset.threadId;
      renderAdmin();
    });
  });

  document.querySelectorAll("[data-user-pick]").forEach((row) => {
    row.addEventListener("click", () => {
      adminState.selectedAdjustmentUserId = row.dataset.userPick;
      adminDom.adjustUserSelect.value = adminState.selectedAdjustmentUserId;
      setFormStatus(adminDom.adjustmentStatus, `Selected ${users.find((user) => user.id === row.dataset.userPick)?.fullName || "user"} for manual balance updates.`, "success");
      adminDom.adjustUserSelect.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  document.querySelectorAll("[data-thread-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.selectedThreadId = button.dataset.threadJump;
      renderAdmin();
      document.querySelector("#threads")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderSelectedThread() {
  const thread = adminState.overview?.threads.find((item) => item.id === adminState.selectedThreadId);
  if (!thread) {
    adminDom.adminSupportFeed.innerHTML = "<p class='support-system'>Select a thread to reply.</p>";
    return;
  }

  adminDom.adminSupportFeed.innerHTML = thread.messages
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

async function handleAdjustment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const selectedUserId = String(formData.get("userId") || "");
  adminState.selectedAdjustmentUserId = selectedUserId;
  setFormStatus(adminDom.adjustmentStatus, "");
  try {
    const response = await Northstar.api("/api/admin/adjust", {
      method: "POST",
      body: {
        userId: selectedUserId,
        amountUsd: Number(formData.get("amountUsd")),
        note: formData.get("note"),
      },
    });
    await refreshAdmin();
    form.querySelector('[name="amountUsd"]').value = "";
    form.querySelector('[name="note"]').value = "";
    adminDom.adjustUserSelect.value = adminState.selectedAdjustmentUserId;
    setFormStatus(
      adminDom.adjustmentStatus,
      response.message || "Balance update posted successfully.",
      "success"
    );
  } catch (error) {
    setFormStatus(adminDom.adjustmentStatus, error.message, "error");
  }
}

async function handleBroadcast(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  setFormStatus(adminDom.broadcastStatus, "");
  try {
    const response = await Northstar.api("/api/admin/broadcast", {
      method: "POST",
      body: {
        title: formData.get("title"),
        message: formData.get("message"),
      },
    });
    form.reset();
    await refreshAdmin();
    setFormStatus(adminDom.broadcastStatus, response.message || "Announcement sent successfully.", "success");
  } catch (error) {
    setFormStatus(adminDom.broadcastStatus, error.message, "error");
  }
}

function connectAdminSocket() {
  if (adminState.socket && adminState.socket.readyState <= 1) {
    return;
  }
  adminState.socket = Northstar.connectSocket(async (message, socket) => {
    adminState.socket = socket;
    if (message.type === "supportThread") {
      await refreshAdmin();
    }
    if (message.type === "marketSnapshot") {
      await refreshAdmin();
    }
  });
}

function handleAdminReply(event) {
  event.preventDefault();
  const body = adminDom.adminSupportInput.value.trim();
  if (!body || !adminState.selectedThreadId || !adminState.socket || adminState.socket.readyState !== WebSocket.OPEN) {
    return;
  }
  adminState.socket.send(
    JSON.stringify({
      type: "supportMessage",
      threadId: adminState.selectedThreadId,
      body,
    })
  );
  adminDom.adminSupportInput.value = "";
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
