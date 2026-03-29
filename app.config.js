/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Dynamic Expo config: Google Maps native keys from env (EAS secret or .env.local).
 * Static fields live in app.json.
 */
const appJson = require('./app.json');

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      bundleIdentifier: 'com.keo.app',
      config: {
        ...(appJson.expo.ios?.config ?? {}),
        googleMapsApiKey,
      },
    },
    android: {
      ...appJson.expo.android,
      package: 'com.keo.app',
      config: {
        ...(appJson.expo.android?.config ?? {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  },
};
