const Northstar = (() => {
  const TOKEN_KEY = "northstar_token";

  function getToken() {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    window.localStorage.removeItem(TOKEN_KEY);
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || "Request failed.");
      Object.assign(error, payload);
      throw error;
    }
    return payload;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  function formatNumber(value, maximumFractionDigits = 2) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits,
    }).format(value || 0);
  }

  function formatDate(value) {
    if (!value) {
      return "Just now";
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function formatPercent(value) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${Number(value || 0).toFixed(2)}%`;
  }

  function connectSocket(onMessage) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const token = getToken();
    const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws${suffix}`);
    socket.addEventListener("message", (event) => {
      try {
        onMessage(JSON.parse(event.data), socket);
      } catch {
        // Ignore malformed websocket messages.
      }
    });
    return socket;
  }

  function signedClass(value) {
    return Number(value) >= 0 ? "positive" : "negative";
  }

  return {
    api,
    clearToken,
    connectSocket,
    formatCurrency,
    formatDate,
    formatNumber,
    formatPercent,
    getToken,
    setToken,
    signedClass,
  };
})();
