class ControllerOptions {
  constructor() {
    this.toggle = document.getElementById("analog-toggle");
    this.analogTriggers = document.querySelectorAll(".analog-trigger");
    this.digitalTriggers = document.querySelectorAll(".button-trigger");
    this.topButtons = document.getElementById("top-buttons");

    this.init();
  }

  init() {
    if (!this.toggle) return;

    this.updateTriggerMode(this.toggle.checked);

    this.toggle.addEventListener("change", () => {
      this.updateTriggerMode(this.toggle.checked);
    });
  }

  updateTriggerMode(isAnalog) {
    this.setDisplay(this.analogTriggers, isAnalog ? "flex" : "none");
    this.setDisplay(this.digitalTriggers, isAnalog ? "none" : "flex");

    if (!this.topButtons.closest(".custom-layout")) {
      this.topButtons.style.top = isAnalog ? "-10%" : "10%";
    }
  }

  setDisplay(elements, value) {
    elements.forEach((el) => (el.style.display = value));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ControllerOptions();
});
