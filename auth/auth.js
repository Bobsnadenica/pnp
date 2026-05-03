(function () {
  const globalConfig = window.__PRIVATE_GALLERY_CONFIG__ || {};
  const siteLabel = globalConfig.projectSlug || "private-gallery";
  const sessionKey = `${siteLabel}:auth:session`;
  const pendingKey = `${siteLabel}:auth:pending`;
  const popupPendingKey = `${siteLabel}:auth:pendingPopup`;
  const popupMessageType = `${siteLabel}:auth:popupResult`;
  const popupName = `${siteLabel}:authPopup`;
  const loginAttemptKey = `${siteLabel}:auth:lastLoginStart`;
  const expirySkewMs = 60 * 1000;
  const popupTimeoutMs = 2 * 60 * 1000;
  const loginCooldownMs = 15 * 1000;
  const pendingStateMaxAgeMs = 10 * 60 * 1000;
  const pkceCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  function getBodyConfig() {
    return document.body?.dataset ?? {};
  }

  function getAppBaseUrl() {
    return globalConfig.websiteBaseUrl || window.location.origin;
  }

  function getConfig(overrides = {}) {
    const bodyConfig = getBodyConfig();
    const appBaseUrl = getAppBaseUrl();

    return {
      appBaseUrl,
      baseUrl: overrides.baseUrl || bodyConfig.authBaseUrl || globalConfig.authBaseUrl || "",
      clientId: overrides.clientId || bodyConfig.authClientId || globalConfig.authClientId || "",
      redirectUri:
        overrides.redirectUri ||
        bodyConfig.authRedirectUri ||
        `${appBaseUrl}/auth/callback.html`,
      logoutUri:
        overrides.logoutUri ||
        bodyConfig.authLogoutUri ||
        `${appBaseUrl}/`,
      scope:
        overrides.scope ||
        bodyConfig.authScope ||
        globalConfig.authScope ||
        "openid email profile aws.cognito.signin.user.admin",
    };
  }

  function getStoragePayload(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Unable to parse stored auth payload.", error);
      return null;
    }
  }

  function setStoragePayload(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function readLastLoginAttemptAt() {
    try {
      return Number.parseInt(localStorage.getItem(loginAttemptKey) || "0", 10) || 0;
    } catch (error) {
      console.warn("Unable to read login attempt state.", error);
      return 0;
    }
  }

  function writeLastLoginAttemptAt(value) {
    try {
      localStorage.setItem(loginAttemptKey, String(value));
    } catch (error) {
      console.warn("Unable to persist login attempt state.", error);
    }
  }

  function enforceLoginCooldown() {
    const lastAttemptAt = readLastLoginAttemptAt();
    const remainingMs = loginCooldownMs - (Date.now() - lastAttemptAt);

    if (remainingMs > 0) {
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      throw new Error(`Please wait ${remainingSeconds} seconds before trying to sign in again.`);
    }
  }

  function clearPendingState() {
    sessionStorage.removeItem(pendingKey);
    localStorage.removeItem(popupPendingKey);
  }

  function getPendingState() {
    return getStoragePayload(sessionStorage, pendingKey);
  }

  function getPopupPendingState() {
    return getStoragePayload(localStorage, popupPendingKey);
  }

  function getMatchingPendingState(expectedState) {
    const directPending = getPendingState();
    const popupPending = getPopupPendingState();

    if (popupPending?.state === expectedState) {
      return { pending: popupPending, kind: "popup" };
    }

    if (directPending?.state === expectedState) {
      return { pending: directPending, kind: "direct" };
    }

    return null;
  }

  function clearStoredPending(kind) {
    if (kind === "popup") {
      localStorage.removeItem(popupPendingKey);
      return;
    }

    sessionStorage.removeItem(pendingKey);
  }

  function clearSession() {
    sessionStorage.removeItem(sessionKey);
    localStorage.removeItem(sessionKey);
  }

  function getStoredSession() {
    return (
      getStoragePayload(localStorage, sessionKey) ||
      getStoragePayload(sessionStorage, sessionKey)
    );
  }

  function isRememberedSession() {
    return Boolean(localStorage.getItem(sessionKey));
  }

  function saveSession(session, remember) {
    clearSession();
    const storage = remember ? localStorage : sessionStorage;
    setStoragePayload(storage, sessionKey, session);
  }

  function completePopupLogin(payload) {
    if (!payload?.session) {
      throw new Error("Missing popup session payload.");
    }

    saveSession(payload.session, Boolean(payload.remember));
    localStorage.removeItem(popupPendingKey);
    return payload.session;
  }

  function generateRandomString(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    let result = "";
    for (let index = 0; index < bytes.length; index += 1) {
      result += pkceCharset[bytes[index] % pkceCharset.length];
    }

    return result;
  }

  function toBase64Url(uint8Array) {
    const binary = String.fromCharCode(...uint8Array);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function createCodeChallenge(verifier) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier)
    );

    return toBase64Url(new Uint8Array(digest));
  }

  function decodeJwt(token) {
    const parts = token.split(".");

    if (parts.length < 2) {
      return null;
    }

    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

    try {
      return JSON.parse(atob(padded));
    } catch (error) {
      console.warn("Unable to decode JWT payload.", error);
      return null;
    }
  }

  function getReturnPath() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
  }

  function getGalleryCollection() {
    return "extra";
  }

  function getGalleryDestination() {
    return "/gallery/";
  }

  function getPopupFeatures() {
    const width = 460;
    const height = 760;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

    return [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      "popup=yes",
      "resizable=yes",
      "scrollbars=yes",
    ].join(",");
  }

  function openAuthPopup() {
    const popup = window.open("", popupName, getPopupFeatures());

    if (!popup) {
      return null;
    }

    try {
      popup.document.title = "Secure Sign In";
      popup.document.body.style.margin = "0";
      popup.document.body.style.fontFamily = "Inter, sans-serif";
      popup.document.body.style.minHeight = "100vh";
      popup.document.body.style.display = "grid";
      popup.document.body.style.placeItems = "center";
      popup.document.body.style.background = "linear-gradient(180deg, #fdf8f0 0%, #ffffff 100%)";
      popup.document.body.innerHTML =
        '<div style="padding:24px 28px;border-radius:24px;background:white;box-shadow:0 24px 60px -24px rgba(15,23,42,0.24);text-align:center;color:#8a5a10;font-size:15px;line-height:1.6;">Opening secure sign-in...</div>';
    } catch (error) {
      console.warn("Unable to paint popup loading state.", error);
    }

    return popup;
  }

  async function startLogin(options = {}) {
    enforceLoginCooldown();

    const config = getConfig(options);
    const usePopup = Boolean(options.popup);
    const popupWindow = usePopup ? openAuthPopup() : null;

    if (!config.baseUrl || !config.clientId) {
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
      throw new Error("Missing Cognito Hosted UI configuration.");
    }

    if (usePopup && !popupWindow) {
      throw new Error("Please allow the secure sign-in popup to continue.");
    }

    const verifier = generateRandomString(96);
    const challenge = await createCodeChallenge(verifier);
    const state = generateRandomString(48);
    const nonce = generateRandomString(48);

    const pendingPayload = {
      verifier,
      state,
      remember: Boolean(options.remember),
      returnTo: options.returnTo || getReturnPath(),
      createdAt: Date.now(),
    };

    if (usePopup) {
      setStoragePayload(localStorage, popupPendingKey, pendingPayload);
    } else {
      setStoragePayload(sessionStorage, pendingKey, pendingPayload);
    }

    const url = new URL(`${config.baseUrl}/oauth2/authorize`);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scope);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);

    if (options.loginHint) {
      url.searchParams.set("login_hint", options.loginHint);
    }

    writeLastLoginAttemptAt(Date.now());

    if (usePopup) {
      return await new Promise((resolve, reject) => {
        let finished = false;
        let closePoll = null;
        let timeoutId = null;

        function cleanup() {
          finished = true;
          window.removeEventListener("message", onMessage);
          if (closePoll) {
            window.clearInterval(closePoll);
          }
          if (timeoutId) {
            window.clearTimeout(timeoutId);
          }
        }

        function onMessage(event) {
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data?.type !== popupMessageType) {
            return;
          }

          cleanup();

          if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
          }

          if (event.data.error) {
            reject(new Error(event.data.error));
            return;
          }

          resolve(event.data);
        }

        window.addEventListener("message", onMessage);
        closePoll = window.setInterval(() => {
          if (!finished && popupWindow?.closed) {
            cleanup();
            localStorage.removeItem(popupPendingKey);
            reject(new Error("Secure sign-in was closed before it finished."));
          }
        }, 350);

        timeoutId = window.setTimeout(() => {
          if (finished) {
            return;
          }

          cleanup();
          localStorage.removeItem(popupPendingKey);
          if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
          }
          reject(new Error("Secure sign-in timed out. Please try again."));
        }, popupTimeoutMs);

        popupWindow.location.assign(url.toString());
      });
    }

    window.location.assign(url.toString());
  }

  async function requestTokens(params) {
    const response = await fetch(params.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params.body),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error_description || payload?.error || "Token request failed.";
      throw new Error(message);
    }

    return payload;
  }

  async function handleCallback(options = {}) {
    const config = getConfig(options);
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");

    if (oauthError) {
      throw new Error(oauthErrorDescription || oauthError);
    }

    if (!code || !state) {
      throw new Error("Missing authorization code.");
    }

    const matchedPending = getMatchingPendingState(state);

    if (!matchedPending?.pending) {
      throw new Error("Missing stored login state.");
    }

    const { pending, kind } = matchedPending;

    if (pending.state !== state) {
      clearStoredPending(kind);
      throw new Error("State mismatch during secure sign-in.");
    }

    if ((pending.createdAt || 0) + pendingStateMaxAgeMs < Date.now()) {
      clearStoredPending(kind);
      throw new Error("Secure sign-in expired before it finished. Please try again.");
    }

    const tokenResponse = await requestTokens({
      tokenUrl: `${config.baseUrl}/oauth2/token`,
      body: {
        grant_type: "authorization_code",
        client_id: config.clientId,
        code,
        code_verifier: pending.verifier,
        redirect_uri: config.redirectUri,
      },
    });

    const claims = tokenResponse.id_token ? decodeJwt(tokenResponse.id_token) : null;
    const session = {
      tokens: tokenResponse,
      claims,
      expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      logoutUri: config.logoutUri,
    };

    if (kind === "popup") {
      clearStoredPending(kind);
    } else {
      saveSession(session, pending.remember);
      clearStoredPending(kind);
    }

    return {
      session,
      returnTo: pending.returnTo || "/",
      remember: Boolean(pending.remember),
      popup: kind === "popup",
    };
  }

  async function refreshSession(session, options = {}) {
    if (!session?.tokens?.refresh_token) {
      return null;
    }

    const config = getConfig(options);
    const refreshed = await requestTokens({
      tokenUrl: `${config.baseUrl}/oauth2/token`,
      body: {
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: session.tokens.refresh_token,
      },
    });

    const nextSession = {
      ...session,
      tokens: {
        ...session.tokens,
        ...refreshed,
        refresh_token: refreshed.refresh_token || session.tokens.refresh_token,
      },
      claims: refreshed.id_token ? decodeJwt(refreshed.id_token) : session.claims,
      expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      logoutUri: config.logoutUri,
    };

    saveSession(nextSession, isRememberedSession());
    return nextSession;
  }

  async function getSession(options = {}) {
    const session = getStoredSession();

    if (!session) {
      return null;
    }

    if (session.expiresAt && session.expiresAt > Date.now() + expirySkewMs) {
      return session;
    }

    try {
      return await refreshSession(session, options);
    } catch (error) {
      console.warn("Unable to refresh Cognito session.", error);
      clearSession();
      return null;
    }
  }

  function signOut(options = {}) {
    const config = getConfig(options);

    clearPendingState();
    clearSession();

    if (!config.baseUrl || !config.clientId) {
      window.location.assign(config.logoutUri || "/");
      return;
    }

    const url = new URL(`${config.baseUrl}/logout`);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("logout_uri", config.logoutUri);
    window.location.assign(url.toString());
  }

  window.PrivateGalleryAuth = {
    clearPendingState,
    clearSession,
    completePopupLogin,
    getConfig,
    getGalleryCollection,
    getGalleryDestination,
    getSession,
    handleCallback,
    signOut,
    startLogin,
  };
})();
