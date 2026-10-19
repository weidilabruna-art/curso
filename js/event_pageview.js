(function() {
  // Ensure the script doesn't run multiple times
  if (window.VKMetricsCoreLoaded || window.vkPageViewPixelScriptLoaded) return;
  window.vkPageViewPixelScriptLoaded = true;

  // More robust initialization:
  // Ensure the global object exists and has all necessary properties,
  // even if it was partially defined by the loader snippet.
  const pixel = window.vkPageViewPixel || {};
  window.vkPageViewPixel = pixel;
  pixel._q = pixel._q || [];
  pixel.trackedEvents = pixel.trackedEvents || new Set();
  pixel.init = pixel.init || function(clientId, conversionName) {
    this._q.push(['init', clientId, conversionName]);
  };

  console.log("VK Page View Pixel: Script loaded and initialized.");

  const CONFIG = {
    backendEndpoint: 'https://pixel.vkdigital.com.br/evento',
    cookieName: 'vk_user_uid',
    cookieTTL: 365 * 24 * 60, // 1 year in minutes
    qualifiedMs: 3000
  };

  let clientId = 'unknown_client';
  let userId = null;
  let trackingId = null;
  let sessionId = null;
  let urlParams = {};
  let pageViewConversionName = null;
  let pageViewTimer = null;
  let pageViewTickAt = 0;
  let pageViewAccumMs = 0;
  let pageViewVisibilityHooked = false;

  // Function to initialize the pixel
  function initializePixel(clientIdFromInit, conversionName) {
    clientId = clientIdFromInit || clientId;
    userId = getUserId();
    trackingId = getOrCreateTrackingId();
    sessionId = getOrCreateSessionId();
    urlParams = getUrlParams();
    
    console.log(`VK Page View Pixel: Initialized with Client ID: ${clientId}`);

    if (conversionName) {
      startQualifiedPageView(conversionName);
    }
  }

  // Process any commands that were queued before the script loaded
  const commands = window.vkPageViewPixel._q || [];
  while(commands.length > 0) {
    const command = commands.shift(); // Use shift to process in order
    const method = command[0];
    const args = command.slice(1);
    if (method === 'init') {
      initializePixel.apply(null, args);
    }
  }

  // --- Helper functions copied from pixel.js ---

  // Generate or retrieve the user ID
  function getUserId() {
    let uid = getCookie(CONFIG.cookieName);
    if (!uid) {
      uid = generateUUID();
      setCookie(CONFIG.cookieName, uid, CONFIG.cookieTTL);
    }
    return uid;
  }

  function generateUUID() {
    let d = new Date().getTime();
    if (window.performance && typeof window.performance.now === 'function') {
      d += performance.now(); // Use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Set a cookie
  function setCookie(name, value, minutes) {
    const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  }

  // Get a cookie
  function getCookie(name) {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let c of ca) {
      c = c.trim();
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
    }
    return null;
  }

  function readSessionValue(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function persistSessionValue(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) {}
  }

  function tryParseVkPayload(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.u) return parsed;
    } catch (e) {}
    return null;
  }

  function resolveTrackingIdFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromXcod = tryParseVkPayload(params.get('xcod'));
      if (fromXcod && fromXcod.u) return String(fromXcod.u);
      const fromContent = tryParseVkPayload(params.get('utm_content'));
      if (fromContent && fromContent.u) return String(fromContent.u);
    } catch (e) {}
    return null;
  }

  function getOrCreateSessionId() {
    let sid = readSessionValue('vk_session_id');
    if (!sid) {
      sid = generateUUID();
      persistSessionValue('vk_session_id', sid);
    }
    return sid;
  }

  function getOrCreateTrackingId() {
    let tid = readSessionValue('vk_tracking_id');
    if (tid) return tid;
    tid = resolveTrackingIdFromUrl() || generateUUID();
    persistSessionValue('vk_tracking_id', tid);
    return tid;
  }
  
  // Get all URL parameters
  function getUrlParams() {
    try {
      const params = {};
      const queryString = decodeURIComponent(window.location.search);
      new URLSearchParams(queryString).forEach((value, key) => {
        params[key] = value;
      });
      return params;
    } catch (error) {
      console.error('Error parsing URL parameters:', error);
      return {};
    }
  }

  // --- End of helper functions ---

  function stopPageViewTimer() {
    if (pageViewTimer) {
      clearInterval(pageViewTimer);
      pageViewTimer = null;
    }
    pageViewTickAt = 0;
  }

  function startQualifiedPageView(conversionName) {
    if (!conversionName) return;
    pageViewConversionName = conversionName;
    if (window.vkPageViewPixel.trackedEvents.has(conversionName)) return;

    stopPageViewTimer();
    pageViewAccumMs = 0;
    pageViewTickAt = document.visibilityState === 'visible' ? Date.now() : 0;

    pageViewTimer = setInterval(function() {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (pageViewTickAt) pageViewAccumMs += now - pageViewTickAt;
      pageViewTickAt = now;
      if (pageViewAccumMs >= CONFIG.qualifiedMs) {
        stopPageViewTimer();
        trackPageViewConversion(pageViewConversionName);
      }
    }, 250);

    if (!pageViewVisibilityHooked) {
      pageViewVisibilityHooked = true;
      document.addEventListener('visibilitychange', function() {
        if (!pageViewTimer) return;
        if (document.visibilityState === 'visible') {
          pageViewTickAt = Date.now();
        } else if (pageViewTickAt) {
          pageViewAccumMs += Date.now() - pageViewTickAt;
          pageViewTickAt = 0;
        }
      });
    }
  }

  function trackPageViewConversion(conversionName) {
    if (!conversionName) return;
    if (window.vkPageViewPixel.trackedEvents.has(conversionName)) return;

    window.vkPageViewPixel.trackedEvents.add(conversionName);

    const data = {
      eventType: 'page_view',
      conversionName: conversionName,
      url: encodeURIComponent(window.location.href),
      referrer: encodeURIComponent(document.referrer || ''),
      userAgent: encodeURIComponent(navigator.userAgent || ''),
      timestamp: new Date().toISOString(),
      userId: userId,
      clientId: clientId,
      urlParams: urlParams,
      trackingId: trackingId || getOrCreateTrackingId(),
      sessionId: sessionId || getOrCreateSessionId(),
      browserEventId: generateUUID(),
      qualifiedSeconds: Math.max(3, Math.round(pageViewAccumMs / 1000) || 3)
    };

    fetch(CONFIG.backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      keepalive: true
    }).catch(function(error) {
      console.error('Error sending conversion data:', error);
    });
  }
})();
