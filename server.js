const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 6060);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const OUTBOX_DIR = path.join(ROOT_DIR, "outbox", "email");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const TOKEN_SECRET = process.env.TOKEN_SECRET || "northstar-demo-secret";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const YIELD_OPTIMIZATION_PCT = 5;
const YIELD_OPTIMIZATION_FACTOR = 1 + YIELD_OPTIMIZATION_PCT / 100;

const BRAND = {
  name: "Northstar Mining",
  tag: "Transparent, market-linked mining operations",
  legal: "Northstar Mining Platform",
};

const COIN_PROFILES = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    algorithm: "SHA-256",
    blockReward: 3.125,
    blockTimeSeconds: 600,
    poolFee: 0.02,
    volatility: 0.034,
    basePriceUsd: 71250,
    baseNetworkHashrateHs: 625e18,
    baseDifficulty: 88.2e12,
    waveIntervalSeconds: 140,
    unit: "EH/s",
  },
  ZEC: {
    symbol: "ZEC",
    name: "Zcash",
    algorithm: "Equihash",
    blockReward: 1.5625,
    blockTimeSeconds: 75,
    poolFee: 0.02,
    volatility: 0.051,
    basePriceUsd: 41.8,
    baseNetworkHashrateHs: 8.3e9,
    baseDifficulty: 8.4e6,
    waveIntervalSeconds: 125,
    unit: "GSol/s",
  },
  INI: {
    symbol: "INI",
    name: "InitVerse",
    algorithm: "VersaHash",
    blockReward: 212.03,
    blockTimeSeconds: 13,
    poolFee: 0.015,
    volatility: 0.052,
    basePriceUsd: 0.1071,
    baseNetworkHashrateHs: 8.66e12,
    baseDifficulty: 77.94e12,
    waveIntervalSeconds: 95,
    unit: "TH/s",
  },
};

const PLAN_LIBRARY = [
  {
    id: "zec-z15-pro",
    name: "Antminer Z15 Pro",
    description: "Entry Equihash allocation built around Bitmain's Z15 Pro, suited for users who want ZEC exposure with transparent rack power assumptions and conservative upkeep windows.",
    algorithm: "Equihash",
    supportedCoins: ["ZEC"],
    hashrateHs: 840000,
    hashrateLabel: "840 kSol/s",
    powerWatts: 2780,
    powerLabel: "2.78 kW",
    efficiencyLabel: "3.31 J/kSol",
    startingPriceUsd: 300,
    hardwarePriceUsd: 2549,
    hostingFeeDailyUsd: 0.92,
    uptimeTargetPct: 97.4,
    defaultTermMonths: 12,
    dataCenter: "Reno, US",
    deploymentWindowDays: 12,
    warrantyDays: 365,
    image: "/assets/miner-z15-pro.svg",
  },
  {
    id: "ini-spark",
    name: "Matches INIBOX",
    description: "Compact VersaHash exposure for InitVerse with home-scale power draw, straightforward hosting assumptions, and faster repricing across short deployment cycles.",
    algorithm: "VersaHash",
    supportedCoins: ["INI"],
    hashrateHs: 850e6,
    hashrateLabel: "850 MH/s",
    powerWatts: 500,
    powerLabel: "500 W",
    efficiencyLabel: "0.60 J/MH",
    startingPriceUsd: 450,
    hardwarePriceUsd: 4205,
    hostingFeeDailyUsd: 0.42,
    uptimeTargetPct: 97.8,
    defaultTermMonths: 12,
    dataCenter: "Kaduna, NG",
    deploymentWindowDays: 9,
    warrantyDays: 365,
    image: "https://www.inibox.io/wp-content/uploads/2026/02/alk-1.webp",
  },
  {
    id: "ini-pro",
    name: "Matches INIBOX Pro",
    description: "Higher-throughput VersaHash placement designed for users stepping into larger INI positions, with denser racks, stronger thermal controls, and premium uptime monitoring.",
    algorithm: "VersaHash",
    supportedCoins: ["INI"],
    hashrateHs: 2.4e9,
    hashrateLabel: "2.4 GH/s",
    powerWatts: 1280,
    powerLabel: "1.28 kW",
    efficiencyLabel: "0.516 J/MH",
    startingPriceUsd: 750,
    hardwarePriceUsd: 6470,
    hostingFeeDailyUsd: 0.68,
    uptimeTargetPct: 98.2,
    defaultTermMonths: 18,
    dataCenter: "Lulea, SE",
    deploymentWindowDays: 11,
    warrantyDays: 365,
    image: "https://www.inibox.io/wp-content/uploads/2026/02/6.png",
  },
  {
    id: "btc-hyd-3u",
    name: "Bitmain Antminer S21e XP Hyd 3U",
    description: "Flagship hydro-cooled SHA-256 capacity for high-density Bitcoin racks, built around enterprise-style cooling loops, lower noise, and heavy-duty power distribution.",
    algorithm: "SHA-256",
    supportedCoins: ["BTC"],
    hashrateHs: 860e12,
    hashrateLabel: "860 TH/s",
    powerWatts: 11180,
    powerLabel: "11.18 kW",
    efficiencyLabel: "13 J/TH",
    startingPriceUsd: 1250,
    hardwarePriceUsd: 16899,
    hostingFeeDailyUsd: 2.95,
    uptimeTargetPct: 98.9,
    defaultTermMonths: 24,
    dataCenter: "Reykjanes, IS",
    deploymentWindowDays: 24,
    warrantyDays: 365,
    image: "/assets/miner-s21e-hyd-3u.svg",
  },
];

