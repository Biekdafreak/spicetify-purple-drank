// Biekdafreak - Purple Drank: artwork tint
//
// The theme tints every cover with a CSS filter, and a filter needs its hue as
// an angle. CSS cannot work an angle out of a colour, so this reads the colour
// scheme's accent, works out its hue and hands it to user.css as
// --pd-tint-hue. It runs again whenever the scheme changes.
//
// Without this script the theme still works; covers just stay purple whatever
// scheme is picked.

(function purpleDrankTint() {
  const root = document.documentElement;

  // The theme's own purple and the angle user.css uses for it. That pairing
  // was picked by eye and is left alone; every other accent is matched by
  // working the filter through.
  const HOME_ACCENT = "#744DA9";
  const HOME_ANGLE = 230;

  function hueOfRgb(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 1e-6) return null; // grey has no hue
    let hue;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    return (hue * 60 + 360) % 360;
  }

  function hueOfHex(color) {
    const hex = color.trim().match(/^#?([0-9a-f]{6})$/i);
    if (!hex) return null;
    const value = parseInt(hex[1], 16);
    return hueOfRgb((value >> 16) & 255, (value >> 8) & 255, value & 255);
  }

  // What hue a mid-grey pixel ends up as after the filter in user.css:
  // grayscale(1) sepia(1) hue-rotate(angle) saturate(4). hue-rotate() is only
  // an approximation of a real hue turn, and saturate() clips, so the result
  // is not simply "sepia + angle"; working it through gives the true answer.
  function filteredHue(angle) {
    const clamp = (x) => Math.min(1, Math.max(0, x));
    // sepia(1) of 50% grey
    let rgb = [0.6755, 0.6015, 0.4685];
    const rad = (angle * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const [r, g, b] = rgb;
    rgb = [
      r * (0.213 + c * 0.787 - s * 0.213) + g * (0.715 - c * 0.715 - s * 0.715) + b * (0.072 - c * 0.072 + s * 0.928),
      r * (0.213 - c * 0.213 + s * 0.143) + g * (0.715 + c * 0.285 + s * 0.14) + b * (0.072 - c * 0.072 - s * 0.283),
      r * (0.213 - c * 0.213 - s * 0.787) + g * (0.715 - c * 0.715 + s * 0.715) + b * (0.072 + c * 0.928 + s * 0.072)
    ].map(clamp);
    const grey = 0.213 * rgb[0] + 0.715 * rgb[1] + 0.072 * rgb[2];
    rgb = rgb.map((x) => clamp(grey + (x - grey) * 4));
    return hueOfRgb(rgb[0], rgb[1], rgb[2]);
  }

  const turn = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

  function angleFor(want) {
    let best = HOME_ANGLE;
    let bestGap = Infinity;
    for (let angle = 0; angle < 360; angle++) {
      const hue = filteredHue(angle);
      if (hue === null) continue;
      const gap = turn(hue, want);
      if (gap < bestGap) {
        bestGap = gap;
        best = angle;
      }
    }
    return best;
  }

  let last = "";
  function update() {
    const accent = getComputedStyle(root).getPropertyValue("--spice-button");
    if (accent === last) return;
    last = accent;
    const hue = hueOfHex(accent);
    if (hue === null || accent.trim().toUpperCase() === HOME_ACCENT) root.style.removeProperty("--pd-tint-hue");
    else root.style.setProperty("--pd-tint-hue", `${angleFor(hue)}deg`);
  }

  // Marketplace applies a scheme by swapping a <style> tag that sits directly
  // in <body>, so watching the direct children of <head> and <body> is enough.
  // That keeps this out of the way of Spotify's own constant page updates.
  const observer = new MutationObserver(update);
  observer.observe(document.head, { childList: true });
  observer.observe(document.body, { childList: true });

  update();
  // The scheme's stylesheet can still be loading when this first runs.
  window.addEventListener("load", update);
  setTimeout(update, 3000);
})();
