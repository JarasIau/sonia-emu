document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("analog-toggle");
  const topButtons = document.getElementById("top-buttons");
  if (!toggle || !topButtons) return;

  const update = () => {
    const isAnalog = toggle.checked;
    document
      .querySelectorAll(".analog-trigger")
      .forEach((el) => (el.style.display = isAnalog ? "flex" : "none"));
    document
      .querySelectorAll(".button-trigger")
      .forEach((el) => (el.style.display = isAnalog ? "none" : "flex"));

    if (!topButtons.closest(".custom-layout")) {
      topButtons.style.top = isAnalog ? "-10%" : "10%";
    }
  };

  update();
  toggle.addEventListener("change", update);
});
