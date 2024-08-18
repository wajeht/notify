/**
 * PreloadLinksOnHover: A module for preloading links on hover to improve perceived page load times.
 */
const preloadLinksOnHover = (() => {
  const cache = new Set();
  const preloadLink = document.createElement('link');
  preloadLink.rel = 'prefetch';
  document.head.appendChild(preloadLink);

  const config = {
      hoverDelay: 50,
      maxConcurrent: 2,
      timeout: 3000,
      preloadExternal: false,
      logErrors: true
  };

  let activePreloads = 0;

  function preload(url) {
      if (cache.has(url) || activePreloads >= config.maxConcurrent) return;
      activePreloads++;
      cache.add(url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      fetch(url, { signal: controller.signal, mode: 'no-cors' })
          .then(() => {
              preloadLink.href = url;
          })
          .catch(error => {
              if (error.name !== 'AbortError' && config.logErrors) {
                  console.warn(`Failed to preload ${url}:`, error);
              }
          })
          .finally(() => {
              clearTimeout(timeoutId);
              activePreloads--;
          });
  }

  function shouldPreload(url) {
      if (!url) return false;
      if (!config.preloadExternal && new URL(url, window.location.origin).origin !== window.location.origin) return false;
      return !['#', 'mailto:', 'tel:', 'sms:', 'file:'].some(protocol => url.startsWith(protocol));
  }

  function handleMouseEnter() {
      const url = this.href;
      if (shouldPreload(url)) {
          setTimeout(() => preload(url), config.hoverDelay);
      }
  }

  function attachListeners() {
      document.querySelectorAll('a').forEach(link => {
          link.addEventListener('mouseenter', handleMouseEnter, { passive: true });
      });
  }

  function init(userConfig = {}) {
      Object.assign(config, userConfig);
      if ('connection' in navigator && navigator.connection.saveData) {
          console.log('Data saver mode detected. Preloading disabled.');
          return;
      }

      // Add load event listener
      window.addEventListener('load', attachListeners);
  }

  return {
      init,
      preloadNow(url) {
          if (shouldPreload(url)) preload(url);
      }
  };
})();

// Initialize with default settings
preloadLinksOnHover.init();

// Example of custom initialization:
// preloadLinksOnHover.init({ hoverDelay: 100, maxConcurrent: 3, preloadExternal: true });
