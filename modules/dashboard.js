(function () {
  const TOTAL_SEMESTERS = 8;
  const dayNames = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  const monthNames = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"
  ];

  function el(id) {
    return document.getElementById(id);
  }

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

  function money(n) {
    return "RM " + Number(n).toFixed(2);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function totals(list) {
    let points = 0;
    let credits = 0;
    list.forEach(function (c) {
      const credit = Number(c.credit);
      if (credit > 0) {
        points += credit * Number(c.grade);
        credits += credit;
      }
    });
    return { points: points, credits: credits };
  }

  function daysLeft(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateString + "T00:00:00");
    return Math.round((due - today) / 86400000);
  }

  function describe(diff) {
    if (diff < 0) return "lewat " + Math.abs(diff) + " hari";
    if (diff === 0) return "hari ini!";
    if (diff === 1) return "esok";
    return diff + " hari lagi";
  }

  function empty(parent, text) {
    const p = document.createElement("p");
    p.className = "dash-empty";
    p.textContent = text;
    parent.appendChild(p);
  }

  // ===== Sapaan =====
  function renderHero() {
    const now = new Date();
    const h = now.getHours();
    let greeting = "Selamat malam";
    if (h < 12) greeting = "Selamat pagi";
    else if (h < 15) greeting = "Selamat tengah hari";
    else if (h < 19) greeting = "Selamat petang";

    el("dashGreeting").textContent = greeting;
    el("dashDate").textContent =
      dayNames[now.getDay()] + ", " + now.getDate() + " " + monthNames[now.getMonth()] + " " + now.getFullYear();
  }

  // ===== Angka ringkas =====
  function renderStats(accounts, items) {
    // GPA
    const sem = Number(read("gpaSemester", 1)) || 1;
    const t = totals(read("gpa-sem-" + sem, []));
    el("stGpaLabel").textContent = "GPA semester " + sem;
    el("stGpa").textContent = t.credits > 0 ? (t.points / t.credits).toFixed(2) : "-";

    let allPoints = 0;
    let allCredits = 0;
    for (let s = 1; s <= TOTAL_SEMESTERS; s++) {
      const st = totals(read("gpa-sem-" + s, []));
      allPoints += st.points;
      allCredits += st.credits;
    }
    el("stCgpa").textContent = allCredits > 0 ? (allPoints / allCredits).toFixed(2) : "-";

    // Baki semua akaun (pindahan antara akaun tak ubah jumlah)
    let balance = 0;
    accounts.forEach(function (a) {
      balance += Number(a.opening) || 0;
    });
    items.forEach(function (it) {
      if (it.type === "income") balance += it.amount;
      else if (it.type === "expense") balance -= it.amount;
    });
    el("stBalance").textContent = accounts.length > 0 || items.length > 0 ? money(balance) : "-";
  }

  // ===== Hari ini =====
  function renderToday() {
    const box = el("dashToday");
    box.innerHTML = "";

    const sem = Number(read("semester", 1)) || 1;
    el("dashSem").textContent = "(Semester " + sem + ")";

    const today = new Date().getDay();
    const startMin = window.classStartMinutes || function () { return 0; };
    const classes = read("classes-" + sem, [])
      .filter(function (c) {
        return c.day === today;
      })
      .sort(function (a, b) {
        return startMin(a.time) - startMin(b.time);
      });

    if (classes.length === 0) {
      empty(box, "Tiada kelas hari ini.");
      return;
    }

    classes.forEach(function (c) {
      const p = document.createElement("p");
      p.className = "dash-line";
      const time = document.createElement("strong");
      time.textContent = c.time;
      p.appendChild(time);
      p.appendChild(document.createTextNode(" " + c.subject));
      if (c.location) {
        const loc = document.createElement("span");
        loc.className = "class-loc";
        loc.textContent = c.location;
        p.appendChild(loc);
      }
      box.appendChild(p);
    });
  }

  // ===== Tugasan dekat =====
  function renderTasks() {
    const list = el("dashTasks");
    list.innerHTML = "";

    const all = [];
    for (let s = 1; s <= TOTAL_SEMESTERS; s++) {
      let tasks = read("tasks-" + s, null);
      if (tasks === null && s === 1) tasks = read("tasks", []);
      (tasks || []).forEach(function (t) {
        all.push({ name: t.name, date: t.date, diff: daysLeft(t.date) });
      });
    }

    const near = all
      .filter(function (t) {
        return t.diff <= 7;
      })
      .sort(function (a, b) {
        return a.date.localeCompare(b.date);
      })
      .slice(0, 5);

    if (near.length === 0) {
      const li = document.createElement("li");
      li.className = "dash-empty";
      li.textContent = "Tiada tugasan dalam 7 hari ini.";
      list.appendChild(li);
      return;
    }

    near.forEach(function (t) {
      const li = document.createElement("li");
      li.className = "task-item";
      if (t.diff < 0) li.classList.add("overdue");
      else if (t.diff <= 2) li.classList.add("soon");
      li.textContent = t.name + " | " + describe(t.diff);
      list.appendChild(li);
    });
  }

  // ===== Carta belanja =====
  let chart = null;

  function renderChart(items) {
    const wrap = document.querySelector(".dash-chart");
    const msg = el("chartMsg");
    const month = new Date().getFullYear() + "-" + pad(new Date().getMonth() + 1);

    const byCategory = {};
    let spend = 0;
    items.forEach(function (it) {
      if (it.type === "expense" && String(it.date).slice(0, 7) === month) {
        byCategory[it.category] = (byCategory[it.category] || 0) + it.amount;
        spend += it.amount;
      }
    });

    el("stSpend").textContent = money(spend);

    if (chart) {
      chart.destroy();
      chart = null;
    }

    const labels = Object.keys(byCategory);

    if (!window.Chart) {
      wrap.classList.add("hidden");
      msg.classList.remove("hidden");
      msg.textContent = "Carta tak dapat dimuatkan. Semak sambungan internet.";
      return;
    }

    if (labels.length === 0) {
      wrap.classList.add("hidden");
      msg.classList.remove("hidden");
      msg.textContent = "Belum ada belanja bulan ini. Tambah di tab Bajet.";
      return;
    }

    wrap.classList.remove("hidden");
    msg.classList.add("hidden");

    const cs = getComputedStyle(document.documentElement);
    function v(name) {
      return cs.getPropertyValue(name).trim();
    }
    const palette = [v("--accent"), v("--sky"), v("--ok"), "#a98bf0", v("--warn")];

    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    chart = new Chart(el("chartSpend"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: labels.map(function (l) {
              return byCategory[l];
            }),
            backgroundColor: labels.map(function (_, i) {
              return palette[i % palette.length];
            }),
            borderWidth: 0,
            spacing: 3,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: v("--text"), boxWidth: 12, padding: 14 }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return " " + ctx.label + ": " + money(ctx.parsed);
              }
            }
          }
        }
      }
    });
  }

  function render() {
    const accounts = read("bj-accounts", []);
    const items = read("budget", []);
    renderHero();
    renderStats(accounts, items);
    renderToday();
    renderTasks();
    renderChart(items);
  }

  // Pintasan
  document.querySelectorAll("[data-go]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const tab = document.querySelector('.tab[data-tab="' + btn.dataset.go + '"]');
      if (tab) tab.click();
    });
  });

  // Lukis semula bila tab Utama dibuka. setTimeout supaya panel dah kelihatan dahulu,
  // jika tidak carta tak tahu saiznya.
  const dashTab = document.querySelector('.tab[data-tab="dashboard"]');
  if (dashTab) {
    dashTab.addEventListener("click", function () {
      setTimeout(render, 0);
    });
  }

  setTimeout(render, 0);
})();