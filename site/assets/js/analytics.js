/*
 * Visit counting with GoatCounter: no cookies, no identifier stored on the
 * device, aggregated data on European servers. Loaded by the scene and the
 * help page only, not by the privacy and licence pages.
 *
 * Only the page path is counted: the query string (lang, lat, lon,
 * previewTime and the other test parameters) is never sent, so a place typed
 * into a shared link stays out of the statistics. count.js skips localhost
 * on its own, so local testing is not counted.
 *
 * The address below is the only thing to change if the site code on
 * goatcounter.com ever changes.
 */
(function () {
  'use strict';
  var ENDPOINT = 'https://lirux-odle-panorama.goatcounter.com/count';

  window.goatcounter = {
    endpoint: ENDPOINT,
    path: function () { return location.pathname; }
  };

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', ENDPOINT);
  document.head.appendChild(s);
})();