const HARDWARE_LIBRARY = [
  {
    id: "hw-01",
    name: "Antminer Z15 Pro",
    algorithm: "Equihash",
    hashrateLabel: "840 kSol/s",
    powerLabel: "2.78 kW",
    efficiencyLabel: "3.31 J/kSol",
    priceUsd: 2549,
    summary: "Bitmain Equihash machine used for the $300 hosted starter plan focused on ZEC mining.",
    supportedCoins: ["ZEC"],
    image: "/assets/miner-z15-pro.svg",
  },
  {
    id: "hw-02",
    name: "Matches INIBOX",
    algorithm: "VersaHash",
    hashrateLabel: "850 MH/s",
    powerLabel: "500 W",
    efficiencyLabel: "0.60 J/MH",
    priceUsd: 4205,
    summary: "Mid-ticket INI hardware class used for the $450 plan with lightweight power draw and faster deployment.",
    supportedCoins: ["INI"],
    image: "https://www.inibox.io/wp-content/uploads/2026/02/alk-1.webp",
  },
  {
    id: "hw-03",
    name: "Matches INIBOX Pro",
    algorithm: "VersaHash",
    hashrateLabel: "2.4 GH/s",
    powerLabel: "1.28 kW",
    efficiencyLabel: "0.516 J/MH",
    priceUsd: 6470,
    summary: "Higher-output INI machine used for the $750 plan with better throughput per watt than the base INIBOX.",
    supportedCoins: ["INI"],
    image: "https://www.inibox.io/wp-content/uploads/2026/02/6.png",
  },
  {
    id: "hw-04",
    name: "Bitmain Antminer S21e XP Hyd 3U",
    algorithm: "SHA-256",
    hashrateLabel: "860 TH/s",
    powerLabel: "11.18 kW",
    efficiencyLabel: "13 J/TH",
    priceUsd: 16899,
    summary: "Hydro-cooled flagship Bitcoin hardware used for the $1,250 hosted plan in high-density rack deployments.",
    supportedCoins: ["BTC"],
    image: "/assets/miner-s21e-hyd-3u.svg",
  },
];

const FAQS = [
  {
    question: "How are earnings calculated?",
    answer:
      "Estimated earnings are derived from your selected machine hashrate, the coin's live network hashrate, block reward, observed price, power draw, pool fees, and our stated hosting assumptions. They refresh continuously and are never fixed.",
  },
  {
    question: "What are the risks?",
    answer:
      "Mining returns move with token prices, network difficulty, downtime, energy prices, and regulatory conditions. A profitable setup today can become less profitable if any of those factors change materially.",
  },
  {
    question: "Do you guarantee ROI?",
    answer:
      "No. We present scenario-based estimates only. Return timelines may improve or worsen with market conditions and operating performance.",
  },
  {
    question: "What happens during maintenance or outages?",
    answer:
      "We publish maintenance windows, target uptime, and operational incident notes. Estimated earnings fall when hardware is offline, so availability and cooling efficiency are reflected in each plan profile.",
  },
  {
    question: "Can I review projected performance before activating a contract?",
    answer:
      "Yes. Guided onboarding includes a portfolio walkthrough, example contract reporting, and support-led setup so you can review the workflow before activating funded capacity.",
  },
];

const DISCLOSURES = [
  "Crypto mining involves market, operational, regulatory, and liquidity risk.",
  "Displayed returns are estimates and are not guaranteed.",
  "Power cost, pool fee, and uptime assumptions are stated transparently beside each plan.",
  "Withdrawals can be delayed for risk review, address verification, or maintenance events.",
];

const COMPANY = {
  founded: 2021,
  headquarters: "London, United Kingdom",
  operations: ["3074 Powder House Road, West Palm Beach, FL 33417, USA"],
  supportCoverage: "24/7 ticketing, live operations desk 06:00-22:00 UTC",
  whatsappNumber: "+13659172311",
  whatsappUrl: "https://wa.me/13659172311",
  customerEmail: "northstar.mining@aol.com",
  customerEmailUrl: "mailto:northstar.mining@aol.com",
  trustCopy:
    "Northstar publishes equipment-level assumptions, deployment windows, maintenance notes, and variable yield ranges so operators can review where returns come from before allocating capital.",
};

const SUPPORT_PROFILE = {
  activeAgents: 6,
  averageFirstResponseMinutes: 4,
  fallbackWindow: "Tickets answered within 12 hours",
};

const WITHDRAWAL_OPTIONS = {
  BTC: {
    label: "Bitcoin",
    networks: ["Bitcoin"],
  },
  ETH: {
    label: "Ethereum",
    networks: ["Ethereum"],
  },
  USDT: {
    label: "Tether USD",
    networks: ["ERC-20", "TRC-20", "BEP-20"],
  },
  USDC: {
    label: "USD Coin",
    networks: ["ERC-20", "Base", "Arbitrum", "Solana"],
  },
  LTC: {
    label: "Litecoin",
    networks: ["Litecoin"],
  },
  SOL: {
    label: "Solana",
    networks: ["Solana"],
  },
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const wsClients = new Set();

ensureRuntime();

const server = http.createServer((req, res) => {
  Promise.resolve(routeRequest(req, res)).catch((error) => {
    console.error("Unhandled request error", error);
    sendJson(res, 500, { error: "Internal server error." });
  });
});

server.on("upgrade", handleUpgrade);

server.listen(PORT, () => {
  console.log(`${BRAND.name} listening on http://localhost:${PORT}`);
});

setInterval(() => {
  try {
    broadcastMarketSnapshot();
  } catch (error) {
    console.error("WebSocket broadcast error", error);
  }
}, 5000);

function ensureRuntime() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });

  if (!fs.existsSync(STORE_PATH)) {
    writeStore(buildInitialStore());
  }
}

