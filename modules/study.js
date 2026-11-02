(function () {
  const FOCUS = 25 * 60; // 25 minit (dalam saat)
  const BREAK = 5 * 60;  // 5 minit

  const display = document.getElementById("timerDisplay");
  const modeText = document.getElementById("timerMode");
  const subjectInput = document.getElementById("studySubject");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const logList = document.getElementById("studyLog");

  let mode = "focus";
  let remaining = FOCUS;
  let intervalId = null;
  let endTime = 0;
  let log = {};

  try {
    log = JSON.parse(localStorage.getItem("studyLog")) || {};
  } catch (e) {
    log = {};
  }

  function format(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function render() {
    display.textContent = format(remaining);
    modeText.textContent = mode === "focus" ? "Fokus" : "Rehat";
  }

  function renderLog() {
    logList.innerHTML = "";
    const names = Object.keys(log);
    if (names.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Belum ada rekod";
      logList.appendChild(li);
      return;
    }
    names.forEach(function (name) {
      const li = document.createElement("li");
      li.textContent = name + ": " + Math.round(log[name] * 10) / 10 + " minit";
      logList.appendChild(li);
    });
  }

  function saveLog() {
    try {
      localStorage.setItem("studyLog", JSON.stringify(log));
    } catch (e) {}
  }

  function stop() {
    clearInterval(intervalId);
    intervalId = null;
  }

  function finishSession() {
    if (mode === "focus") {
      const name = subjectInput.value.trim() || "Tanpa nama";
      log[name] = (log[name] || 0) + FOCUS / 60;
      saveLog();
      renderLog();
      mode = "break";
      remaining = BREAK;
    } else {
      mode = "focus";
      remaining = FOCUS;
    }
    render();
  }

  function tick() {
    remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    if (remaining === 0) {
      stop();
      finishSession();
    } else {
      render();
    }
  }

  startBtn.addEventListener("click", function () {
    if (intervalId) return;
    endTime = Date.now() + remaining * 1000;
    intervalId = setInterval(tick, 500);
  });

  pauseBtn.addEventListener("click", stop);

  resetBtn.addEventListener("click", function () {
    stop();
    mode = "focus";
    remaining = FOCUS;
    render();
  });

  render();
  renderLog();
})();