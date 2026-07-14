(function () {
  const STORAGE_KEY = "sonia-emu-ui-settings";
  const DEFAULTS = {
    backgroundColor: "#333333",
    controlColor: "#ffffff",
    chainEnabled: true,
    layout: null,
  };

  function read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch (_err) {
      return { ...DEFAULTS };
    }
  }

  function write(settings) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_err) {
      return false;
    }
    return true;
  }

  function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function parseHexColor(value) {
    const normalized = String(value || DEFAULTS.backgroundColor)
      .trim()
      .replace("#", "");

    if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
      return {
        r: parseInt(normalized[0] + normalized[0], 16),
        g: parseInt(normalized[1] + normalized[1], 16),
        b: parseInt(normalized[2] + normalized[2], 16),
      };
    }

    if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
      };
    }

    return parseHexColor(DEFAULTS.backgroundColor);
  }

  function mixColor(a, b, amount) {
    const inverse = 1 - amount;
    return {
      r: clampChannel(a.r * inverse + b.r * amount),
      g: clampChannel(a.g * inverse + b.g * amount),
      b: clampChannel(a.b * inverse + b.b * amount),
    };
  }

  function rgb(color) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  function rgba(color, alpha) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }

  function luminance(color) {
    return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  }

  function derivePalette(backgroundColor) {
    const background = parseHexColor(backgroundColor);
    const lowContrast = luminance(background) < 0.55;
    const anchor = lowContrast
      ? { r: 255, g: 255, b: 255 }
      : { r: 0, g: 0, b: 0 };
    const opposite = lowContrast
      ? { r: 0, g: 0, b: 0 }
      : { r: 255, g: 255, b: 255 };

    return {
      button: rgb(mixColor(background, anchor, 0.18)),
      buttonActive: rgb(mixColor(background, opposite, 0.12)),
      surface: rgba(mixColor(background, anchor, 0.16), 0.72),
      triggerTrack: rgb(mixColor(background, anchor, 0.12)),
      editorPanel: rgba(mixColor(background, opposite, 0.18), 0.88),
    };
  }

  function applyTheme(settings) {
    const backgroundColor =
      settings.backgroundColor || DEFAULTS.backgroundColor;
    const palette = derivePalette(backgroundColor);
    const chainEnabled = settings.chainEnabled !== false;

    document.documentElement.style.setProperty(
      "--background-color",
      backgroundColor,
    );
    document.documentElement.style.setProperty(
      "--control-color",
      settings.controlColor || DEFAULTS.controlColor,
    );
    document.documentElement.style.setProperty(
      "--button-color",
      palette.button,
    );
    document.documentElement.style.setProperty(
      "--button-active-color",
      palette.buttonActive,
    );
    document.documentElement.style.setProperty(
      "--surface-color",
      palette.surface,
    );
    document.documentElement.style.setProperty(
      "--trigger-track-color",
      palette.triggerTrack,
    );
    document.documentElement.style.setProperty(
      "--editor-panel-color",
      palette.editorPanel,
    );
    document.documentElement.classList.toggle("chain-disabled", !chainEnabled);
  }

  function applyLayout(layout) {
    const surface = document.getElementById("joysticks");
    if (!surface || !layout) return;

    surface.classList.add("custom-layout");
    for (const [key, position] of Object.entries(layout)) {
      const element = document.querySelector(`[data-layout-key="${key}"]`);
      if (
        !element ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      ) {
        continue;
      }
      element.style.left = `${position.x}%`;
      element.style.top = `${position.y}%`;
      element.style.right = "auto";
      element.style.bottom = "auto";
    }
  }

  function clearLayoutStyles() {
    const surface = document.getElementById("joysticks");
    if (!surface) return;

    surface.classList.remove("custom-layout");
    document.querySelectorAll("[data-layout-key]").forEach((element) => {
      element.style.left = "";
      element.style.top = "";
      element.style.right = "";
      element.style.bottom = "";
    });
  }

  function save(partial) {
    const next = { ...read(), ...partial };
    write(next);
    applyTheme(next);

    if (Object.prototype.hasOwnProperty.call(partial, "layout")) {
      if (next.layout) {
        applyLayout(next.layout);
      } else {
        clearLayoutStyles();
      }
    }

    return next;
  }

  window.SoniaSettings = {
    defaults: DEFAULTS,
    read,
    save,
    applyTheme,
    applyLayout,
    clearLayoutStyles,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const settings = read();
    applyTheme(settings);
    applyLayout(settings.layout);
  });
})();