function buildInitialStore() {
  const previewUser = createSeedUser({
    id: "user-preview",
    role: "user",
    fullName: "Olivia Reid",
    email: "olivia.reid@northstar.demo",
    password: "Preview!2026",
    emailVerified: true,
    demoMode: true,
    walletBalance: 1842.66,
    pendingBalance: 78.31,
  });
  const adminUser = createSeedUser({
    id: "admin-ops",
    role: "admin",
    fullName: "Northstar Operations",
    email: "ops@northstar.demo",
    password: "Admin!2026",
    emailVerified: true,
    demoMode: false,
    walletBalance: 0,
    pendingBalance: 0,
  });

  previewUser.activeContracts = [
    createContract("zec-z15-pro", "ZEC", 0.08, 12, 47),
    createContract("ini-spark", "INI", 0.08, 12, 24),
  ];
  previewUser.earningsHistory = buildHistoricalEarnings(previewUser.activeContracts, 36);
  previewUser.notifications = [
    createNotification("Welcome aboard", "Your guided onboarding workspace is active. Review the dashboard and contract reporting before allocating capital.", "info"),
    createNotification("Yield refresh", "Your INI estimate tightened after a network difficulty increase. Review the profitability panel for updated assumptions.", "warning"),
  ];
  previewUser.withdrawals = [
    {
      id: randomId("wd"),
      amountUsd: 320,
      asset: "BTC",
      assetLabel: "Bitcoin",
      network: "Bitcoin",
      address: "bc1qnorthstarpreview8k9",
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      status: "completed",
    },
  ];

  const threadId = randomId("thread");
  previewUser.supportThreadId = threadId;

  return {
    company: COMPANY,
    supportProfile: SUPPORT_PROFILE,
    plans: PLAN_LIBRARY,
    hardware: HARDWARE_LIBRARY,
    faqs: FAQS,
    disclosures: DISCLOSURES,
    users: [adminUser, previewUser],
    supportThreads: [
      {
        id: threadId,
        userId: previewUser.id,
        status: "open",
        title: "Onboarding and profitability assumptions",
        priority: "normal",
        updatedAt: new Date().toISOString(),
        messages: [
          createSupportMessage("system", "Northstar Bot", "Welcome to Northstar. Ask anything about plan assumptions, electricity costs, or setup risk."),
          createSupportMessage("admin", "Northstar Operations", "Your onboarding workspace is ready. We can walk through how estimated returns are calculated if you'd like."),
        ],
        tickets: [
          {
            id: randomId("ticket"),
            subject: "How is my estimated INI return calculated?",
            body: "I want to understand which power rate and uptime assumptions are included in the calculator.",
            status: "answered",
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          },
        ],
      },
    ],
    announcements: [
      {
        id: randomId("announce"),
        title: "Cooling optimization update",
        message: "Kaduna racks moved to revised airflow scheduling. No customer action required. Uptime targets remain unchanged.",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    auditLog: [
      {
        id: randomId("audit"),
        type: "system",
        detail: "Store initialized with preview accounts and plan library.",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function createSeedUser({ id, role, fullName, email, password, emailVerified, demoMode, walletBalance, pendingBalance }) {
  return {
    id,
    role,
    fullName,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    emailVerified,
    verificationCode: null,
    demoMode,
    walletBalance,
    pendingBalance,
    activeContracts: [],
    earningsHistory: [],
    withdrawals: [],
    notifications: [],
    twoFactor: {
      enabled: false,
      secret: null,
      pendingSecret: null,
    },
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    supportThreadId: null,
  };
}

async function routeRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    await handleApi(req, res, requestUrl);
    return;
  }

  serveStatic(requestUrl.pathname, res);
}

async function handleApi(req, res, requestUrl) {
  const store = readStore();
  const body = req.method === "POST" ? await readJsonBody(req) : null;

  if (req.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(res, 200, {
      status: "ok",
      service: BRAND.legal,
      time: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/public/overview") {
    sendJson(res, 200, buildPublicOverview(store));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/public/calculate") {
    const plan = store.plans.find((entry) => entry.id === body?.planId) || store.plans[0];
    const coinSymbol = body?.coin || plan.supportedCoins[0];
    const electricityRate = clampNumber(body?.electricityRate, 0.03, 0.25, 0.08);
    const termMonths = clampNumber(body?.termMonths, 3, 36, plan.defaultTermMonths);
    const estimate = estimatePlan(plan, buildMarketState(), coinSymbol, electricityRate, termMonths);
    sendJson(res, 200, {
      estimate,
      disclaimer: "Returns vary based on network difficulty, uptime, token price, and energy costs.",
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/register") {
    handleRegister(store, body, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/login") {
    handleLogin(store, body, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/verify-email") {
    handleVerifyEmail(store, body, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/auth/session") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/two-factor/setup") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    const secret = generateBase32Secret(20);
    user.twoFactor.pendingSecret = secret;
    writeStore(store);
    sendJson(res, 200, {
      secret,
      issuer: BRAND.name,
      account: user.email,
      otpauthUri: `otpauth://totp/${encodeURIComponent(BRAND.name)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(BRAND.name)}`,
      note: "Add this secret to Google Authenticator or another TOTP app, then submit a 6-digit code to enable 2FA.",
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/two-factor/enable") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    const secret = user.twoFactor.pendingSecret;
    if (!secret) {
      sendJson(res, 400, { error: "Start 2FA setup first." });
      return;
    }
    if (!verifyTotp(secret, String(body?.code || ""))) {
      sendJson(res, 400, { error: "The authenticator code is invalid." });
      return;
    }
    user.twoFactor.enabled = true;
    user.twoFactor.secret = secret;
    user.twoFactor.pendingSecret = null;
    addNotification(user, "Two-factor enabled", "Authenticator verification is now required during login.", "success");
    writeStore(store);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/two-factor/disable") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    if (!user.twoFactor.enabled || !user.twoFactor.secret) {
      sendJson(res, 400, { error: "Two-factor is not enabled." });
      return;
    }
    if (!verifyTotp(user.twoFactor.secret, String(body?.code || ""))) {
      sendJson(res, 400, { error: "The authenticator code is invalid." });
      return;
    }
    user.twoFactor.enabled = false;
    user.twoFactor.secret = null;
    user.twoFactor.pendingSecret = null;
    addNotification(user, "Two-factor disabled", "Your account now uses password-only authentication.", "warning");
    writeStore(store);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/dashboard/summary") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    sendJson(res, 200, buildDashboardSummary(user, store));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/dashboard/withdraw") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    handleWithdrawal(store, user, body, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/dashboard/demo-mode") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    const enabled = Boolean(body?.enabled);
    user.demoMode = enabled;
    if (enabled && user.activeContracts.length === 0) {
      user.walletBalance += 500;
      user.pendingBalance += 28;
      user.activeContracts.push(createContract("zec-z15-pro", "ZEC", 0.08, 12, 4));
      user.earningsHistory = buildHistoricalEarnings(user.activeContracts, 30);
    }
    addNotification(user, enabled ? "Guided onboarding enabled" : "Guided onboarding paused", enabled ? "A guided portfolio walkthrough is available in your dashboard." : "Guided onboarding is paused, but your saved history remains visible.", "info");
    writeStore(store);
    sendJson(res, 200, { success: true, demoMode: user.demoMode });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/dashboard/tickets") {
    const user = requireUser(req, store, res);
    if (!user) {
      return;
    }
    handleTicket(store, user, body, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/admin/overview") {
    const admin = requireAdmin(req, store, res);
    if (!admin) {
      return;
    }
    sendJson(res, 200, buildAdminOverview(store));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/admin/adjust") {
    const admin = requireAdmin(req, store, res);
    if (!admin) {
      return;
    }
    handleAdjustment(store, admin, body, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/admin/broadcast") {
    const admin = requireAdmin(req, store, res);
    if (!admin) {
      return;
    }
    handleBroadcast(store, admin, body, res);
    return;
  }

  sendJson(res, 404, { error: "Route not found." });
}

function handleRegister(store, body, res) {
  const fullName = String(body?.fullName || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const demoMode = Boolean(body?.demoMode);

  if (!fullName || !email || !password) {
    sendJson(res, 400, { error: "Name, email, and password are required." });
    return;
  }

  if (store.users.some((user) => user.email === email)) {
    sendJson(res, 400, { error: "An account with that email already exists." });
    return;
  }

  const user = createSeedUser({
    id: randomId("user"),
    role: "user",
    fullName,
    email,
    password,
    emailVerified: false,
    demoMode,
    walletBalance: demoMode ? 500 : 0,
    pendingBalance: demoMode ? 24 : 0,
  });

  if (demoMode) {
    user.activeContracts.push(createContract("zec-z15-pro", "ZEC", 0.08, 12, 3));
    user.earningsHistory = buildHistoricalEarnings(user.activeContracts, 30);
    addNotification(user, "Onboarding workspace ready", "We provisioned a guided starter contract so you can review dashboards and withdrawals before activating additional capacity.", "info");
  }

  user.verificationCode = generateCode();
  const thread = createSupportThread(user);
  user.supportThreadId = thread.id;

  store.users.push(user);
  store.supportThreads.push(thread);
  writeStore(store);

  writeEmailPreview(email, "Verify your Northstar email", `Verification code: ${user.verificationCode}`);

  sendJson(res, 201, {
    success: true,
    message: "Account created. Verify your email to continue.",
    previewCode: user.verificationCode,
  });
}

function handleLogin(store, body, res) {
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const code = String(body?.code || "");
  const user = store.users.find((entry) => entry.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    sendJson(res, 401, { error: "Invalid email or password." });
    return;
  }

  if (!user.emailVerified) {
    sendJson(res, 403, {
      error: "Verify your email before signing in.",
      requiresVerification: true,
      previewCode: user.verificationCode,
    });
    return;
  }

  if (user.twoFactor.enabled) {
    if (!verifyTotp(user.twoFactor.secret, code)) {
      sendJson(res, 403, {
        error: "Authenticator code required.",
        requiresTwoFactor: true,
      });
      return;
    }
  }

  user.lastLoginAt = new Date().toISOString();
  writeStore(store);

  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    exp: Date.now() + 7 * 86400000,
  });

  sendJson(res, 200, {
    token,
    user: sanitizeUser(user),
  });
}

function handleVerifyEmail(store, body, res) {
  const email = String(body?.email || "").trim().toLowerCase();
  const code = String(body?.code || "").trim();
  const user = store.users.find((entry) => entry.email === email);

  if (!user || !user.verificationCode) {
    sendJson(res, 400, { error: "No verification is pending for that email." });
    return;
  }

  if (user.verificationCode !== code) {
    sendJson(res, 400, { error: "The verification code is invalid." });
    return;
  }

  user.emailVerified = true;
  user.verificationCode = null;
  addNotification(user, "Email verified", "Your account can now access the live dashboard and support desk.", "success");
  writeStore(store);

  sendJson(res, 200, { success: true });
}

function handleWithdrawal(store, user, body, res) {
  const amountUsd = clampNumber(body?.amountUsd, 50, 100000, 0);
  const asset = String(body?.asset || "").trim().toUpperCase();
  const network = String(body?.network || "").trim();
  const address = String(body?.address || "").trim();
  const assetConfig = WITHDRAWAL_OPTIONS[asset];

  if (!amountUsd || !asset || !network || !address) {
    sendJson(res, 400, { error: "Withdrawal amount, asset, network, and wallet address are required." });
    return;
  }

  if (!assetConfig || !assetConfig.networks.includes(network)) {
    sendJson(res, 400, { error: "Select a supported asset and network combination." });
    return;
  }

  if (amountUsd > user.walletBalance) {
    sendJson(res, 400, { error: "Withdrawal exceeds available wallet balance." });
    return;
  }

  user.walletBalance = round(user.walletBalance - amountUsd, 2);
  const createdAt = new Date().toISOString();
  const withdrawal = {
    id: randomId("wd"),
    amountUsd,
    asset,
    assetLabel: assetConfig.label,
    network,
    address,
    createdAt,
    status: "pending-review",
  };
  user.withdrawals.unshift(withdrawal);
  const thread = getOrCreateThread(store, user);
  thread.title = `Withdrawal review • ${asset} • ${NorthstarAmount(amountUsd)}`;
  thread.priority = "high";
  thread.status = "withdrawal-review";
  thread.updatedAt = createdAt;
  thread.messages.push(
    createSupportMessage(
      "system",
      "Northstar Bot",
      `Withdrawal request received: ${NorthstarAmount(amountUsd)} in ${assetConfig.label} on ${network}. Our operations desk has been notified and will use this chat to confirm wallet details and release timing.`
    )
  );
  thread.messages.push(
    createSupportMessage(
      "user",
      user.fullName,
      `Withdrawal requested: ${NorthstarAmount(amountUsd)} | Asset: ${assetConfig.label} (${asset}) | Network: ${network} | Wallet: ${address}`
    )
  );
  addNotification(
    user,
    "Withdrawal queued",
    `A ${NorthstarAmount(amountUsd)} ${asset} withdrawal on ${network} was queued for address verification and fraud review. The operations desk can continue in the live chat below.`,
    "warning"
  );
  store.auditLog.unshift({
    id: randomId("audit"),
    type: "withdrawal",
    detail: `${user.email} requested ${amountUsd.toFixed(2)} USD in ${asset} on ${network} to ${address}.`,
    createdAt,
  });
  writeStore(store);
  writeEmailPreview(
    user.email,
    "Withdrawal request received",
    `Withdrawal amount: ${NorthstarAmount(amountUsd)}\nAsset: ${assetConfig.label} (${asset})\nNetwork: ${network}\nAddress: ${address}`
  );
  writeEmailPreview(
    "ops@northstar.demo",
    "New withdrawal request",
    `User: ${user.fullName} <${user.email}>\nAmount: ${NorthstarAmount(amountUsd)}\nAsset: ${assetConfig.label} (${asset})\nNetwork: ${network}\nAddress: ${address}\nThread: ${thread.id}`
  );
  broadcastThreadUpdate(store, thread.id);

  sendJson(res, 200, { success: true });
}

function handleTicket(store, user, body, res) {
  const subject = String(body?.subject || "").trim();
  const message = String(body?.message || "").trim();
  const thread = getOrCreateThread(store, user);

  if (!subject || !message) {
    sendJson(res, 400, { error: "Ticket subject and message are required." });
    return;
  }

  thread.tickets.unshift({
    id: randomId("ticket"),
    subject,
    body: message,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  thread.messages.push(createSupportMessage("user", user.fullName, message));
  thread.updatedAt = new Date().toISOString();
  addNotification(user, "Support ticket received", "Our operations team will respond in the ticket feed or live chat.", "info");
  writeStore(store);
  broadcastThreadUpdate(store, thread.id);
  sendJson(res, 201, { success: true });
}

function handleAdjustment(store, admin, body, res) {
  const userId = String(body?.userId || "");
  const amountUsd = Number(body?.amountUsd || 0);
  const note = String(body?.note || "").trim();
  const user = store.users.find((entry) => entry.id === userId && entry.role === "user");

  if (!user || !Number.isFinite(amountUsd) || !note) {
    sendJson(res, 400, { error: "User, adjustment amount, and note are required." });
    return;
  }

  user.walletBalance = round(user.walletBalance + amountUsd, 2);
  addNotification(user, "Balance adjustment posted", `${note} (${amountUsd >= 0 ? "+" : ""}$${amountUsd.toFixed(2)})`, amountUsd >= 0 ? "success" : "warning");
  store.auditLog.unshift({
    id: randomId("audit"),
    type: "adjustment",
    detail: `${admin.email} adjusted ${user.email} by ${amountUsd.toFixed(2)} USD. Note: ${note}`,
    createdAt: new Date().toISOString(),
  });
  writeStore(store);
  broadcastThreadUpdate(store, user.supportThreadId);
  sendJson(res, 200, { success: true });
}

function handleBroadcast(store, admin, body, res) {
  const title = String(body?.title || "").trim();
  const message = String(body?.message || "").trim();

  if (!title || !message) {
    sendJson(res, 400, { error: "Broadcast title and message are required." });
    return;
  }

  const announcement = {
    id: randomId("announce"),
    title,
    message,
    createdAt: new Date().toISOString(),
  };
  store.announcements.unshift(announcement);

  store.users
    .filter((user) => user.role === "user")
    .forEach((user) => {
      addNotification(user, title, message, "info");
      writeEmailPreview(user.email, title, message);
    });

  store.auditLog.unshift({
    id: randomId("audit"),
    type: "broadcast",
    detail: `${admin.email} published announcement "${title}".`,
    createdAt: new Date().toISOString(),
  });

  writeStore(store);
  broadcastMarketSnapshot();
  sendJson(res, 200, { success: true });
}

function buildPublicOverview(store) {
  const market = buildMarketState();
  const plans = store.plans.map((plan) => ({
    ...plan,
    estimates: plan.supportedCoins.map((coinSymbol) =>
      estimatePlan(plan, market, coinSymbol, 0.08, plan.defaultTermMonths)
    ),
  }));

  const activeContracts = getAllContracts(store);
  const liveContracts = activeContracts.map((contract) => enrichContract(contract, market));
  const aggregatePowerKw = liveContracts.reduce((sum, contract) => sum + contract.powerWatts / 1000, 0);
  const aggregateHashrateHs = liveContracts.reduce((sum, contract) => sum + contract.hashrateHs, 0);
  const aggregateDailyUsd = liveContracts.reduce((sum, contract) => sum + contract.netDailyUsd, 0);
  const snapshot = {
    totalHashrateLabel: formatHashrate(aggregateHashrateHs),
    activeMiners: Math.max(96, activeContracts.length * 38),
    dailyEstimateLabel: `$${aggregateDailyUsd.toFixed(0)} / day`,
    powerDrawLabel: aggregatePowerKw >= 1000 ? `${(aggregatePowerKw / 1000).toFixed(1)} MW deployed` : `${aggregatePowerKw.toFixed(0)} kW deployed`,
  };

  return {
    brand: BRAND,
    company: store.company,
    supportProfile: store.supportProfile,
    faqs: store.faqs,
    disclosures: store.disclosures,
    plans,
    hardware: store.hardware,
    market: mapValues(market, (coin) => ({
      symbol: coin.symbol,
      name: coin.name,
      priceUsd: coin.priceUsd,
      difficulty: coin.difficulty,
      priceChange24hPct: coin.priceChange24hPct,
      networkHashrateLabel: formatHashrate(coin.networkHashrateHs, coin.unit),
      algorithm: coin.algorithm,
    })),
    heroStats: snapshot,
    announcements: store.announcements.slice(0, 3),
    trustPoints: [
      "Machine-level operating assumptions published with each plan",
      "Live profitability estimates refreshed from dynamic market inputs",
      "Risk disclosure, power costs, and uptime targets visible before sign-up",
    ],
    roadmap: [
      {
        title: "Select hardware",
        detail: "Compare hashrate, power draw, algorithm, and estimated margin under your electricity assumptions.",
      },
      {
        title: "Model the scenario",
        detail: "Adjust coin, term, and cost inputs to see variable yield ranges instead of fixed promises.",
      },
      {
        title: "Operate with oversight",
        detail: "Track balances, contracts, uptime, and support tickets from one dashboard after login.",
      },
    ],
    transparency: {
      dataCenterImages: ["/assets/datacenter-1.svg", "/assets/datacenter-2.svg"],
      operatingModel:
        "Northstar hosts ASIC fleets in tiered facilities and publishes the exact energy, maintenance, and uptime assumptions used in the calculator so users can assess downside as well as upside.",
      legal:
        "Displayed estimates are generated from current operating assumptions, current market inputs, and fleet-level optimization settings. Returns remain variable and should be confirmed before purchase.",
    },
  };
}

function buildDashboardSummary(user, store) {
  const market = buildMarketState();
  const contracts = user.activeContracts.map((contract) => enrichContract(contract, market));
  const dailyUsd = contracts.reduce((sum, contract) => sum + contract.netDailyUsd, 0);
  const monthlyUsd = contracts.reduce((sum, contract) => sum + contract.netMonthlyUsd, 0);
  const powerKw = contracts.reduce((sum, contract) => sum + contract.powerWatts / 1000, 0);
  const thread = getOrCreateThread(store, user);

  return {
    user: sanitizeUser(user),
    metrics: {
      walletBalanceUsd: round(user.walletBalance, 2),
      pendingBalanceUsd: round(user.pendingBalance, 2),
      estimatedDailyUsd: round(dailyUsd, 2),
      estimatedMonthlyUsd: round(monthlyUsd, 2),
      deployedPowerKw: round(powerKw, 2),
      totalContracts: contracts.length,
      riskLabel: "Estimates depend on market price, difficulty, power cost, and uptime.",
    },
    contracts,
    earningsHistory: user.earningsHistory.slice(-30),
    withdrawals: user.withdrawals.slice(0, 8),
    withdrawalOptions: WITHDRAWAL_OPTIONS,
    notifications: user.notifications.slice(0, 10),
    support: sanitizeThread(thread, store, user),
    announcements: store.announcements.slice(0, 3),
    market: mapValues(market, (coin) => ({
      symbol: coin.symbol,
      priceUsd: coin.priceUsd,
      difficulty: coin.difficulty,
      priceChange24hPct: coin.priceChange24hPct,
    })),
  };
}

function buildAdminOverview(store) {
  const users = store.users.filter((user) => user.role === "user");
  const pendingWithdrawals = users.flatMap((user) => user.withdrawals.filter((item) => item.status !== "completed"));
  const activeContracts = getAllContracts(store);
  const estimatedDailyPayout = activeContracts
    .map((contract) => enrichContract(contract, buildMarketState()))
    .reduce((sum, contract) => sum + contract.netDailyUsd, 0);

  return {
    metrics: {
      totalUsers: users.length,
      verifiedUsers: users.filter((user) => user.emailVerified).length,
      activeContracts: activeContracts.length,
      pendingWithdrawals: pendingWithdrawals.length,
      openThreads: store.supportThreads.filter((thread) => thread.status !== "resolved").length,
      estimatedDailyPayoutUsd: round(estimatedDailyPayout, 2),
    },
    users: users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactor.enabled,
      walletBalanceUsd: round(user.walletBalance, 2),
      pendingBalanceUsd: round(user.pendingBalance, 2),
      contractCount: user.activeContracts.length,
      demoMode: user.demoMode,
      lastLoginAt: user.lastLoginAt,
    })),
    threads: store.supportThreads
      .slice()
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((thread) => sanitizeThread(thread, store, null)),
    pendingWithdrawals: pendingWithdrawals
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((item) => {
        const owner = users.find((user) => user.withdrawals.some((withdrawal) => withdrawal.id === item.id));
        return {
          ...item,
          userId: owner?.id || null,
          userName: owner?.fullName || "Unknown user",
          userEmail: owner?.email || null,
          threadId: owner?.supportThreadId || null,
        };
      }),
    announcements: store.announcements.slice(0, 5),
    auditLog: store.auditLog.slice(0, 12),
  };
}

function createContract(planId, coinSymbol, electricityRate, termMonths, startedDaysAgo) {
  const plan = PLAN_LIBRARY.find((entry) => entry.id === planId) || PLAN_LIBRARY[0];
  return {
    id: randomId("contract"),
    planId: plan.id,
    name: plan.name,
    algorithm: plan.algorithm,
    coinSymbol,
    supportedCoins: plan.supportedCoins,
    hashrateHs: plan.hashrateHs,
    hashrateLabel: plan.hashrateLabel,
    powerWatts: plan.powerWatts,
    powerLabel: plan.powerLabel,
    efficiencyLabel: plan.efficiencyLabel,
    electricityRate,
    termMonths,
    dataCenter: plan.dataCenter,
    startingPriceUsd: plan.startingPriceUsd,
    hardwarePriceUsd: plan.hardwarePriceUsd,
    startedAt: new Date(Date.now() - startedDaysAgo * 86400000).toISOString(),
    uptimeTargetPct: plan.uptimeTargetPct,
    hostingFeeDailyUsd: plan.hostingFeeDailyUsd,
  };
}

function buildHistoricalEarnings(contracts, days) {
  const history = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const timestamp = Date.now() - index * 86400000;
    const market = buildMarketState(timestamp);
    let gross = 0;
    let energy = 0;
    let net = 0;
    contracts.forEach((contract, position) => {
      const estimate = enrichContract(contract, market);
      const drift = 1 + Math.sin(timestamp / 86400000 + position) * 0.04;
      gross += estimate.grossDailyUsd * drift;
      energy += estimate.energyDailyUsd;
      net += estimate.netDailyUsd * drift;
    });
    history.push({
      date: new Date(timestamp).toISOString().slice(0, 10),
      grossUsd: round(gross, 2),
      energyUsd: round(energy, 2),
      netUsd: round(net, 2),
    });
  }
  return history;
}

function enrichContract(contract, market) {
  const libraryPlan = PLAN_LIBRARY.find((entry) => entry.id === contract.planId);
  const estimate = estimatePlan(
    {
      id: contract.planId,
      name: contract.name,
      supportedCoins: [contract.coinSymbol],
      hashrateHs: contract.hashrateHs,
      hashrateLabel: contract.hashrateLabel,
      powerWatts: contract.powerWatts,
      powerLabel: contract.powerLabel,
      efficiencyLabel: contract.efficiencyLabel,
      startingPriceUsd: contract.startingPriceUsd ?? libraryPlan?.startingPriceUsd ?? 200,
      hardwarePriceUsd: contract.hardwarePriceUsd,
      hostingFeeDailyUsd: contract.hostingFeeDailyUsd,
      uptimeTargetPct: contract.uptimeTargetPct,
      defaultTermMonths: contract.termMonths,
      algorithm: contract.algorithm,
      dataCenter: contract.dataCenter,
    },
    market,
    contract.coinSymbol,
    contract.electricityRate,
    contract.termMonths
  );

  const startedAt = Date.parse(contract.startedAt);
  const elapsedDays = Math.max(1, Math.floor((Date.now() - startedAt) / 86400000));
  const progressPct = Math.min(100, round((elapsedDays / (contract.termMonths * 30)) * 100, 1));

  return {
    ...contract,
    ...estimate,
    progressPct,
  };
}

function estimatePlan(plan, market, coinSymbol, electricityRate, termMonths) {
  const coin = market[coinSymbol];
  if (!coin) {
    return {
      coinSymbol,
      error: "Unsupported coin",
    };
  }

  const shareOfNetwork = plan.hashrateHs / coin.networkHashrateHs;
  const blocksPerDay = 86400 / coin.blockTimeSeconds;
  const grossCoinsPerDay = shareOfNetwork * blocksPerDay * coin.blockReward * (1 - coin.poolFee);
  const baseGrossDailyUsd = grossCoinsPerDay * coin.priceUsd;
  const grossDailyUsd = baseGrossDailyUsd * YIELD_OPTIMIZATION_FACTOR;
  const energyDailyUsd = (plan.powerWatts * 24 * electricityRate) / 1000;
  const netDailyUsd = grossDailyUsd - energyDailyUsd - plan.hostingFeeDailyUsd;
  const netMonthlyUsd = netDailyUsd * 30;
  const roiMonths = netMonthlyUsd > 0 ? plan.hardwarePriceUsd / netMonthlyUsd : null;
  const varianceBand = Math.abs(grossDailyUsd) * coin.volatility * 1.5;

  return {
    planId: plan.id,
    coinSymbol,
    coinName: coin.name,
    algorithm: coin.algorithm,
    electricityRate,
    termMonths,
    priceUsd: round(coin.priceUsd, 2),
    networkHashrateLabel: formatHashrate(coin.networkHashrateHs, coin.unit),
    grossCoinsPerDay: round(grossCoinsPerDay, 8),
    grossDailyUsd: round(grossDailyUsd, 2),
    optimizationFactorPct: YIELD_OPTIMIZATION_PCT,
    energyDailyUsd: round(energyDailyUsd, 2),
    hostingFeeDailyUsd: round(plan.hostingFeeDailyUsd, 2),
    netDailyUsd: round(netDailyUsd, 2),
    netMonthlyUsd: round(netMonthlyUsd, 2),
    lowCaseUsd: round(netDailyUsd - varianceBand, 2),
    highCaseUsd: round(netDailyUsd + varianceBand, 2),
    roiMonths: roiMonths ? round(roiMonths, 1) : null,
    startingPriceUsd: plan.startingPriceUsd,
    disclaimer: "Estimated returns only. Market conditions and network difficulty can materially change outcomes.",
  };
}

function buildMarketState(atTime = Date.now()) {
  const second = atTime / 1000;

  return mapValues(COIN_PROFILES, (coin, index) => {
    const waveA = Math.sin(second / coin.waveIntervalSeconds + index);
    const waveB = Math.cos(second / (coin.waveIntervalSeconds * 1.8) + index * 0.73);
    const priceFactor = 1 + waveA * coin.volatility + waveB * (coin.volatility / 2);
    const networkFactor = 1 + waveA * (coin.volatility / 1.7);
    const difficultyFactor = 1 + waveB * (coin.volatility / 1.2);

    return {
      ...coin,
      priceUsd: round(coin.basePriceUsd * priceFactor, 2),
      networkHashrateHs: coin.baseNetworkHashrateHs * networkFactor,
      difficulty: round(coin.baseDifficulty * difficultyFactor, 2),
      priceChange24hPct: round((priceFactor - 1) * 100, 2),
    };
  });
}

function readStore() {
  const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  store.company = COMPANY;
  store.supportProfile = SUPPORT_PROFILE;
  store.plans = PLAN_LIBRARY;
  store.hardware = HARDWARE_LIBRARY;
  store.faqs = FAQS;
  store.disclosures = DISCLOSURES;
  store.users = (store.users || []).map((user) => ({
    ...user,
    withdrawals: (user.withdrawals || []).map((item) => ({
      ...item,
      asset: item.asset || "BTC",
      assetLabel: item.assetLabel || "Bitcoin",
      network: item.network || "Bitcoin",
    })),
  }));
  return store;
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 1_000_000) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(requestPath, res) {
  const routes = {
    "/": "index.html",
    "/dashboard": "dashboard.html",
    "/admin": "admin.html",
  };
  const relativePath = routes[requestPath] || requestPath.replace(/^\/+/, "");
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(body);
}

function signToken(payload) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) {
    return null;
  }
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    return null;
  }
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(`${header}.${body}`).digest("base64url");
  if (signature !== expected) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length);
}

function requireUser(req, store, res) {
  const token = getBearerToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { error: "Authentication required." });
    return null;
  }
  const user = store.users.find((entry) => entry.id === payload.sub);
  if (!user) {
    sendJson(res, 401, { error: "Account not found." });
    return null;
  }
  return user;
}

function requireAdmin(req, store, res) {
  const user = requireUser(req, store, res);
  if (!user) {
    return null;
  }
  if (user.role !== "admin") {
    sendJson(res, 403, { error: "Admin access required." });
    return null;
  }
  return user;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    emailVerified: user.emailVerified,
    demoMode: user.demoMode,
    twoFactorEnabled: user.twoFactor.enabled,
    walletBalanceUsd: round(user.walletBalance, 2),
    pendingBalanceUsd: round(user.pendingBalance, 2),
    lastLoginAt: user.lastLoginAt,
  };
}

function sanitizeThread(thread, store, viewer) {
  const user = store.users.find((entry) => entry.id === thread.userId);
  const messages = thread.messages.slice(-20);
  return {
    id: thread.id,
    title: thread.title,
    status: thread.status,
    priority: thread.priority,
    updatedAt: thread.updatedAt,
    user: user
      ? {
          fullName: user.fullName,
          email: viewer?.role === "user" ? undefined : user.email,
        }
      : null,
    tickets: thread.tickets.slice(0, 8),
    messages,
  };
}

function addNotification(user, title, message, level) {
  user.notifications.unshift(createNotification(title, message, level));
}

function createNotification(title, message, level) {
  return {
    id: randomId("note"),
    title,
    message,
    level,
    createdAt: new Date().toISOString(),
  };
}

function createSupportThread(user) {
  return {
    id: randomId("thread"),
    userId: user.id,
    status: "open",
    title: "New account onboarding",
    priority: user.demoMode ? "normal" : "high",
    updatedAt: new Date().toISOString(),
    messages: [createSupportMessage("system", "Northstar Bot", "Welcome. The support desk is here to answer onboarding, operations, and withdrawal questions.")],
    tickets: [],
  };
}

function getOrCreateThread(store, user) {
  let thread = store.supportThreads.find((entry) => entry.id === user.supportThreadId);
  if (!thread) {
    thread = createSupportThread(user);
    user.supportThreadId = thread.id;
    store.supportThreads.push(thread);
  }
  return thread;
}

function createSupportMessage(role, senderName, body) {
  return {
    id: randomId("msg"),
    role,
    senderName,
    body,
    createdAt: new Date().toISOString(),
  };
}

function writeEmailPreview(email, subject, message) {
  const fileName = `${Date.now()}-${email.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
  const content = `To: ${email}\nSubject: ${subject}\n\n${message}\n`;
  fs.writeFileSync(path.join(OUTBOX_DIR, fileName), content, "utf8");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) {
    return false;
  }
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateBase32Secret(length) {
  let output = "";
  const bytes = crypto.randomBytes(length);
  for (let index = 0; index < bytes.length; index += 1) {
    output += BASE32_ALPHABET[bytes[index] % BASE32_ALPHABET.length];
  }
  return output;
}

function decodeBase32(secret) {
  const clean = secret.replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const character of clean) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value < 0) {
      continue;
    }
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, atTime = Date.now()) {
  const key = decodeBase32(secret);
  const counter = Math.floor(atTime / 30000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

function verifyTotp(secret, token) {
  if (!secret || !/^\d{6}$/.test(token)) {
    return false;
  }
  const now = Date.now();
  return [-30000, 0, 30000].some((delta) => generateTotp(secret, now + delta) === token);
}

function handleUpgrade(req, socket) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto.createHash("sha1").update(`${key}${WS_MAGIC}`).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n")
  );

  const token = requestUrl.searchParams.get("token");
  const payload = verifyToken(token);
  const store = readStore();
  const user = payload ? store.users.find((entry) => entry.id === payload.sub) : null;
  const client = {
    socket,
    buffer: Buffer.alloc(0),
    user,
  };

  wsClients.add(client);
  sendWs(client, {
    type: "welcome",
    viewer: user ? sanitizeUser(user) : { role: "guest" },
  });
  sendWs(client, {
    type: "marketSnapshot",
    data: buildPublicOverview(store),
  });

  if (user?.supportThreadId) {
    sendWs(client, {
      type: "supportThread",
      data: sanitizeThread(getOrCreateThread(store, user), store, user),
    });
  }

  socket.on("data", (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    const parsed = readFrames(client.buffer);
    client.buffer = parsed.remaining;
    parsed.messages.forEach((message) => handleWsMessage(client, message));
  });

  socket.on("end", () => wsClients.delete(client));
  socket.on("close", () => wsClients.delete(client));
  socket.on("error", () => wsClients.delete(client));
}

function handleWsMessage(client, message) {
  if (message.type === "ping") {
    sendWs(client, { type: "pong", time: new Date().toISOString() });
    return;
  }

  if (message.type === "supportMessage" && client.user) {
    const store = readStore();
    const user = store.users.find((entry) => entry.id === client.user.id);
    if (!user) {
      return;
    }

    if (user.role === "admin" && message.threadId) {
      const targetThread = store.supportThreads.find((entry) => entry.id === message.threadId);
      if (targetThread && String(message.body || "").trim()) {
        targetThread.messages.push(createSupportMessage("admin", user.fullName, String(message.body || "").trim()));
        targetThread.updatedAt = new Date().toISOString();
        writeStore(store);
        broadcastThreadUpdate(store, message.threadId);
      }
      return;
    }

    const thread = getOrCreateThread(store, user);
    const body = String(message.body || "").trim();
    if (!body) {
      return;
    }
    thread.messages.push(createSupportMessage("user", user.fullName, body));
    thread.updatedAt = new Date().toISOString();
    writeStore(store);
    broadcastThreadUpdate(store, thread.id);
  }
}

function broadcastMarketSnapshot() {
  if (wsClients.size === 0) {
    return;
  }
  const store = readStore();
  const payload = {
    type: "marketSnapshot",
    data: buildPublicOverview(store),
  };
  wsClients.forEach((client) => sendWs(client, payload));
}

function broadcastThreadUpdate(store, threadId) {
  if (!threadId) {
    return;
  }
  const thread = store.supportThreads.find((entry) => entry.id === threadId);
  if (!thread) {
    return;
  }

  wsClients.forEach((client) => {
    if (!client.user) {
      return;
    }
    if (client.user.role === "admin" || client.user.id === thread.userId) {
      sendWs(client, {
        type: "supportThread",
        data: sanitizeThread(thread, store, client.user),
      });
    }
  });
}

function sendWs(client, payload) {
  if (!client || !client.socket || client.socket.destroyed) {
    return;
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8");
  client.socket.write(encodeFrame(encoded));
}

function encodeFrame(payload) {
  const length = payload.length;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }
  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function readFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const opcode = first & 0x0f;
    const second = buffer[offset + 1];
    const masked = Boolean(second & 0x80);
    let payloadLength = second & 0x7f;
    let headerLength = 2;

    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) {
        break;
      }
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) {
        break;
      }
      payloadLength = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + payloadLength;
    if (offset + frameLength > buffer.length) {
      break;
    }

    const maskStart = offset + headerLength;
    const payloadStart = maskStart + maskLength;
    let payload = buffer.slice(payloadStart, payloadStart + payloadLength);

    if (masked) {
      const mask = buffer.slice(maskStart, maskStart + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }

    if (opcode === 0x1) {
      try {
        messages.push(JSON.parse(payload.toString("utf8")));
      } catch {
        // Ignore malformed frames.
      }
    }

    offset += frameLength;
  }

  return {
    messages,
    remaining: buffer.slice(offset),
  };
}

function getAllContracts(store) {
  return store.users
    .filter((user) => user.role === "user")
    .flatMap((user) => user.activeContracts);
}

function formatHashrate(value, preferredUnit) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 H/s";
  }

  const units = [
    ["H/s", 1],
    ["kH/s", 1e3],
    ["MH/s", 1e6],
    ["GH/s", 1e9],
    ["kSol/s", 1e3],
    ["MSol/s", 1e6],
    ["GSol/s", 1e9],
    ["TH/s", 1e12],
    ["PH/s", 1e15],
    ["EH/s", 1e18],
  ];

  if (preferredUnit) {
    const preferred = units.find((entry) => entry[0] === preferredUnit);
    if (preferred) {
      return `${round(value / preferred[1], value / preferred[1] >= 100 ? 0 : 2)} ${preferred[0]}`;
    }
  }

  let selected = units[0];
  units.forEach((entry) => {
    if (value >= entry[1]) {
      selected = entry;
    }
  });

  return `${round(value / selected[1], value / selected[1] >= 100 ? 0 : 2)} ${selected[0]}`;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function NorthstarAmount(value) {
  return `$${round(value, 2).toFixed(2)}`;
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function clampNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, numeric));
}

function mapValues(input, mapper) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value], index) => [key, mapper(value, index)])
  );
}
