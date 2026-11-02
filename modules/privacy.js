(function () {
  const btn = document.getElementById("privacyBtn");
  const modal = document.getElementById("pinModal");
  const form = document.getElementById("pinForm");
  const title = document.getElementById("pinTitle");
  const pin1 = document.getElementById("pinInput");
  const pin2 = document.getElementById("pinInput2");
  const msg = document.getElementById("pinMsg");
  const cancelBtn = document.getElementById("pinCancel");
  const setBtn = document.getElementById("pinSetBtn");
  const clearBtn = document.getElementById("pinClearBtn");
  const bioSet = document.getElementById("bioSetBtn");
  const bioClear = document.getElementById("bioClearBtn");
  const bioMsg = document.getElementById("bioMsg");

  if (!btn || !modal) return;

  const PIN_KEY = "privacyPin";
  const LOCK_KEY = "privacyLockUntil";
  const AUTO_HIDE_MS = 30000;
  const ITERATIONS = 150000;

  let mode = "reveal"; // reveal, set, clear
  let fails = 0;
  let hideTimer = null;

  // ===== Simpan dan baca =====
  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function hasPin() {
    return !!read(PIN_KEY);
  }

  // ===== Hash PIN (PIN tak pernah disimpan sebagai teks) =====
  function toB64(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    return btoa(String.fromCharCode.apply(null, bytes));
  }

  function fromB64(str) {
    return Uint8Array.from(atob(str), function (c) {
      return c.charCodeAt(0);
    });
  }

  async function derive(pin, saltBytes) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
      "deriveBits"
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations: ITERATIONS, hash: "SHA-256" },
      material,
      256
    );
    return toB64(bits);
  }

  async function verify(pin) {
    const saved = read(PIN_KEY);
    if (!saved) return true;
    const hash = await derive(pin, fromB64(saved.salt));
    return hash === saved.hash;
  }

  function lockedSeconds() {
    const until = Number(read(LOCK_KEY)) || 0;
    const left = Math.ceil((until - Date.now()) / 1000);
    return left > 0 ? left : 0;
  }

    // ===== Face ID / Touch ID (passkey) =====
  const BIO_KEY = "privacyBio";

  function hasBio() {
    return !!read(BIO_KEY);
  }

  function bioSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  }

  function rand(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  async function bioRegister() {
    const emailEl = document.getElementById("userEmail");
    const name = (emailEl && emailEl.textContent) || "pengguna";
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: "Student Planner" },
        user: { id: rand(16), name: name, displayName: name },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred"
        },
        timeout: 60000
      }
    });
    write(BIO_KEY, { id: toB64(cred.rawId) });
  }

  async function bioAuth() {
    const saved = read(BIO_KEY);
    await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: "public-key", id: fromB64(saved.id), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return true;
  }

  // ===== Sembunyi atau tunjuk angka =====
  function setPrivate(on) {
    document.body.classList.toggle("private", on);
    btn.classList.toggle("shown", !on);
    btn.setAttribute("aria-pressed", on ? "false" : "true");
    const label = on ? "Tunjuk angka wang" : "Sembunyi angka wang";
    btn.setAttribute("aria-label", label);
    btn.title = label;

    clearTimeout(hideTimer);
    if (!on) {
      hideTimer = setTimeout(function () {
        setPrivate(true);
      }, AUTO_HIDE_MS);
    }
  }

  function refreshControls() {
    const pinned = hasPin();
    if (setBtn) setBtn.classList.toggle("hidden", pinned);
    if (clearBtn) clearBtn.classList.toggle("hidden", !pinned);

    if (bioSet && bioClear) {
      const on = hasBio();
      bioSet.classList.toggle("hidden", on);
      bioClear.classList.toggle("hidden", !on);
      if (!bioSupported() && bioMsg) {
        bioMsg.style.color = "var(--muted)";
        bioMsg.textContent = "Face ID / Touch ID tak tersedia di pelayar atau alamat ini (perlukan https).";
      }
    }
  }

  // ===== Tetingkap PIN =====
  function openModal(next) {
    mode = next;
    pin1.value = "";
    pin2.value = "";
    msg.textContent = "";
    pin2.classList.toggle("hidden", next !== "set");

    if (next === "set") {
      title.textContent = "Tetapkan PIN";
      pin1.placeholder = "PIN baharu (4 hingga 8 digit)";
    } else if (next === "clear") {
      title.textContent = "Buang PIN";
      pin1.placeholder = "PIN semasa";
    } else {
      title.textContent = "Masukkan PIN";
      pin1.placeholder = "PIN";
    }

    modal.classList.remove("hidden");
    pin1.focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
    pin1.value = "";
    pin2.value = "";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const pin = pin1.value.trim();

    if (!window.crypto || !crypto.subtle) {
      msg.textContent = "Pelayar ini tak menyokong PIN. Cuba buka melalui alamat https.";
      return;
    }

    if (mode === "set") {
      if (!/^\d{4,8}$/.test(pin)) {
        msg.textContent = "PIN mesti 4 hingga 8 digit nombor.";
        return;
      }
      if (pin !== pin2.value.trim()) {
        msg.textContent = "Dua PIN tak sama.";
        return;
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      write(PIN_KEY, { salt: toB64(salt), hash: await derive(pin, salt) });
      closeModal();
      refreshControls();
      return;
    }

    const wait = lockedSeconds();
    if (wait > 0) {
      msg.textContent = "Terlalu banyak percubaan. Cuba lagi dalam " + wait + " saat.";
      return;
    }

    if (!(await verify(pin))) {
      fails++;
      if (fails >= 5) {
        write(LOCK_KEY, Date.now() + 30000);
        fails = 0;
        msg.textContent = "Terlalu banyak percubaan. Cuba lagi dalam 30 saat.";
      } else {
        msg.textContent = "PIN salah.";
      }
      pin1.value = "";
      return;
    }

    fails = 0;
    if (mode === "clear") {
      remove(PIN_KEY);
      closeModal();
      refreshControls();
    } else {
      closeModal();
      setPrivate(false);
    }
  });

  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  btn.addEventListener("click", async function () {
    if (!document.body.classList.contains("private")) {
      setPrivate(true);
      return;
    }

    if (hasBio() && bioSupported()) {
      try {
        await bioAuth();
        setPrivate(false);
        return;
      } catch (e) {
        // dibatalkan atau gagal: cuba PIN kalau ada
      }
    }

    if (hasPin()) openModal("reveal");
    else if (!hasBio()) setPrivate(false);
  });

  if (setBtn) setBtn.addEventListener("click", function () { openModal("set"); });
  if (clearBtn) clearBtn.addEventListener("click", function () { openModal("clear"); });

    if (bioSet) {
    bioSet.addEventListener("click", async function () {
      bioMsg.style.color = "var(--bad)";
      if (!bioSupported()) {
        bioMsg.textContent = "Pelayar atau alamat ini tak menyokong Face ID / Touch ID.";
        return;
      }
      try {
        await bioRegister();
        bioMsg.style.color = "var(--ok)";
        bioMsg.textContent = "Aktif. Ikon mata kini minta Face ID / Touch ID.";
        refreshControls();
      } catch (e) {
        bioMsg.textContent = "Tak berjaya diaktifkan. Cuba lagi, atau guna PIN.";
      }
    });
  }

  if (bioClear) {
    bioClear.addEventListener("click", function () {
      remove(BIO_KEY);
      bioMsg.textContent = "";
      refreshControls();
    });
  }
  
  // Sembunyi semula bila awak tinggalkan tab, atau log keluar
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) setPrivate(true);
  });

  const logout = document.getElementById("logoutBtn");
  if (logout) logout.addEventListener("click", function () { setPrivate(true); });

  setPrivate(true);
  refreshControls();
})();