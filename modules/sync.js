(function () {
  const url = window.SUPABASE_URL;
  const anon = window.SUPABASE_KEY;
  const configured =
    window.supabase && url && anon && url.indexOf("TAMPAL") === -1 && anon.indexOf("TAMPAL") === -1;
  if (!configured) return;

  const sb = window.supabase.createClient(url, anon);
  window.sbClient = sb; // auth.js guna klien yang sama

  const META_KEY = "syncMeta";
  const PENDING_KEY = "syncPending";
  const PREFIXES = ["gpa-sem-", "classes-", "tasks-"];
  const NAMES = ["studyLog", "flashcards", "bj-accounts", "budget"];

  const rawSet = Storage.prototype.setItem;
  const rawGet = Storage.prototype.getItem;
  const rawRemove = Storage.prototype.removeItem;

  function lget(k) {
    try {
      return rawGet.call(localStorage, k);
    } catch (e) {
      return null;
    }
  }

  function lset(k, v) {
    try {
      rawSet.call(localStorage, k, v);
    } catch (e) {}
  }

  function lremove(k) {
    try {
      rawRemove.call(localStorage, k);
    } catch (e) {}
  }

  function readJSON(k, fallback) {
    try {
      const raw = lget(k);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function isSynced(k) {
    return NAMES.indexOf(k) !== -1 || PREFIXES.some(function (p) { return k.indexOf(p) === 0; });
  }

  // Susun kekunci objek supaya perbandingan tak terjejas oleh susunan jsonb
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map(function (k) {
        return JSON.stringify(k) + ":" + canon(v[k]);
      }).join(",") + "}";
    }
    return JSON.stringify(v);
  }

  let meta = readJSON(META_KEY, {});
  let pending = new Set(readJSON(PENDING_KEY, []));
  let session = null;
  let applying = false;
  let flushing = false;
  let pulling = false;
  let timer = null;
  let statusEl = null;

  function saveState() {
    lset(META_KEY, JSON.stringify(meta));
    lset(PENDING_KEY, JSON.stringify(Array.from(pending)));
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  }

  function touch(k) {
    meta[k] = Date.now();
    pending.add(k);
    saveState();
    schedule(1500);
  }

  // Setiap simpanan ke localStorage untuk kekunci yang disegerakkan direkod untuk dihantar
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === localStorage && !applying && isSynced(String(k))) touch(String(k));
  };

  // ===== Hantar ke awan =====
  async function flush() {
    clearTimeout(timer);
    if (!session || pending.size === 0 || flushing) return;
    if (!navigator.onLine) {
      setStatus("Offline: belum disegerak");
      return;
    }

    flushing = true;
    const sent = {};
    const rows = [];

    Array.from(pending).forEach(function (k) {
      const raw = lget(k);
      if (raw === null) return;
      let value;
      try {
        value = JSON.parse(raw);
      } catch (e) {
        value = raw;
      }
      sent[k] = meta[k];
      rows.push({
        user_id: session.user.id,
        key: k,
        value: value,
        updated_at: new Date(meta[k] || Date.now()).toISOString()
      });
    });

    setStatus("Menyegerak...");
    let failed = false;

    if (rows.length > 0) {
      try {
        const res = await sb.from("user_data").upsert(rows, { onConflict: "user_id,key" });
        failed = !!res.error;
      } catch (e) {
        failed = true;
      }
    }

    flushing = false;

    if (failed) {
      setStatus("Belum disegerak, cuba lagi...");
      schedule(8000);
      return;
    }

    Object.keys(sent).forEach(function (k) {
      if (meta[k] === sent[k]) pending.delete(k);
    });
    saveState();

    if (pending.size > 0) schedule(1500);
    else setStatus("Disimpan ke awan");
  }

  // ===== Muat turun dari awan =====
  async function pull() {
    if (!session || pulling) return;
    if (!navigator.onLine) {
      setStatus("Offline: belum disegerak");
      return;
    }

    pulling = true;
    setStatus("Menyegerak...");

    let res;
    try {
      res = await sb.from("user_data").select("key,value,updated_at");
    } catch (e) {
      res = { error: e };
    }

    if (res.error) {
      pulling = false;
      setStatus("Gagal menyegerak");
      return;
    }

    const inCloud = {};
    let changed = false;
    applying = true;

    res.data.forEach(function (row) {
      if (!isSynced(row.key)) return;
      inCloud[row.key] = true;

      const cloudTime = Date.parse(row.updated_at) || 0;
      const localTime = meta[row.key] || 0;
      const raw = lget(row.key);

      let same = false;
      if (raw !== null) {
        try {
          same = canon(JSON.parse(raw)) === canon(row.value);
        } catch (e) {}
      }

      if (same) {
        meta[row.key] = cloudTime;
        pending.delete(row.key);
      } else if (raw === null || cloudTime > localTime) {
        // Awan lebih baharu: guna awan, tapi simpan salinan data setempat dahulu
        if (raw !== null) lset("syncBackup-" + row.key, raw);
        lset(row.key, JSON.stringify(row.value));
        meta[row.key] = cloudTime;
        pending.delete(row.key);
        changed = true;
      } else {
        // Data setempat lebih baharu: hantar ke awan
        pending.add(row.key);
        if (!meta[row.key]) meta[row.key] = Date.now();
      }
    });

    applying = false;

    // Data setempat yang belum ada di awan
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSynced(k) && !inCloud[k]) {
        if (!meta[k]) meta[k] = Date.now();
        pending.add(k);
      }
    }

    saveState();
    pulling = false;
    await flush();
    if (pending.size === 0) setStatus("Disimpan ke awan");

    if (changed) {
      const a = document.activeElement;
      const typing = a && /^(input|textarea|select)$/i.test(a.tagName);
      const last = Number(sessionStorage.getItem("syncReloadAt")) || 0;
      if (!typing && Date.now() - last > 10000) {
        sessionStorage.setItem("syncReloadAt", String(Date.now()));
        location.reload();
      } else {
        setStatus("Ada data baharu. Refresh untuk lihat.");
      }
    }
  }

  // ===== Log keluar: buang data dari peranti ini (data kekal di awan) =====
  function onSignedOut() {
    if (pending.size > 0) return; // ada perubahan belum dihantar, jangan buang

    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (isSynced(k) || k === META_KEY || k === PENDING_KEY || k.indexOf("syncBackup-") === 0)) {
        toRemove.push(k);
      }
    }
    if (toRemove.length === 0) return;

    toRemove.forEach(lremove);
    location.reload();
  }

  // ===== Penunjuk status di bar atas =====
  const bar = document.getElementById("userBar");
  if (bar) {
    statusEl = document.createElement("span");
    statusEl.id = "syncStatus";
    bar.insertBefore(statusEl, bar.firstChild);
  }

  sb.auth.onAuthStateChange(function (event, s) {
    session = s;
    if (event === "SIGNED_OUT") {
      setTimeout(onSignedOut, 0);
    } else if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s) {
      // Jangan panggil Supabase terus dalam callback ini
      setTimeout(pull, 0);
    }
  });

  window.addEventListener("online", function () {
    if (session) pull();
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && session) pull();
  });
})();