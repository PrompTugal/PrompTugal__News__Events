// The shared map (ptmap, designer@'s; Dinis, 19 Nov 2026 ~17:40 UTC): draws it where a page has <div id="map" data-map="...">.
// The options are written by this site's build (places, their positions and links), never read from fetched data.
// events.b@PrompTugal.dinis, 19 November 2026. Code: Apache-2.0.
(function () {
  'use strict';
  var el = document.getElementById('map');
  if (!el || !window.PTMap || typeof window.PTMap.render !== 'function') return;
  var o; try { o = JSON.parse(el.getAttribute('data-map') || '{}'); } catch (e) { return; }
  if (!o || typeof o !== 'object' || !Array.isArray(o.places)) return;
  window.PTMap.render(el, o);
})();
