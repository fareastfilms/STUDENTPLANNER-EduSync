(function () {
  const dayNames = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  const TOTAL_SEMESTERS = 8;

  // Jadual Semester 1 (nilai asal, boleh diedit dalam app)
  const defaultSem1 = [];

  const semSelect = document.getElementById("semSelect");
  const classDay = document.getElementById("classDay");
  const classTime = document.getElementById("classTime");
  const classSubject = document.getElementById("classSubject");
  const classLocation = document.getElementById("classLocation");
  const addClassBtn = document.getElementById("addClassBtn");
  const timetableDiv = document.getElementById("timetable");
  const taskNameInput = document.getElementById("taskName");
  const taskDateInput = document.getElementById("taskDate");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const taskList = document.getElementById("taskList");

  // ===== Fungsi bantu simpan dan baca =====
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {}
    return JSON.parse(JSON.stringify(fallback));
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  // ===== Keadaan semasa =====
  let currentSem = Number(load("semester", 1)) || 1;
  let classes = [];
  let tasks = [];

  function loadSemester() {
    classes = load("classes-" + currentSem, currentSem === 1 ? defaultSem1 : []);
    // Tugasan lama (sebelum ada semester) dimasukkan ke Semester 1
    const oldTasks = currentSem === 1 ? load("tasks", []) : [];
    tasks = load("tasks-" + currentSem, oldTasks);
  }

  // ===== Pemilih semester =====
  for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = "Semester " + i;
    semSelect.appendChild(opt);
  }
  semSelect.value = currentSem;

  semSelect.addEventListener("change", function () {
    currentSem = Number(semSelect.value);
    save("semester", currentSem);
    loadSemester();
    renderAll();
  });
  
    // Tukar teks masa (cth "9-11 pagi", "10 pagi-1 petang") kepada minit sejak tengah malam
  function marker(s) {
    if (/pagi|\bam\b/.test(s)) return "am";
    if (/tengah\s*hari|tghari/.test(s)) return "noon";
    if (/petang|ptg|malam|\bpm\b/.test(s)) return "pm";
    return "";
  }

  function startMinutes(timeText) {
    const text = String(timeText || "").toLowerCase();
    const parts = text.split(/\s*(?:-|–|—|hingga|sampai)\s*/);
    const startPart = parts[0] || "";
    const endPart = parts.length > 1 ? parts[1] : "";

    const match = startPart.match(/(\d{1,2})(?:[.:](\d{2}))?/);
    if (!match) return 9999; // tak faham: letak di hujung

    let hour = Number(match[1]);
    const min = match[2] ? Number(match[2]) : 0;

    let m = marker(startPart);
    if (!m) {
      m = marker(text);
      // "10-1 petang": 10 mesti pagi, sebab 1 petang datang selepas 10
      const end = endPart.match(/(\d{1,2})/);
      if (m === "pm" && end && hour > Number(end[1]) && hour <= 12) {
        m = hour === 12 ? "noon" : "am";
      }
    }

    if (hour >= 13) {
      // sudah format 24 jam, contohnya 14:00
    } else if (m === "am") {
      if (hour === 12) hour = 0;
    } else if (m === "noon") {
      if (hour < 7) hour += 12;
    } else if (m === "pm") {
      if (hour < 12) hour += 12;
    } else if (hour < 7) {
      hour += 12; // tiada penanda: 1-6 dianggap petang
    }

    return hour * 60 + min;
  }

  // Dashboard guna fungsi yang sama
  window.classStartMinutes = startMinutes;

  // ===== JADUAL KELAS =====
  function renderTimetable() {
    timetableDiv.innerHTML = "";
    const today = new Date().getDay();

    if (classes.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Belum ada jadual untuk semester ini. Tambah kelas di atas.";
      timetableDiv.appendChild(p);
      return;
    }

    dayNames.forEach(function (dayName, index) {
      const todays = classes
        .filter(function (c) {
          return c.day === index;
        })
        .sort(function (a, b) {
          return startMinutes(a.time) - startMinutes(b.time);
        });
        
      if (todays.length === 0) return;

      const card = document.createElement("div");
      card.className = "day-card" + (index === today ? " today" : "");

      const title = document.createElement("h3");
      title.textContent = dayName + (index === today ? " (hari ini)" : "");
      card.appendChild(title);

      todays.forEach(function (c) {
        const line = document.createElement("div");
        line.className = "class-line";

        const text = document.createElement("span");
        text.textContent = c.time + ": " + c.subject;
        if (c.location) {
          const loc = document.createElement("span");
          loc.className = "class-loc";
          loc.textContent = " " + c.location; // spasi di depan supaya carian kekal kemas
          text.appendChild(loc);
        }

        const del = document.createElement("button");
        del.textContent = "✕";
        del.className = "removeBtn";
        del.dataset.id = c.id;

        line.appendChild(text);
        line.appendChild(del);
        card.appendChild(line);
      });

      timetableDiv.appendChild(card);
    });
  }

  addClassBtn.addEventListener("click", function () {
    const time = classTime.value.trim();
    const subject = classSubject.value.trim();
    if (!time || !subject) return;

    classes.push({
      id: Date.now(),
      day: Number(classDay.value),
      time: time,
      subject: subject,
      location: classLocation.value.trim()
    });
    save("classes-" + currentSem, classes);
    classTime.value = "";
    classSubject.value = "";
    classLocation.value = "";
    renderTimetable();
  });

  timetableDiv.addEventListener("click", function (e) {
    if (e.target.classList.contains("removeBtn")) {
      const id = Number(e.target.dataset.id);
      classes = classes.filter(function (c) {
        return c.id !== id;
      });
      save("classes-" + currentSem, classes);
      renderTimetable();
    }
  });

  // ===== TUGASAN =====
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

  function renderTasks() {
    taskList.innerHTML = "";

    if (tasks.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Belum ada tugasan";
      taskList.appendChild(li);
      return;
    }

    const sorted = tasks.slice().sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });

    sorted.forEach(function (task) {
      const diff = daysLeft(task.date);
      const li = document.createElement("li");
      li.className = "task-item";
      if (diff < 0) li.classList.add("overdue");
      else if (diff <= 2) li.classList.add("soon");

      const text = document.createElement("span");
      text.textContent = task.name + " | " + task.date + " | " + describe(diff);

      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "removeBtn";
      del.dataset.id = task.id;

      li.appendChild(text);
      li.appendChild(del);
      taskList.appendChild(li);
    });
  }

  addTaskBtn.addEventListener("click", function () {
    const name = taskNameInput.value.trim();
    const date = taskDateInput.value;
    if (!name || !date) return;

    tasks.push({ id: Date.now(), name: name, date: date });
    save("tasks-" + currentSem, tasks);
    taskNameInput.value = "";
    taskDateInput.value = "";
    renderTasks();
  });

  taskList.addEventListener("click", function (e) {
    if (e.target.classList.contains("removeBtn")) {
      const id = Number(e.target.dataset.id);
      tasks = tasks.filter(function (t) {
        return t.id !== id;
      });
      save("tasks-" + currentSem, tasks);
      renderTasks();
    }
  });

  function renderAll() {
    renderTimetable();
    renderTasks();
  }

  loadSemester();
  renderAll();
})();