class AnalogController {
  constructor() {
    this.socket = null;
    this.triggers = [];
    this.pending = new Map();
    this.flushPending = false;
    this.controller = window.__soniaController ?? null;
    this.init();
  }

  init() {
    this.connectWebSocket();
    this.initTriggers();
  }

  connectWebSocket() {
    if (this.controller) {
      this.socket = this.controller.socket;
      return;
    }

    const wsScheme = location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new WebSocket(`${wsScheme}//${location.host}/ws`);
    this.socket.onopen = () => console.log("WebSocket connected");
    this.socket.onerror = (err) => console.error("WebSocket error:", err);
    this.socket.onclose = () => {
      console.log("WebSocket closed, reconnecting in 2s...");
      setTimeout(() => this.connectWebSocket(), 2000);
    };
  }

  initTriggers() {
    document.querySelectorAll(".trigger-slider").forEach((slider) => {
      this.triggers.push(new TriggerSlider(slider, this));
    });
  }

  send(data) {
    if (this.controller) {
      this.controller.send(data);
      return;
    }

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

    if (this.socket?.readyState === WebSocket.OPEN) {
      if (buf) {
        this.socket.send(buf);
      } else {
        console.error("No packet encoder available");
      }
    } else {
      if (window.__soniaSendFallback) {
        window
          .__soniaSendFallback(payload)
          .catch((err) => console.error("Fallback error:", err));
      } else {
        fetch("/fallback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`fallback request failed: ${res.status}`);
            }
          })
          .catch((err) => console.error("Fallback error:", err));
      }
    }
  }
}

class TriggerSlider {
  constructor(element, controller) {
    this.slider = element;
    this.thumb = element.querySelector(".trigger-thumb");
    this.id = parseInt(element.dataset.id, 10);
    this.controller = controller;
    this.touchId = null;
    this.rect = null;

    this.attachListeners();
  }

  attachListeners() {
    this.slider.addEventListener("touchstart", (e) => this.start(e), {
      passive: false,
    });
  }

  start(e) {
    if (this.touchId !== null) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.touchId = touch.identifier;
    this.rect = this.slider.getBoundingClientRect();
    this.updatePosition(touch.clientY);

    document.addEventListener(
      "touchmove",
      (this.moveHandler = (e) => this.move(e)),
      { passive: false },
    );
    document.addEventListener(
      "touchend",
      (this.endHandler = (e) => this.end(e)),
    );
    document.addEventListener("touchcancel", this.endHandler);
  }

  move(e) {
    if (this.touchId === null) return;
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchId) {
        this.updatePosition(touch.clientY);
        break;
      }
    }
  }

  end(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchId) {
        this.touchId = null;
        this.reset();
        document.removeEventListener("touchmove", this.moveHandler);
        document.removeEventListener("touchend", this.endHandler);
        document.removeEventListener("touchcancel", this.endHandler);
        break;
      }
    }
  }

  updatePosition(clientY) {
    const offset = this.clamp(clientY - this.rect.top, 0, this.rect.height);
    const pressure = (1 - offset / this.rect.height) * 2 - 1;
    const bottomPos = ((pressure + 1) / 2) * this.rect.height;

    this.thumb.style.bottom = `${bottomPos}px`;
    this.controller.send({ type: "trigger", id: this.id, value: pressure });
  }

  reset() {
    this.thumb.style.transition = "bottom 0.2s ease-out";
    this.thumb.style.bottom = "0px";
    this.controller.send({ type: "trigger", id: this.id, value: -1 });
    setTimeout(() => {
      this.thumb.style.transition = "";
    }, 200);
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new AnalogController();
});
