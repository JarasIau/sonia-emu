const AXIS_RANGE = 512;
const PREFIX = { button: 0x62, joystick: 0x6a, trigger: 0x6a };

if (!window.__soniaPackInput) {
  window.__soniaPackInput = (data) => {
    const val =
      data.type !== "button" ? Math.round(data.value * AXIS_RANGE) : data.value;
    const buf = new ArrayBuffer(6);
    const view = new DataView(buf);
    view.setUint8(0, PREFIX[data.type]);
    view.setUint8(1, data.id);
    view.setInt32(2, val, false);
    return buf;
  };
}

if (!window.__soniaSendFallback) {
  window.__soniaSendFallback = (payload) =>
    fetch("/fallback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`fallback request failed: ${res.status}`);
      }
    });
}

class GameController {
  constructor() {
    this.socket = window.__soniaSocket ?? null;
    this.joysticks = new Map();
    this.pending = new Map();
    this.flushPending = false;
    window.__soniaController = this;
    window.__soniaSend = (data) => this.send(data);
    this.init();
  }

  init() {
    this.connectWebSocket();
    this.initJoysticks();
    this.initButtons();
  }

  connectWebSocket() {
    if (this.socket !== null) return;
    const wsScheme = location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new WebSocket(`${wsScheme}//${location.host}/ws`);
    window.__soniaSocket = this.socket;
    this.socket.onopen = () => console.log("WebSocket connected");
    this.socket.onerror = (err) => console.error("WebSocket error:", err);
    this.socket.onclose = () => {
      console.log("WebSocket closed, reconnecting in 2s...");
      window.__soniaSocket = null;
      setTimeout(() => this.connectWebSocket(), 2000);
    };
  }

  initJoysticks() {
    const configs = [
      { id: "left", xId: 0, yId: 1 },
      { id: "right", xId: 2, yId: 3 },
    ];

    configs.forEach((config) => {
      const container = document.getElementById(
        `${config.id}-joystick-container`,
      );
      const stick = document.getElementById(`${config.id}-joystick`);
      if (!container || !stick) return;
      this.joysticks.set(
        config.id,
        new Joystick(container, stick, config, this),
      );
    });
  }

  initButtons() {
    document.querySelectorAll(".button").forEach((btn) => {
      const id = parseInt(btn.getAttribute("data-id"), 10);
      const isTrigger = btn.textContent === "L2" || btn.textContent === "R2";

      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.send({ type: isTrigger ? "trigger" : "button", id, value: 1 });
      });

      btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        this.send({
          type: isTrigger ? "trigger" : "button",
          id,
          value: isTrigger ? -1 : 0,
        });
      });
    });
  }

  send(data) {
    this.pending.set(`${data.type}:${data.id}`, data);
    if (!this.flushPending) {
      this.flushPending = true;
      queueMicrotask(() => this.flush());
    }
  }

  flush() {
    this.flushPending = false;
    for (const data of this.pending.values()) {
      this._send(data);
    }
    this.pending.clear();
  }

  _send(data) {
    const payload = {
      type: data.type,
      id: data.id,
      value: data.value,
    };
    const encode = window.__soniaPackInput;
    const buf = encode ? encode(payload) : null;

    if (!buf && this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(buf);
    } else {
      window
        .__soniaSendFallback(payload)
        .catch((err) => console.error("Fallback error:", err));
    }
  }
}

class Joystick {
  constructor(container, stick, config, controller) {
    this.container = container;
    this.stick = stick;
    this.config = config;
    this.controller = controller;
    this.touchId = null;
    this.maxDistance = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.invMaxDistance = 1;

    this.waitForLayout(() => this.attachListeners());
  }

  waitForLayout(callback) {
    const check = () => {
      if (this.container.offsetWidth > 0) {
        callback();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  }

  attachListeners() {
    this.updateGeometry();

    this.container.addEventListener("touchstart", (e) => this.start(e), {
      passive: false,
    });
    this.container.addEventListener("touchmove", (e) => this.move(e), {
      passive: false,
    });
    document.addEventListener("touchend", (e) => this.end(e));
    document.addEventListener("touchcancel", (e) => this.end(e));
    window.addEventListener("resize", () => this.updateGeometry());
  }

  updateGeometry() {
    const rect = this.container.getBoundingClientRect();
    const containerRadius = rect.width / 2;
    const stickRadius = this.stick.offsetWidth / 2;
    this.maxDistance = Math.max(0, containerRadius + stickRadius);
    this.invMaxDistance = this.maxDistance === 0 ? 0 : 1 / this.maxDistance;
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
  }

  start(e) {
    e.preventDefault();
    const touch = this.findTouch(e.touches);
    if (!touch) return;
    this.touchId = touch.identifier;
    this.stick.style.transition = "none";
    this.container.classList.add("joystick-active");
  }

  move(e) {
    if (this.touchId === null) return;
    const touch = this.getTouchById(e.changedTouches);
    if (!touch) return;

    if (this.invMaxDistance === 0) return;

    const deltaX = touch.clientX - this.centerX;
    const deltaY = touch.clientY - this.centerY;

    const distance = Math.min(Math.hypot(deltaX, deltaY), this.maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;

    this.container.style.setProperty("--chain-distance", `${distance}px`);
    this.container.style.setProperty("--chain-angle", `${angle}rad`);
    this.stick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;

    this.controller.send({
      type: "joystick",
      id: this.config.xId,
      value: offsetX * this.invMaxDistance,
    });
    this.controller.send({
      type: "joystick",
      id: this.config.yId,
      value: offsetY * this.invMaxDistance,
    });
  }

  end(e) {
    const touch = this.getTouchById(e.changedTouches);
    if (!touch) return;
    this.touchId = null;
    this.container.classList.remove("joystick-active");
    this.container.style.setProperty("--chain-distance", "0px");
    this.container.style.setProperty("--chain-angle", "0rad");
    this.stick.style.transition = "transform 0.2s ease-out";
    this.stick.style.transform = "translate(-50%, -50%)";
    this.controller.send({ type: "joystick", id: this.config.xId, value: 0 });
    this.controller.send({ type: "joystick", id: this.config.yId, value: 0 });
  }

  findTouch(touches) {
    const rect = this.container.getBoundingClientRect();
    for (let touch of touches) {
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        return touch;
      }
    }
    return null;
  }

  getTouchById(touches) {
    for (let touch of touches) {
      if (touch.identifier === this.touchId) return touch;
    }
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.__soniaController) {
    new GameController();
  }
});
