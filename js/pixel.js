(function() {
  // Ensure the script doesn't run multiple times
  if (window.VKMetricsCoreLoaded || window.vkPixelScriptLoaded) return;
  window.vkPixelScriptLoaded = true;
  console.log('VK Pixel: Script loaded successfully');

  // Initialize the global vkPixel object if it doesn't exist
  window.vkPixel = window.vkPixel || { _q: [] };

  // Extend vkPixel with necessary methods
  window.vkPixel.getUserId = function() {
  return userId;
  };
  window.vkPixel.getClientId = function() {
  return clientId;
  };
  window.vkPixel.getUrlParams = function() {
  return urlParams;
  };
  window.vkPixel.trackFormSuccess = function(form) {
    if (!form || form.dataset.vkPixelProcessed) return;
    form.dataset.vkPixelProcessed = 'true';
    
    var data = {
      eventType: 'formSubmit',
      formData: collectFormData(form),
      url: encodeURIComponent(getEffectivePageUrl()),
      referrer: encodeURIComponent(document.referrer || ''),
      userAgent: encodeURIComponent(navigator.userAgent || ''),
      timestamp: new Date().toISOString()
    };
    console.log('VK Pixel: Form submitted', data);
    
    sendData(data);
  };

  // Configuration
  const CONFIG = {
    backendEndpoint: 'https://pixel.vkdigital.com.br/lead',
    cookieName: 'vk_user_uid',
    cookieTTL: 365 * 24 * 60, // 1 year in minutes
    formSelectors: 'form',
    scanInterval: 1000 // Interval for scanning new elements in milliseconds
  };

  // Variables to store client ID and user ID
  let clientId = 'unknown_client';
  let userId = null;
  let trackingId = null;
  let sessionId = null;
  const urlParams = getUrlParams();

  // Process queued commands
  const commands = window.vkPixel._q || [];
  commands.forEach(function(command) {
    const method = command[0];
    const args = command.slice(1);
    if (method === 'init') {
      initializePixel.apply(null, args);
    }
    // Add other methods as needed
  });

  // Function to initialize the pixel with the client ID
  function initializePixel(clientIdFromInit) {
    clientId = clientIdFromInit || clientId;
    userId = getUserId();
    trackingId = getOrCreateTrackingId();
    sessionId = getOrCreateSessionId();

    document.addEventListener('submit', handleFormSubmissionEvent, true);

    // Hook específico do Elementor: só observa e envia APÓS sucesso
    setupElementorHooks();
    
    // Hook específico do Contact Form 7: só observa e envia APÓS sucesso
    setupContactForm7Hooks();
  
  }

  // Helper functions

function handleFormSubmissionEvent(event) {
  const form = event.target;
  
  // Se for um formulário do Elementor, não coletar aqui para não
  // interferir no fluxo interno. Coletaremos no hook de "submit_success".
  if (isElementorForm(form)) return;
  
  // Se for um formulário do Contact Form 7, não coletar aqui para não
  // interferir no fluxo interno. Coletaremos no hook de "wpcf7mailsent".
  if (isContactForm7(form)) return;
  
  // Avoid processing invalid forms
  if (!form || !form.checkValidity()) return;
  
  // Check if this form has already been processed by our pixel script specifically
  if (form.dataset.vkPixelProcessed) return;
  form.dataset.vkPixelProcessed = 'true';

  const data = {
    eventType: 'formSubmit',
    formData: collectFormData(form),
    url: encodeURIComponent(getEffectivePageUrl()),
    referrer: encodeURIComponent(document.referrer || ''),
    userAgent: encodeURIComponent(navigator.userAgent || ''),
    timestamp: new Date().toISOString()
  };
  
  sendData(data);
}

  // Detecta formulário do Elementor
  function isElementorForm(element) {
    if (!element) return false;
    if (element.classList && element.classList.contains('elementor-form')) return true;
    return !!(element.closest && element.closest('.elementor-form'));
  }

  // Detecta formulário do Contact Form 7
  function isContactForm7(element) {
    if (!element) return false;
    if (element.classList && element.classList.contains('wpcf7-form')) return true;
    return !!(element.closest && element.closest('.wpcf7-form'));
  }

  // Integração com Elementor: hook global no submit_success
  function setupElementorHooks() {
    if (!window.jQuery) return;
    
    const $ = window.jQuery;
    
    // Hook global no submit_success para todos os formulários Elementor
    try {
      $(document).on('submit_success', '.elementor-form', function() {
        // Find the actual form element
        let formElement = this;
        if (this.tagName !== 'FORM') {
          // If this is not a form element, find the form within it
          formElement = this.querySelector('form');
        }
        
        if (!formElement) {
          console.error('No form element found');
          return;
        }
        
        // Evitar processamento duplo
        if (formElement.dataset.vkPixelProcessed) {
          return;
        }
        formElement.dataset.vkPixelProcessed = 'true';
        
        sendElementorFormData(formElement);
      });
    } catch (e) {
      // Silencioso
    }
  }

  // Integração com Contact Form 7: hook global no wpcf7mailsent
  function setupContactForm7Hooks() {
    if (!window.jQuery) return;
    
    const $ = window.jQuery;
    
    // Hook global no wpcf7mailsent para todos os formulários Contact Form 7
    // Este evento é disparado quando o formulário é enviado com sucesso
    try {
      $(document).on('wpcf7mailsent', 'form.wpcf7-form', function(event) {
        const formElement = this;
        
        if (!formElement) {
          console.error('No form element found');
          return;
        }
        
        // Evitar processamento duplo
        if (formElement.dataset.vkPixelProcessed) {
          return;
        }
        formElement.dataset.vkPixelProcessed = 'true';
        
        sendContactForm7Data(formElement);
      });
    } catch (e) {
      // Silencioso
    }
  }
  
  function sendElementorFormData(formEl) {
    if (!formEl) return;
    
    const data = {
      eventType: 'formSubmit',
      formData: collectFormData(formEl),
      url: encodeURIComponent(getEffectivePageUrl()),
      referrer: encodeURIComponent(document.referrer || ''),
      userAgent: encodeURIComponent(navigator.userAgent || ''),
      timestamp: new Date().toISOString()
    };
    
    sendData(data);
  }

  function sendContactForm7Data(formEl) {
    if (!formEl) return;
    
    const data = {
      eventType: 'formSubmit',
      formData: collectFormData(formEl),
      url: encodeURIComponent(getEffectivePageUrl()),
      referrer: encodeURIComponent(document.referrer || ''),
      userAgent: encodeURIComponent(navigator.userAgent || ''),
      timestamp: new Date().toISOString()
    };
    
    sendData(data);
  }

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
      let search = window.location.search;
      try {
        const href = getEffectivePageUrl();
        if (href) search = new URL(href).search;
      } catch (e) {}
      const params = new URLSearchParams(search);
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

  function isBlockedLeadField(name, input) {
    if (input && input.getAttribute && input.getAttribute('data-vk-ignore') !== null) return true;
    if (input && input.closest && input.closest('[data-vk-ignore]')) return true;
    const type = ((input && input.type) || '').toLowerCase();
    if (type === 'password' || type === 'file') return true;
    const haystack = String(name || '') + ' ' + type;
    return /password|passwd|senha|card|cartao|cartão|cvv|cvc|cc-num|credit|token|secret|ssn/i.test(haystack);
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

  /**
   * Em iframe com srcdoc, window.location é "about:srcdoc" e não reflete a página real.
   * Se o parent for same-origin, usamos a URL e a query dele (comportamento alinhado a scripts inline comuns).
   */
  function isAboutOrOpaquePage(href) {
    if (!href) return true;
    return href.indexOf('about:') === 0;
  }

  function getParentLocation() {
    if (!window.parent || window.parent === window) return null;
    try {
      return window.parent.location;
    } catch (e) {
      return null;
    }
  }

  function getEffectivePageUrl() {
    const href = window.location.href;
    if (isAboutOrOpaquePage(href)) {
      const pl = getParentLocation();
      if (pl && pl.href) return pl.href;
    }
    return href;
  }

  // Get all URL parameters
  function getUrlParams() {
    try {
      const params = {};
      // Keep original behavior for compatibility with backend expectations.
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

  function getFacebookCookies() {
    return {
      fbc: getCookie('_fbc'),
      fbp: getCookie('_fbp')
    };
  }

  function sendData(data) {
    if (!userId) return;

    // Add Facebook cookies to the data
    const fbCookies = getFacebookCookies();
    
    data.userId = userId;
    data.urlParams = urlParams;
    data.clientId = clientId;
    data.trackingId = trackingId || getOrCreateTrackingId();
    data.sessionId = sessionId || getOrCreateSessionId();
    data.browserEventId = generateUUID();
    data.fbc = fbCookies.fbc;
    data.fbp = fbCookies.fbp;

    const payload = JSON.stringify(data);

    fetch(CONFIG.backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload,
      keepalive: true
    }).catch(function(error) {
      console.error('Error sending data:', error);
    });
  }

  // Collect form data
  function collectFormData(form) {
    // Check if form is a valid HTML form element
    if (!form || !(form instanceof HTMLFormElement)) {      
      return {};
    }
    
    try {
      const formObject = {};
      
      // 1. First try to get data from FormData (standard way)
      const formData = new FormData(form);
      formData.forEach((value, key) => {
        if (!key) return;
        if (typeof File !== 'undefined' && value instanceof File) return;
        const input = form.querySelector('[name="' + String(key).replace(/"/g, '\\"') + '"]');
        if (isBlockedLeadField(key, input)) return;
        formObject[key] = value;
      });

      // 2. Fallback ONLY if formObject is still empty
      if (Object.keys(formObject).length === 0) {
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach((input) => {
          if (isBlockedLeadField(input.name || input.id, input)) return;

          // Try to identify the field by its type, placeholder or id
          let key = null;
          const type = (input.getAttribute('type') || '').toLowerCase();
          const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
          const id = (input.getAttribute('id') || '').toLowerCase();

          if (type === 'email' || placeholder.includes('e-mail') || placeholder.includes('email')) {
            key = 'email';
          } else if (type === 'tel' || placeholder.includes('telefone') || placeholder.includes('whatsapp') || placeholder.includes('celular')) {
            key = 'phone';
          } else if (placeholder.includes('nome')) {
            key = 'name';
          } else if (id) {
            key = id;
          } else if (placeholder) {
            key = placeholder.replace(/[^a-z0-9]/g, '_').substring(0, 32);          
          } else if (type && type !== 'text' && type !== 'submit') {
            key = type;
          }

          if (key && input.value && !formObject[key]) {
            formObject[key] = input.value;
          }
        });
      }

      return formObject;
    } catch (error) {      
      return {};
    }
  }
})();

