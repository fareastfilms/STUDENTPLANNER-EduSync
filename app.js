const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function showTab(name) {
  tabs.forEach(function (t) {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  panels.forEach(function (p) {
    p.classList.toggle("active", p.id === name);
  });
  try {
    localStorage.setItem("activeTab", name);
  } catch (e) {}
}

tabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    showTab(tab.dataset.tab);
  });
});

// ===== Liquid glass: kilauan ikut cursor atau jari =====
(function () {
const GLASS = ".panel.active, #tabs, .day-card, .task-item, .bj-acc-card, #fcCard, #timerDisplay, .auth-card";  let lit = new Set();

  function update(e) {
    const now = new Set();
    const path = e.composedPath ? e.composedPath() : [];

    path.forEach(function (el) {
      if (el.matches && el.matches(GLASS)) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", e.clientX - r.left + "px");
        el.style.setProperty("--my", e.clientY - r.top + "px");
        el.style.setProperty("--hl", 1);
        now.add(el);
      }
    });

    lit.forEach(function (el) {
      if (!now.has(el)) el.style.setProperty("--hl", 0);
    });
    lit = now;
  }

  function clear() {
    lit.forEach(function (el) {
      el.style.setProperty("--hl", 0);
    });
    lit = new Set();
  }

  document.addEventListener("pointermove", update);
  document.addEventListener("pointerdown", update);
  document.addEventListener("pointerup", function (e) {
    if (e.pointerType === "touch") clear();
  });
  document.addEventListener("pointercancel", clear);
  document.documentElement.addEventListener("pointerleave", clear);
})();

// ===== Login: latar cecair ikut cursor atau jari =====
(function () {
  const screen = document.getElementById("authScreen");
  if (!screen) return;

  document.addEventListener("pointermove", function (e) {
    if (screen.classList.contains("hidden")) return;
    screen.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(3));
    screen.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(3));
  });
})();

// ===== Tunjuk atau sembunyi kata laluan =====
(function () {
  const toggle = document.getElementById("passToggle");
  const input = document.getElementById("authPass");
  if (!toggle || !input) return;

  toggle.addEventListener("click", function () {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.classList.toggle("on", show);
    toggle.setAttribute("aria-pressed", show ? "true" : "false");
    toggle.setAttribute("aria-label", show ? "Sembunyi kata laluan" : "Tunjuk kata laluan");
    input.focus();
  });
})();

// ===== Halaman pendaratan: pendar cecair ikut cursor atau jari =====
(function () {
  const landing = document.getElementById("landing");
  const visual = document.getElementById("ldVisual");
  if (!landing || !visual) return;

  const goo = visual.querySelector(".ld-goo");
  const blobs = Array.from(visual.querySelectorAll(".ld-blob"));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Setiap gumpalan ada orbit sendiri, tarikan kepada cursor dan kelajuan "mengikut" yang berbeza
  const cfg = [
    { r: 0.17, speed: 0.00035, phase: 0.0, pull: 0.38, ease: 0.045 },
    { r: 0.21, speed: -0.00028, phase: 1.6, pull: 0.3, ease: 0.035 },
    { r: 0.15, speed: 0.00042, phase: 3.1, pull: 0.46, ease: 0.055 },
    { r: 0.23, speed: -0.00033, phase: 4.5, pull: 0.26, ease: 0.03 },
    { r: 0.12, speed: 0.0005, phase: 5.6, pull: 0.55, ease: 0.07 }
  ];

  const state = blobs.map(function () {
    return { x: 0, y: 0 };
  });

  let tx = 0;
  let ty = 0;
  let ox = 0;
  let oy = 0;
  let raf = 0;
  let running = false;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function isVisible() {
    return !landing.classList.contains("hidden");
  }

  function frame(t) {
    if (!isVisible()) {
      running = false;
      return;
    }

    const w = goo.offsetWidth;

    blobs.forEach(function (b, i) {
      const c = cfg[i];
      const s = state[i];
      const a = t * c.speed + c.phase;
      const bx = Math.cos(a) * c.r * w + tx * c.pull * w * 0.5;
      const by = Math.sin(a * 1.3) * c.r * w + ty * c.pull * w * 0.5;

      s.x += (bx - s.x) * c.ease;
      s.y += (by - s.y) * c.ease;

      // Gumpalan memanjang sedikit bila ketinggalan, jadi nampak seperti cecair
      const stretch = 1 + Math.min((Math.hypot(bx - s.x, by - s.y) / w) * 2, 0.25);
      b.style.transform = "translate(" + s.x.toFixed(1) + "px," + s.y.toFixed(1) + "px) scale(" + stretch.toFixed(3) + ")";
    });

    ox += (tx * 18 - ox) * 0.08;
    oy += (ty * 18 - oy) * 0.08;
    visual.style.setProperty("--ox", ox.toFixed(2));
    visual.style.setProperty("--oy", oy.toFixed(2));
    visual.style.setProperty("--sx", (35 + tx * 12).toFixed(1) + "%");
    visual.style.setProperty("--sy", (28 + ty * 12).toFixed(1) + "%");

    if (reduce) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !isVisible()) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  document.addEventListener("pointermove", function (e) {
    if (!isVisible()) return;

    const r = visual.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    tx = clamp((e.clientX - cx) / (r.width * 0.75), -1.2, 1.2);
    ty = clamp((e.clientY - cy) / (r.height * 0.75), -1.2, 1.2);

    landing.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(3));
    landing.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(3));

    if (reduce) start();
  });

  function rest() {
    tx = 0;
    ty = 0;
    if (reduce) start();
  }

  document.addEventListener("pointercancel", rest);
  document.addEventListener("pointerup", function (e) {
    if (e.pointerType === "touch") rest();
  });
  document.documentElement.addEventListener("pointerleave", rest);

  // Mula semula bila halaman pendaratan muncul (contohnya selepas log keluar)
  new MutationObserver(start).observe(landing, { attributes: true, attributeFilter: ["class"] });

  start();
})();