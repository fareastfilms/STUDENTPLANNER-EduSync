(function () {
  const screen = document.getElementById("authScreen");
  const form = document.getElementById("authForm");
  const title = document.getElementById("authTitle");
  const emailIn = document.getElementById("authEmail");
  const passIn = document.getElementById("authPass");
  const submitBtn = document.getElementById("authSubmit");
  const switchBtn = document.getElementById("authSwitch");
  const forgotBtn = document.getElementById("authForgot");
  const skipBtn = document.getElementById("authSkip");
  const msg = document.getElementById("authMsg");
  const userBar = document.getElementById("userBar");
  const userEmail = document.getElementById("userEmail");
  const logoutBtn = document.getElementById("logoutBtn");

  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_KEY;
  const configured =
    window.supabase && url && key && url.indexOf("TAMPAL") === -1 && key.indexOf("TAMPAL") === -1;

  // Kalau belum disambung, app jalan macam biasa tanpa login
  if (!configured) return;

  const sb = window.sbClient || window.supabase.createClient(url, key);
  const redirect = location.origin + location.pathname;

  let mode = "login"; // login, signup, recover
  let skipped = false;

  function setMsg(text, good) {
    msg.textContent = text;
    msg.style.color = good ? "var(--ok)" : "var(--bad)";
  }

  function setMode(next) {
    mode = next;
    setMsg("");
    passIn.value = "";
    emailIn.hidden = next === "recover";
    emailIn.required = next !== "recover";
    forgotBtn.hidden = next !== "login";
    skipBtn.hidden = next === "recover";
    switchBtn.hidden = next === "recover";
    passIn.autocomplete = next === "login" ? "current-password" : "new-password";

    if (next === "login") {
      title.textContent = "Log masuk";
      submitBtn.textContent = "Log masuk";
      switchBtn.textContent = "Belum ada akaun? Daftar";
    } else if (next === "signup") {
      title.textContent = "Daftar akaun";
      submitBtn.textContent = "Daftar";
      switchBtn.textContent = "Dah ada akaun? Log masuk";
    } else {
      title.textContent = "Kata laluan baharu";
      submitBtn.textContent = "Simpan kata laluan";
    }
  }

  function showScreen() {
    screen.classList.remove("hidden");
  }

  function applySession(session) {
    if (session) {
      screen.classList.add("hidden");
      userBar.classList.remove("hidden");
      userEmail.textContent = session.user.email || "";
    } else {
      userBar.classList.add("hidden");
      userEmail.textContent = "";
      if (!skipped) showScreen();
    }
  }

  switchBtn.addEventListener("click", function () {
    setMode(mode === "login" ? "signup" : "login");
  });

  skipBtn.addEventListener("click", function () {
    skipped = true;
    screen.classList.add("hidden");
  });

  forgotBtn.addEventListener("click", async function () {
    const email = emailIn.value.trim();
    if (!email) {
      setMsg("Taip emel dulu, kemudian klik Lupa kata laluan");
      return;
    }
    const result = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
    if (result.error) setMsg(result.error.message);
    else setMsg("Kalau emel tu berdaftar, pautan tetapan semula akan dihantar.", true);
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    submitBtn.disabled = true;
    setMsg("Sebentar...", true);

    const email = emailIn.value.trim();
    const password = passIn.value;
    let result;

    try {
      if (mode === "login") {
        result = await sb.auth.signInWithPassword({ email: email, password: password });
        if (result.error) setMsg(result.error.message);
        else setMsg("");
      } else if (mode === "signup") {
        result = await sb.auth.signUp({
          email: email,
          password: password,
          options: { emailRedirectTo: redirect }
        });
        if (result.error) setMsg(result.error.message);
        else if (!result.data.session) {
          setMsg("Semak emel awak dan klik pautan pengesahan, kemudian log masuk.", true);
          setMode("login");
          setMsg("Semak emel awak dan klik pautan pengesahan, kemudian log masuk.", true);
        }
      } else {
        result = await sb.auth.updateUser({ password: password });
        if (result.error) setMsg(result.error.message);
        else {
          setMode("login");
          const s = await sb.auth.getSession();
          applySession(s.data.session);
        }
      }
    } catch (err) {
      setMsg("Tak dapat hubungi Supabase. Semak sambungan internet.");
    }

    submitBtn.disabled = false;
  });

  logoutBtn.addEventListener("click", async function () {
    await sb.auth.signOut();
    skipped = false;
    setMode("login");
  });

  // Jangan panggil Supabase dalam callback ni (boleh menyebabkan kebuntuan)
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === "PASSWORD_RECOVERY") {
      setMode("recover");
      showScreen();
    } else {
      applySession(session);
    }
  });

  setMode("login");
  showScreen();
  sb.auth.getSession().then(function (r) {
    applySession(r.data.session);
  });
})();
