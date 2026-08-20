/**
 * Dynamic Expo config layered on top of app.json.
 *
 * Purpose: only allow insecure (cleartext / local-network) traffic in LOCAL
 * DEV, where the API is reached over http:// (e.g. http://10.0.2.2:5000).
 * Preview/production builds point at the HTTPS Render API (see eas.json), so
 * cleartext is disabled there — hardening transport security for shipped apps.
 *
 * Expo passes the resolved app.json config in as `config`; we mutate and
 * return it, so every other field in app.json is preserved untouched.
 */
module.exports = ({ config }) => {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();

  // No env set → local dev defaults (http). Any explicit https:// → secure build.
  const allowCleartext = apiUrl === '' || apiUrl.startsWith('http://');

  // iOS: ATS local-networking exception only in dev.
  config.ios = config.ios || {};
  config.ios.infoPlist = config.ios.infoPlist || {};
  if (allowCleartext) {
    config.ios.infoPlist.NSAppTransportSecurity = { NSAllowsLocalNetworking: true };
  } else {
    delete config.ios.infoPlist.NSAppTransportSecurity;
  }

  // Android: toggle usesCleartextTraffic inside the expo-build-properties plugin.
  config.plugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
      const opts = { ...(plugin[1] || {}) };
      opts.android = { ...(opts.android || {}), usesCleartextTraffic: allowCleartext };
      return ['expo-build-properties', opts];
    }
    return plugin;
  });

  return config;
};
