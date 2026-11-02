(function () {
  const accountsDiv = document.getElementById("bjAccounts");
  const accNameInput = document.getElementById("bjAccName");
  const accOpenInput = document.getElementById("bjAccOpen");
  const accAddBtn = document.getElementById("bjAccAddBtn");

  const typeSelect = document.getElementById("bjType");
  const descInput = document.getElementById("bjDesc");
  const amountInput = document.getElementById("bjAmount");
  const accountSelect = document.getElementById("bjAccount");
  const toSelect = document.getElementById("bjToAccount");
  const fromText = document.getElementById("bjFromText");
  const toWrap = document.getElementById("bjToWrap");
  const catWrap = document.getElementById("bjCatWrap");
  const categorySelect = document.getElementById("bjCategory");
  const dateInput = document.getElementById("bjDate");
  const addBtn = document.getElementById("bjAddBtn");
  const msg = document.getElementById("bjMsg");
  const monthInput = document.getElementById("bjMonth");
  const summary = document.getElementById("bjSummary");
  const list = document.getElementById("bjList");

  const defaultAccounts = [];

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

  let accounts = load("bj-accounts", defaultAccounts);
  let items = load("budget", []);

  // Rekod lama (sebelum ada akaun) dimasukkan ke akaun Cash
  const cashAcc =
    accounts.find(function (a) {
      return a.name === "Cash";
    }) || accounts[0];
  let migrated = false;
  items.forEach(function (it) {
    if (it.type !== "transfer" && it.account === undefined && cashAcc) {
      it.account = cashAcc.id;
      migrated = true;
    }
  });
  if (migrated) save("budget", items);

  function saveAll() {
    save("bj-accounts", accounts);
    save("budget", items);
  }

  // ===== Fungsi bantu =====
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function money(n) {
    return "RM " + n.toFixed(2);
  }

  function accName(id) {
    const a = accounts.find(function (x) {
      return x.id === id;
    });
    return a ? a.name : "(akaun dipadam)";
  }

  function showMsg(text) {
    msg.textContent = text;
  }

  dateInput.value = todayStr();
  monthInput.value = todayStr().slice(0, 7);

  // ===== Baki setiap akaun =====
  function balanceOf(acc) {
    let b = Number(acc.opening) || 0;
    items.forEach(function (it) {
      if (it.type === "income" && it.account === acc.id) b += it.amount;
      else if (it.type === "expense" && it.account === acc.id) b -= it.amount;
      else if (it.type === "transfer") {
        if (it.from === acc.id) b -= it.amount;
        if (it.to === acc.id) b += it.amount;
      }
    });
    return b;
  }

  // ===== Pilihan akaun dalam borang =====
  function fillSelect(sel) {
    const prev = sel.value;
    sel.innerHTML = "";
    accounts.forEach(function (a) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      sel.appendChild(opt);
    });
    const stillThere = accounts.some(function (a) {
      return String(a.id) === prev;
    });
    if (stillThere) sel.value = prev;
  }

  function updateFormMode() {
    const type = typeSelect.value;
    toWrap.classList.toggle("hidden", type !== "transfer");
    catWrap.classList.toggle("hidden", type !== "expense");
    fromText.textContent = type === "transfer" ? "Dari akaun" : "Akaun";
  }

  typeSelect.addEventListener("change", updateFormMode);

  // ===== Paparan akaun =====
  function renderAccounts() {
    accountsDiv.innerHTML = "";

    if (accounts.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Belum ada akaun. Tambah akaun di bawah.";
      accountsDiv.appendChild(p);
      return;
    }

    let total = 0;

    accounts.forEach(function (acc) {
      const bal = balanceOf(acc);
      total += bal;

      const card = document.createElement("div");
      card.className = "bj-acc-card";

      const name = document.createElement("span");
      name.className = "bj-acc-name";
      name.textContent = acc.name;

      const balEl = document.createElement("span");
      balEl.className = "bj-acc-bal" + (bal < 0 ? " negative" : "");
      balEl.textContent = money(bal);

      const openLabel = document.createElement("label");
      openLabel.className = "bj-open";
      openLabel.textContent = "Baki awal ";
      const openInput = document.createElement("input");
      openInput.type = "number";
      openInput.step = "0.01";
      openInput.value = acc.opening;
      openInput.addEventListener("change", function () {
        acc.opening = Number(openInput.value) || 0;
        saveAll();
        render();
      });
      openLabel.appendChild(openInput);

      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "removeBtn";
      del.dataset.id = acc.id;

      card.appendChild(name);
      card.appendChild(balEl);
      card.appendChild(openLabel);
      card.appendChild(del);
      accountsDiv.appendChild(card);
    });

    const totalP = document.createElement("p");
    totalP.className = "bj-line";
    totalP.textContent = "Jumlah semua akaun: " + money(total);
    accountsDiv.appendChild(totalP);
  }

  accAddBtn.addEventListener("click", function () {
    const name = accNameInput.value.trim();
    if (!name) {
      showMsg("Taip nama akaun dulu");
      return;
    }
    accounts.push({
      id: Date.now(),
      name: name,
      opening: Number(accOpenInput.value) || 0
    });
    saveAll();
    accNameInput.value = "";
    accOpenInput.value = "";
    showMsg("");
    render();
  });

  accountsDiv.addEventListener("click", function (e) {
    if (!e.target.classList.contains("removeBtn")) return;
    const id = Number(e.target.dataset.id);

    const used = items.some(function (it) {
      return it.account === id || it.from === id || it.to === id;
    });
    if (used) {
      showMsg("Akaun ni ada transaksi. Padam transaksinya dulu sebelum padam akaun.");
      return;
    }

    accounts = accounts.filter(function (a) {
      return a.id !== id;
    });
    saveAll();
    showMsg("");
    render();
  });

  // ===== Ringkasan bulanan dan senarai =====
    function renderMonth() {
    const month = monthInput.value;
    let income = 0;
    let expense = 0;
    const byCategory = {};

    // Baki bawa dari bulan-bulan sebelum ini
    let carry = 0;
    accounts.forEach(function (a) {
      carry += Number(a.opening) || 0;
    });

    items.forEach(function (it) {
      const itMonth = it.date.slice(0, 7);

      if (itMonth < month) {
        if (it.type === "income") carry += it.amount;
        else if (it.type === "expense") carry -= it.amount;
        return;
      }

      if (itMonth !== month) return;

      if (it.type === "income") {
        income += it.amount;
      } else if (it.type === "expense") {
        expense += it.amount;
        byCategory[it.category] = (byCategory[it.category] || 0) + it.amount;
      }
      // pindahan tak dikira sebagai pendapatan atau belanja
    });

    const closing = carry + income - expense;

    summary.innerHTML = "";

    const lines = [
      "Baki bawa dari bulan lepas: " + money(carry),
      "Pendapatan bulan ini: " + money(income),
      "Belanja bulan ini: " + money(expense),
      "Baki akhir bulan ini: " + money(closing)
    ];
    lines.forEach(function (text, i) {
      const p = document.createElement("p");
      p.className = "bj-line" + (i === 3 && closing < 0 ? " negative" : "");
      p.textContent = text;
      summary.appendChild(p);
    });

    const cats = Object.keys(byCategory);
    if (cats.length > 0) {
      const h = document.createElement("h3");
      h.textContent = "Belanja ikut kategori";
      summary.appendChild(h);

      const ul = document.createElement("ul");
      cats.forEach(function (c) {
        const li = document.createElement("li");
        li.textContent = c + ": " + money(byCategory[c]);
        ul.appendChild(li);
      });
      summary.appendChild(ul);
    }

    list.innerHTML = "";
    const shown = items
      .filter(function (it) {
        return it.date.slice(0, 7) === month;
      })
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });

    if (shown.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Tiada rekod untuk bulan ini";
      list.appendChild(li);
      return;
    }

    shown.forEach(function (it) {
      const li = document.createElement("li");
      li.className = "task-item";
      let label;

      if (it.type === "income") {
        li.classList.add("bj-income");
        label = "+" + money(it.amount) + " ke " + accName(it.account);
      } else if (it.type === "expense") {
        li.classList.add("bj-expense");
        label =
          "-" + money(it.amount) + " dari " + accName(it.account) + " (" + it.category + ")";
      } else {
        li.classList.add("bj-transfer");
        label = money(it.amount) + ": " + accName(it.from) + " → " + accName(it.to);
      }

      const text = document.createElement("span");
      text.textContent = it.date + " | " + it.desc + " | " + label;

      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "removeBtn";
      del.dataset.id = it.id;

      li.appendChild(text);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  function render() {
    fillSelect(accountSelect);
    fillSelect(toSelect);
    renderAccounts();
    renderMonth();
  }

  // ===== Tambah transaksi =====
  addBtn.addEventListener("click", function () {
    const type = typeSelect.value;
    const desc = descInput.value.trim();
    const amount = Number(amountInput.value);
    const date = dateInput.value;

    if (accounts.length === 0) {
      showMsg("Tambah akaun dulu");
      return;
    }
    if (!desc || !(amount > 0) || !date) {
      showMsg("Isi keterangan, jumlah dan tarikh dulu");
      return;
    }

    const acc = Number(accountSelect.value);

    if (type === "transfer") {
      const to = Number(toSelect.value);
      if (acc === to) {
        showMsg("Pilih dua akaun yang berbeza");
        return;
      }
      items.push({ id: Date.now(), type: "transfer", desc: desc, amount: amount, from: acc, to: to, date: date });
    } else {
      items.push({
        id: Date.now(),
        type: type,
        desc: desc,
        amount: amount,
        account: acc,
        category: type === "expense" ? categorySelect.value : "Pendapatan",
        date: date
      });
    }

    saveAll();
    showMsg("");
    descInput.value = "";
    amountInput.value = "";
    monthInput.value = date.slice(0, 7);
    render();
  });

  list.addEventListener("click", function (e) {
    if (e.target.classList.contains("removeBtn")) {
      const id = Number(e.target.dataset.id);
      items = items.filter(function (it) {
        return it.id !== id;
      });
      saveAll();
      render();
    }
  });

  monthInput.addEventListener("change", renderMonth);
  
    // ===== Reset semua data bajet =====
  const resetBtn = document.getElementById("bjResetBtn");

  resetBtn.addEventListener("click", function () {
    if (!confirm("Padam SEMUA akaun dan transaksi bajet? Ini tak boleh diundur.")) return;

    const answer = prompt("Untuk sahkan, taip RESET:");
    if (answer === null || answer.trim().toUpperCase() !== "RESET") {
      showMsg("Reset dibatalkan");
      return;
    }

    accounts = JSON.parse(JSON.stringify(defaultAccounts));
    items = [];
    saveAll();
    showMsg("Data bajet telah direset");
    render();
  });
  
  updateFormMode();
  render();
})();