(function () {
  const wrap = document.getElementById("searchWrap");
  const input = document.getElementById("searchInput");
  const box = document.getElementById("searchResults");
  const MAX = 30;
  const TOTAL_SEMESTERS = 8;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const value = JSON.parse(raw);
        return value === null ? fallback : value;
      }
    } catch (e) {}
    return fallback;
  }

  // Kumpul semua data yang boleh dicari
  function collect() {
    const items = [];

    // GPA
    for (let s = 1; s <= TOTAL_SEMESTERS; s++) {
      read("gpa-sem-" + s, []).forEach(function (c) {
        if (!c || !c.name) return;
        items.push({
          tab: "gpa",
          label: "GPA",
          text: c.name + " (Semester " + s + ", " + (c.credit || "?") + " kredit)",
          sem: s
        });
      });
    }

    // Kelas (semester yang sedang dipaparkan dalam tab Jadual)
    document.querySelectorAll("#timetable .class-line span").forEach(function (el) {
      const card = el.closest(".day-card");
      const h3 = card ? card.querySelector("h3") : null;
      const day = h3 ? h3.textContent.replace(" (hari ini)", "") : "";
      items.push({ tab: "jadual", label: "Kelas", text: day + " | " + el.textContent });
    });

    // Tugasan
    for (let s = 1; s <= TOTAL_SEMESTERS; s++) {
      let list = read("tasks-" + s, null);
      if (list === null && s === 1) list = read("tasks", []);
      (list || []).forEach(function (t) {
        items.push({
          tab: "jadual",
          label: "Tugasan",
          text: t.name + " | " + t.date + " (Semester " + s + ")",
          sem: s
        });
      });
    }

    // Rekod masa belajar
    const log = read("studyLog", {});
    Object.keys(log).forEach(function (name) {
      items.push({
        tab: "study",
        label: "Study",
        text: name + ": " + Math.round(log[name] * 10) / 10 + " minit"
      });
    });

    // Flashcard
    read("flashcards", []).forEach(function (c) {
      items.push({
        tab: "flashcard",
        label: "Flashcard",
        text: "[" + c.subject + "] " + c.q,
        extra: c.a
      });
    });

    // Bajet
    const accounts = read("bj-accounts", []);
    function accName(id) {
      const a = accounts.find(function (x) {
        return x.id === id;
      });
      return a ? a.name : "";
    }

    accounts.forEach(function (a) {
      items.push({ tab: "bajet", label: "Akaun", text: a.name });
    });

    (document.body.classList.contains("private") ? [] : read("budget", [])).forEach(function (b) {      let desc;
      if (b.type === "transfer") {
        desc = b.desc + " | " + accName(b.from) + " → " + accName(b.to);
      } else {
        desc =
          b.desc + " | " + (b.type === "income" ? "Pendapatan" : b.category) + " | " + accName(b.account);
      }
      items.push({
        tab: "bajet",
        label: "Bajet",
        text: b.date + " | " + desc + " | RM " + Number(b.amount).toFixed(2),
        month: String(b.date).slice(0, 7)
      });
    });

    return items;
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Tulis teks dengan perkataan carian diserlahkan (selamat: guna textContent)
  function appendHighlighted(parent, text, words) {
    const re = new RegExp("(" + words.map(escapeRegex).join("|") + ")", "gi");
    text.split(re).forEach(function (part, i) {
      if (i % 2 === 1) {
        const mark = document.createElement("mark");
        mark.textContent = part;
        parent.appendChild(mark);
      } else if (part) {
        parent.appendChild(document.createTextNode(part));
      }
    });
  }

  function closeResults() {
    box.classList.add("hidden");
    box.innerHTML = "";
  }

  // Pergi ke hasil yang dipilih
  function go(item) {
    const tabBtn = document.querySelector('.tab[data-tab="' + item.tab + '"]');
    if (tabBtn) tabBtn.click();

    if (item.sem) {
      const sel = document.getElementById(item.tab === "gpa" ? "gpaSemSelect" : "semSelect");
      if (sel && sel.value !== String(item.sem)) {
        sel.value = item.sem;
        sel.dispatchEvent(new Event("change"));
      }
    }

    if (item.month) {
      const m = document.getElementById("bjMonth");
      if (m && m.value !== item.month) {
        m.value = item.month;
        m.dispatchEvent(new Event("change"));
      }
    }

    input.value = "";
    closeResults();
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    box.innerHTML = "";

    if (q.length < 2) {
      closeResults();
      return;
    }

    const words = q.split(/\s+/);
    const hits = collect().filter(function (item) {
      const hay = (item.text + " " + (item.extra || "")).toLowerCase();
      return words.every(function (w) {
        return hay.indexOf(w) !== -1;
      });
    });

    box.classList.remove("hidden");

    if (hits.length === 0) {
      const p = document.createElement("p");
      p.className = "sr-empty";
      p.textContent = "Tiada hasil. Cuba perkataan lain.";
      box.appendChild(p);
      return;
    }

    hits.slice(0, MAX).forEach(function (item) {
      const row = document.createElement("div");
      row.className = "sr-item";
      row.tabIndex = 0;
      row.setAttribute("role", "button");

      const tag = document.createElement("span");
      tag.className = "sr-tag";
      tag.textContent = item.label;

      const text = document.createElement("span");
      text.className = "sr-text";
      appendHighlighted(text, item.text, words);

      row.appendChild(tag);
      row.appendChild(text);

      row.addEventListener("click", function () {
        go(item);
      });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter") go(item);
      });

      box.appendChild(row);
    });

    if (hits.length > MAX) {
      const more = document.createElement("p");
      more.className = "sr-empty";
      more.textContent = "Ada " + (hits.length - MAX) + " lagi. Taip lebih spesifik untuk kecilkan hasil.";
      box.appendChild(more);
    }
  }

  input.addEventListener("input", render);
  input.addEventListener("focus", render);

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      input.value = "";
      closeResults();
      input.blur();
    }
  });

  // Tutup bila klik di luar
  document.addEventListener("click", function (e) {
    if (!wrap.contains(e.target)) closeResults();
  });

  // Tekan "/" untuk terus fokus ke carian
  document.addEventListener("keydown", function (e) {
    const tag = (e.target.tagName || "").toLowerCase();
    if (e.key === "/" && tag !== "input" && tag !== "textarea" && tag !== "select") {
      e.preventDefault();
      input.focus();
    }
  });
})();