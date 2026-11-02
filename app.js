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