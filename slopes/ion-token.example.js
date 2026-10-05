/* Cesium Ion access token for the 3D terrain on the "3D Map" tab.
 *
 * This file is the COMMITTED TEMPLATE. The real file, `ion-token.js`, is
 * gitignored and never committed:
 *
 *   local dev : copy this file to `ion-token.js` and paste your token
 *   deploy    : the Pages workflow writes `ion-token.js` from the
 *               `CESIUM_ION_TOKEN` repository secret before uploading
 *
 * A token that runs in a browser is never truly secret -- every visitor can
 * read it from view-source. Treat this file as configuration, and scope the
 * token itself in the Cesium Ion dashboard (referrer + asset restrictions)
 * rather than relying on it being hidden.
 *
 * Without a token the app still works: the 3D view falls back to a
 * token-free globe (OpenStreetMap imagery, ellipsoid terrain).
 */
window.ION_TOKEN = "";
