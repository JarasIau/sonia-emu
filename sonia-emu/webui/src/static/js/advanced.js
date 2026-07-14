(function () {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  class AdvancedSettings {
    constructor() {
      this.settings = window.SoniaSettings;
      this.openEditorButton = document.getElementById("open-control-editor");
      this.closeEditorButton = document.getElementById("close-control-editor");
      this.cancelEditorButton = document.getElementById(
        "cancel-control-editor",
      );
      this.backgroundInput = document.getElementById("background-color");
      this.controlInput = document.getElementById("control-color");
      this.resetLayoutButton = document.getElementById("reset-layout");
      this.resetEditorLayoutButton = document.getElementById(
        "reset-editor-layout",
      );
      this.resetThemeButton = document.getElementById("reset-theme");
      this.editor = document.getElementById("control-editor");
      this.surface = document.getElementById("joysticks");
      this.layout = null;
      this.activeDrag = null;
      this.queuedPosition = null;
      this.frame = 0;
      this.dragHandlesBound = false;

      if (!this.settings || !this.editor || !this.surface) return;
      this.init();
    }

    init() {
      const stored = this.settings.read();
      this.backgroundInput.value = stored.backgroundColor;
      this.controlInput.value = stored.controlColor;

      this.layout = stored.layout || this.defaultLayout();

      this.bindColorInput(this.backgroundInput, "backgroundColor");
      this.bindColorInput(this.controlInput, "controlColor");
      this.bindEditorButtons();
      this.bindResetButtons();
    }

    bindEditorButtons() {
      this.openEditorButton.addEventListener("click", () => this.openEditor());
      this.closeEditorButton.addEventListener("click", () =>
        this.closeEditor(),
      );
      this.cancelEditorButton.addEventListener("click", () =>
        this.closeEditor(),
      );
    }

    bindColorInput(input, key) {
      input.addEventListener("input", () => {
        this.settings.save({ [key]: input.value });
      });
    }

    bindResetButtons() {
      this.resetLayoutButton.addEventListener("click", () => {
        this.resetLayout();
      });

      this.resetEditorLayoutButton.addEventListener("click", () => {
        this.resetLayout();
      });

      this.resetThemeButton.addEventListener("click", () => {
        this.backgroundInput.value = this.settings.defaults.backgroundColor;
        this.controlInput.value = this.settings.defaults.controlColor;
        this.settings.save({
          backgroundColor: this.settings.defaults.backgroundColor,
          controlColor: this.settings.defaults.controlColor,
        });
      });
    }

    openEditor() {
      const stored = this.settings.read();
      this.layout = stored.layout || this.defaultLayout();
      this.editor.hidden = false;
      document.body.classList.add("editor-active");
      this.settings.applyLayout(this.layout);

      if (!this.dragHandlesBound) {
        this.bindDragHandles();
        this.dragHandlesBound = true;
      }
    }

    closeEditor() {
      this.editor.hidden = true;
      document.body.classList.remove("editor-active");
      this.activeDrag = null;
      this.queuedPosition = null;
    }

    resetLayout() {
      this.settings.save({ layout: null });
      this.settings.clearLayoutStyles();
      this.layout = this.defaultLayout();

      if (!this.editor.hidden) {
        this.settings.applyLayout(this.layout);
      }
    }

    bindDragHandles() {
      document.querySelectorAll("[data-layout-key]").forEach((element) => {
        element.addEventListener("click", (event) => event.preventDefault());
        element.addEventListener("pointerdown", (event) =>
          this.startDrag(event, element),
        );
      });
    }

    startDrag(event, element) {
      if (this.editor.hidden) return;
      if (event.button !== undefined && event.button !== 0) return;

      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      element.classList.add("is-dragging");
      this.activeDrag = {
        element,
        key: element.dataset.layoutKey,
        pointerId: event.pointerId,
      };
      this.updateDrag(event.clientX, event.clientY);

      element.addEventListener("pointermove", this.moveDrag);
      element.addEventListener("pointerup", this.endDrag);
      element.addEventListener("pointercancel", this.endDrag);
    }

    moveDrag = (event) => {
      if (!this.activeDrag || event.pointerId !== this.activeDrag.pointerId) {
        return;
      }
      event.preventDefault();
      this.updateDrag(event.clientX, event.clientY);
    };

    endDrag = (event) => {
      if (!this.activeDrag || event.pointerId !== this.activeDrag.pointerId) {
        return;
      }

      const { element } = this.activeDrag;
      element.classList.remove("is-dragging");
      element.removeEventListener("pointermove", this.moveDrag);
      element.removeEventListener("pointerup", this.endDrag);
      element.removeEventListener("pointercancel", this.endDrag);
      this.activeDrag = null;
      this.settings.save({ layout: this.layout });
    };

    updateDrag(clientX, clientY) {
      const key = this.activeDrag.key;
      const x = clamp((clientX / window.innerWidth) * 100, 3, 97);
      const y = clamp((clientY / window.innerHeight) * 100, 3, 97);
      this.layout[key] = { x, y };
      this.queuedPosition = { element: this.activeDrag.element, x, y };

      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        const position = this.queuedPosition;
        this.frame = 0;
        if (!position) return;
        position.element.style.left = `${position.x}%`;
        position.element.style.top = `${position.y}%`;
      });
    }

    defaultLayout() {
      return {
        "left-joystick-container": { x: 20, y: 52 },
        "right-joystick-container": { x: 80, y: 52 },
        "top-buttons": { x: 50, y: 18 },
        "top-special-buttons": { x: 50, y: 74 },
        "left-corner": { x: 6, y: 10 },
        "right-corner": { x: 94, y: 10 },
      };
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    new AdvancedSettings();
  });
})();
