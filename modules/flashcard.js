(function () {
  const subjectInput = document.getElementById("fcSubject");
  const questionInput = document.getElementById("fcQuestion");
  const answerInput = document.getElementById("fcAnswer");
  const addBtn = document.getElementById("fcAddBtn");
  const filterSelect = document.getElementById("fcFilter");
  const startBtn = document.getElementById("fcStartBtn");
  const studyDiv = document.getElementById("fcStudy");
  const progress = document.getElementById("fcProgress");
  const cardDiv = document.getElementById("fcCard");
  const knowBtn = document.getElementById("fcKnowBtn");
  const notBtn = document.getElementById("fcNotBtn");
  const stopBtn = document.getElementById("fcStopBtn");
  const list = document.getElementById("fcList");

  let cards = [];
  try {
    cards = JSON.parse(localStorage.getItem("flashcards")) || [];
  } catch (e) {
    cards = [];
  }

  function saveCards() {
    try {
      localStorage.setItem("flashcards", JSON.stringify(cards));
    } catch (e) {}
  }

  // ===== Penapis subjek =====
  function renderFilter() {
    const previous = filterSelect.value || "all";
    filterSelect.innerHTML = "";

    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "Semua subjek";
    filterSelect.appendChild(all);

    const subjects = [];
    cards.forEach(function (c) {
      if (subjects.indexOf(c.subject) === -1) subjects.push(c.subject);
    });
    subjects.forEach(function (s) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      filterSelect.appendChild(opt);
    });

    filterSelect.value = subjects.indexOf(previous) !== -1 ? previous : "all";
  }

  // ===== Senarai kad =====
  function renderList() {
    list.innerHTML = "";

    if (cards.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Belum ada kad";
      list.appendChild(li);
      return;
    }

    cards.forEach(function (c) {
      const li = document.createElement("li");
      li.className = "task-item";

      const text = document.createElement("span");
      text.textContent = "[" + c.subject + "] " + c.q;

      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "removeBtn";
      del.dataset.id = c.id;

      li.appendChild(text);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  addBtn.addEventListener("click", function () {
    const subject = subjectInput.value.trim() || "Umum";
    const q = questionInput.value.trim();
    const a = answerInput.value.trim();
    if (!q || !a) return;

    cards.push({ id: Date.now(), subject: subject, q: q, a: a });
    saveCards();
    questionInput.value = "";
    answerInput.value = "";
    renderFilter();
    renderList();
  });

  list.addEventListener("click", function (e) {
    if (e.target.classList.contains("removeBtn")) {
      const id = Number(e.target.dataset.id);
      cards = cards.filter(function (c) {
        return c.id !== id;
      });
      saveCards();
      renderFilter();
      renderList();
    }
  });

  // ===== Mod ulang kaji =====
  let queue = [];
  let total = 0;
  let misses = 0;
  let flipped = false;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  function showCard() {
    if (queue.length === 0) {
      cardDiv.textContent =
        "Siap! " + total + " kad selesai. Awak jawab \"belum tahu\" sebanyak " + misses + " kali.";
      cardDiv.classList.remove("flipped");
      progress.textContent = "";
      knowBtn.disabled = true;
      notBtn.disabled = true;
      return;
    }

    const card = queue[0];
    cardDiv.textContent = flipped ? card.a : card.q;
    cardDiv.classList.toggle("flipped", flipped);
    progress.textContent =
      "Baki: " + queue.length + " kad | " +
      (flipped ? "Jawapan" : "Soalan (klik kad untuk lihat jawapan)");
    knowBtn.disabled = !flipped;
    notBtn.disabled = !flipped;
  }

  startBtn.addEventListener("click", function () {
    const chosen = filterSelect.value;
    const pool = cards.filter(function (c) {
      return chosen === "all" || c.subject === chosen;
    });

    if (pool.length === 0) {
      studyDiv.classList.remove("hidden");
      cardDiv.textContent = "Belum ada kad untuk diulang kaji. Tambah kad dulu.";
      cardDiv.classList.remove("flipped");
      progress.textContent = "";
      knowBtn.disabled = true;
      notBtn.disabled = true;
      return;
    }

    queue = shuffle(pool.slice());
    total = queue.length;
    misses = 0;
    flipped = false;
    studyDiv.classList.remove("hidden");
    showCard();
  });

  cardDiv.addEventListener("click", function () {
    if (queue.length === 0) return;
    flipped = !flipped;
    showCard();
  });

  knowBtn.addEventListener("click", function () {
    queue.shift();
    flipped = false;
    showCard();
  });

  notBtn.addEventListener("click", function () {
    misses++;
    queue.push(queue.shift()); // hantar ke hujung giliran
    flipped = false;
    showCard();
  });

  stopBtn.addEventListener("click", function () {
    studyDiv.classList.add("hidden");
    queue = [];
  });

  renderFilter();
  renderList();
})();