(function () {
  const TOTAL_SEMESTERS = 8;
  const grades = [
    ["A", 4.00], ["A-", 3.67], ["B+", 3.33], ["B", 3.00], ["B-", 2.67],
    ["C+", 2.33], ["C", 2.00], ["C-", 1.67], ["D+", 1.33], ["D", 1.00], ["F", 0.00]
  ];

  const semSelect = document.getElementById("gpaSemSelect");
  const coursesDiv = document.getElementById("courses");
  const addBtn = document.getElementById("addBtn");
  const result = document.getElementById("result");
  const cgpaEl = document.getElementById("cgpa");
  const semSummary = document.getElementById("semSummary");
  const targetBtn = document.getElementById("targetBtn");
  const targetResult = document.getElementById("targetResult");

  // ===== Simpan dan baca =====
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {}
    return fallback;
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function hasKey(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (e) {
      return false;
    }
  }

  // ===== Pindahkan data lama (sebelum ada semester) ke Semester 1 =====
  if (!hasKey("gpa-sem-1")) {
    const old = load("gpaCourses", []);
    if (old.length > 0) {
      const migrated = old.map(function (item) {
        const g = grades[item.gradeIndex] || grades[0];
        return { name: item.name, credit: item.credit, grade: g[1] };
      });
      save("gpa-sem-1", migrated);
    }
  }

  // ===== Muat data semua semester =====
  let currentSem = Number(load("gpaSemester", 1)) || 1;
  const data = {};
  for (let s = 1; s <= TOTAL_SEMESTERS; s++) {
    data[s] = load("gpa-sem-" + s, []);
  }

  function persist() {
    save("gpa-sem-" + currentSem, data[currentSem]);
    updateSummary();
  }

  // ===== Kiraan =====
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

  function updateSummary() {
    const t = totals(data[currentSem]);
    result.textContent = t.credits > 0 ? (t.points / t.credits).toFixed(2) : "-";

    let allPoints = 0;
    let allCredits = 0;
    semSummary.innerHTML = "";
    const ul = document.createElement("ul");

    for (let s = 1; s <= TOTAL_SEMESTERS; s++) {
      const st = totals(data[s]);
      if (st.credits > 0) {
        allPoints += st.points;
        allCredits += st.credits;
        const li = document.createElement("li");
        li.textContent =
          "Semester " + s + ": GPA " + (st.points / st.credits).toFixed(2) +
          " (" + st.credits + " kredit)";
        ul.appendChild(li);
      }
    }

    cgpaEl.textContent = allCredits > 0 ? (allPoints / allCredits).toFixed(2) : "-";
    if (ul.children.length > 0) semSummary.appendChild(ul);
  }

  // ===== Paparan baris subjek =====
  function renderRows() {
    coursesDiv.innerHTML = "";
    const list = data[currentSem];

    if (list.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Belum ada subjek untuk semester ini. Klik Tambah subjek.";
      coursesDiv.appendChild(p);
      return;
    }

    list.forEach(function (course, i) {
      const row = document.createElement("div");
      row.className = "course";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = "Nama subjek";
      nameInput.value = course.name;
      nameInput.addEventListener("input", function () {
        course.name = nameInput.value;
        persist();
      });

      const creditInput = document.createElement("input");
      creditInput.type = "number";
      creditInput.className = "credit";
      creditInput.placeholder = "Kredit";
      creditInput.min = 1;
      creditInput.max = 6;
      creditInput.value = course.credit;
      creditInput.addEventListener("input", function () {
        course.credit = creditInput.value;
        persist();
      });

      const gradeSelect = document.createElement("select");
      gradeSelect.className = "grade";
      grades.forEach(function (g) {
        const opt = document.createElement("option");
        opt.value = g[1].toFixed(2);
        opt.textContent = g[0];
        gradeSelect.appendChild(opt);
      });
      gradeSelect.value = Number(course.grade).toFixed(2);
      gradeSelect.addEventListener("change", function () {
        course.grade = Number(gradeSelect.value);
        persist();
      });

      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "removeBtn";
      del.addEventListener("click", function () {
        list.splice(i, 1);
        persist();
        renderRows();
      });

      row.appendChild(nameInput);
      row.appendChild(creditInput);
      row.appendChild(gradeSelect);
      row.appendChild(del);
      coursesDiv.appendChild(row);
    });
  }

  addBtn.addEventListener("click", function () {
    data[currentSem].push({ name: "", credit: "", grade: 4 });
    persist();
    renderRows();
  });

  // ===== Pemilih semester =====
  for (let s = 1; s <= TOTAL_SEMESTERS; s++) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = "Semester " + s;
    semSelect.appendChild(opt);
  }
  semSelect.value = currentSem;

  semSelect.addEventListener("change", function () {
    currentSem = Number(semSelect.value);
    save("gpaSemester", currentSem);
    targetResult.innerHTML = "";
    renderRows();
    updateSummary();
  });

  // ===== Mod sasaran (untuk semester yang dipilih) =====
  targetBtn.addEventListener("click", function () {
    const target = Number(document.getElementById("target").value);
    const list = data[currentSem];
    const t = totals(list);

    targetResult.innerHTML = "";

    if (!target || t.credits === 0) {
      targetResult.textContent = "Masukkan GPA sasaran dan kredit dulu";
      return;
    }

    const note = document.createElement("p");
    note.textContent =
      "Setiap baris dikira dengan anggapan subjek lain kekal pada gred yang dipilih.";
    targetResult.appendChild(note);

    const ul = document.createElement("ul");

    list.forEach(function (c) {
      const credit = Number(c.credit);
      if (credit <= 0) return;

      const gp = Number(c.grade);
      const othersPoints = t.points - credit * gp;
      const needed = (target * t.credits - othersPoints) / credit;

      let msg;
      if (needed > 4.0001) {
        msg = "sasaran tak boleh dicapai, walaupun dapat A";
      } else if (needed <= 0) {
        msg = "gred apa pun okay";
      } else {
        const ok = grades.filter(function (g) {
          return g[1] >= needed - 0.0001;
        });
        msg = "minimum " + ok[ok.length - 1][0];
      }

      const li = document.createElement("li");
      li.textContent = (c.name || "(tiada nama)") + ": " + msg;
      ul.appendChild(li);
    });

    targetResult.appendChild(ul);
  });

  renderRows();
  updateSummary();
})();