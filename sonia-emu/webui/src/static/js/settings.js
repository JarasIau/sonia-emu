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

  function applyTheme(settings) {
    const backgroundColor =
      settings.backgroundColor || DEFAULTS.backgroundColor;
    const chainEnabled = settings.chainEnabled !== false;

    document.documentElement.style.setProperty(
      "--background-color",
      backgroundColor,
    );
    document.documentElement.style.setProperty(
      "--control-color",
      settings.controlColor || DEFAULTS.controlColor,
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
