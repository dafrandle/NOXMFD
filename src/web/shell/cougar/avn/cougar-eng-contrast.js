// Marker colours for the COUGAR layout's ENG bars (cougar-eng.js). Pure: no DOM, so
// cougar-eng-contrast.test.js pins it in Node.
//
// A marker (the throttle handle, the heat pointer, the MIL detent) is a line across a bar, drawn over
// whatever the bar shows there: a fill, a scale, a zone (cougar-eng.css). bestMarker takes the
// candidate colour that stands out most against the background(s) it is given: the largest
// worst-case WCAG contrast ratio. Which backgrounds count is the caller's choice (cougar-eng.js).
// Colours are { r, g, b, a } with r, g, b 0..255 and a 0..1.
(function (root) {
  const WHITE = { r: 255, g: 255, b: 255, a: 1 };
  const BLACK = { r: 0, g: 0, b: 0, a: 1 };

  // Layers bottom to top, each painted over the last with its alpha ("source over"); the bottom one
  // is taken as opaque. Returns an opaque colour.
  function composite(layers) {
    let out = null;
    layers.forEach(function (c) {
      if (!c) return;
      const a = typeof c.a === 'number' ? c.a : 1;
      if (!out) { out = { r: c.r, g: c.g, b: c.b, a: 1 }; return; }
      out = { r: c.r * a + out.r * (1 - a), g: c.g * a + out.g * (1 - a), b: c.b * a + out.b * (1 - a), a: 1 };
    });
    return out || { r: 0, g: 0, b: 0, a: 1 };
  }

  function withAlpha(c, a) { return { r: c.r, g: c.g, b: c.b, a: (typeof c.a === 'number' ? c.a : 1) * a }; }

  // A colour along evenly-spaced gradient stops at t (0..1), interpolated per channel in sRGB.
  function along(stops, t) {
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
    const a = stops[i], b = stops[i + 1];
    const mix = function (k) { return a[k] + (b[k] - a[k]) * f; };
    return { r: mix('r'), g: mix('g'), b: mix('b'), a: mix('a') };
  }

  function luminance(c) {
    const lin = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  }

  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // The candidate with the best worst-case contrast against every background (white wins ties).
  function bestMarker(backgrounds, candidates) {
    const list = candidates || [WHITE, BLACK];
    let best = list[0], bestScore = -1;
    list.forEach(function (c) {
      const score = Math.min.apply(null, backgrounds.map(function (bg) { return contrast(c, bg); }));
      if (score > bestScore + 1e-9) { best = c; bestScore = score; }
    });
    return best;
  }

  function css(c) { return 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')'; }

  const api = { WHITE: WHITE, BLACK: BLACK, composite: composite, withAlpha: withAlpha, along: along,
                luminance: luminance, contrast: contrast, bestMarker: bestMarker, css: css };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CougarEngContrast = api;
})(typeof self !== 'undefined' ? self : this);
