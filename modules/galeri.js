(function () {
  const albumInput = document.getElementById("glAlbum");
  const filesInput = document.getElementById("glFiles");
  const addBtn = document.getElementById("glAddBtn");
  const msg = document.getElementById("glMsg");
  const filter = document.getElementById("glFilter");
  const grid = document.getElementById("glGrid");
  const viewer = document.getElementById("glViewer");
  const big = document.getElementById("glBig");
  const caption = document.getElementById("glCaption");
  const closeBtn = document.getElementById("glClose");

  const DB_NAME = "studentPlannerGallery";
  const STORE = "photos";
  const MAX_SIZE = 1600; // piksel, sisi paling panjang

  let db = null;
  let photos = [];
  let thumbUrls = [];
  let viewerUrl = null;

  function showMsg(text) {
    msg.textContent = text;
  }

  // ===== IndexedDB =====
  function openDB() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function getAllPhotos() {
    return new Promise(function (resolve, reject) {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function putPhoto(photo) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(photo);
      tx.oncomplete = resolve;
      tx.onerror = function () {
        reject(tx.error);
      };
      tx.onabort = function () {
        reject(tx.error);
      };
    });
  }

  function removePhoto(id) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  // ===== Kecilkan gambar =====
  function resizeImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = function () {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        canvas.toBlob(
          function (blob) {
            if (blob) resolve(blob);
            else reject(new Error("toBlob gagal"));
          },
          "image/jpeg",
          0.85
        );
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Gambar tak boleh dibaca"));
      };

      img.src = url;
    });
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function dateOf(file) {
    const d = new Date(file.lastModified || Date.now());
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // ===== Paparan =====
  function renderFilter() {
    const previous = filter.value || "all";
    filter.innerHTML = "";

    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "Semua album";
    filter.appendChild(all);

    const albums = [];
    photos.forEach(function (p) {
      if (albums.indexOf(p.album) === -1) albums.push(p.album);
    });
    albums.forEach(function (a) {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      filter.appendChild(opt);
    });

    filter.value = albums.indexOf(previous) !== -1 ? previous : "all";
  }

  function renderGrid() {
    thumbUrls.forEach(function (u) {
      URL.revokeObjectURL(u);
    });
    thumbUrls = [];
    grid.innerHTML = "";

    const chosen = filter.value;
    const shown = photos
      .filter(function (p) {
        return chosen === "all" || p.album === chosen;
      })
      .sort(function (a, b) {
        return b.id - a.id;
      });

    if (shown.length === 0) {
      const p = document.createElement("p");
      p.className = "gl-empty";
      p.textContent = "Belum ada gambar";
      grid.appendChild(p);
      return;
    }

    shown.forEach(function (photo) {
      const tile = document.createElement("div");
      tile.className = "gl-tile";

      const url = URL.createObjectURL(photo.blob);
      thumbUrls.push(url);

      const img = document.createElement("img");
      img.src = url;
      img.alt = photo.album;
      img.loading = "lazy";
      img.dataset.id = photo.id;

      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "removeBtn";
      del.dataset.id = photo.id;

      tile.appendChild(img);
      tile.appendChild(del);
      grid.appendChild(tile);
    });
  }

  function render() {
    renderFilter();
    renderGrid();
  }

  filter.addEventListener("change", renderGrid);

  // ===== Pemapar gambar besar =====
  function openViewer(photo) {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    viewerUrl = URL.createObjectURL(photo.blob);
    big.src = viewerUrl;
    caption.textContent = photo.album + " | " + photo.date + " | " + photo.name;
    viewer.classList.remove("hidden");
  }

  function closeViewer() {
    viewer.classList.add("hidden");
    big.src = "";
    if (viewerUrl) {
      URL.revokeObjectURL(viewerUrl);
      viewerUrl = null;
    }
  }

  closeBtn.addEventListener("click", closeViewer);
  viewer.addEventListener("click", function (e) {
    if (e.target === viewer) closeViewer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeViewer();
  });

  grid.addEventListener("click", async function (e) {
    const id = Number(e.target.dataset.id);
    if (!id) return;

    if (e.target.classList.contains("removeBtn")) {
      if (!confirm("Padam gambar ni?")) return;
      try {
        await removePhoto(id);
        photos = photos.filter(function (p) {
          return p.id !== id;
        });
        render();
      } catch (err) {
        showMsg("Gagal padam gambar");
      }
    } else if (e.target.tagName === "IMG") {
      const photo = photos.find(function (p) {
        return p.id === id;
      });
      if (photo) openViewer(photo);
    }
  });

  // ===== Tambah gambar =====
  addBtn.addEventListener("click", async function () {
    if (!db) {
      showMsg("Simpanan gambar tak tersedia dalam browser ni (cuba tutup mod peribadi)");
      return;
    }

    const files = Array.from(filesInput.files);
    if (files.length === 0) {
      showMsg("Pilih gambar dulu");
      return;
    }

    const album = albumInput.value.trim() || "Umum";
    addBtn.disabled = true;
    let ok = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      showMsg("Memproses " + (i + 1) + " / " + files.length + "...");
      try {
        const blob = await resizeImage(files[i], MAX_SIZE);
        await putPhoto({
          id: Date.now() + i,
          album: album,
          name: files[i].name,
          date: dateOf(files[i]),
          blob: blob
        });
        ok++;
      } catch (err) {
        failed++;
      }
    }

    filesInput.value = "";

    try {
      photos = await getAllPhotos();
    } catch (err) {}

    filter.value = album;
    render();

    let text = ok + " gambar ditambah";
    if (failed > 0) text += ", " + failed + " gagal (cuba format JPG atau PNG)";
    showMsg(text);
    addBtn.disabled = false;
  });

  // ===== Mula =====
  openDB()
    .then(function (database) {
      db = database;
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist();
      }
      return getAllPhotos();
    })
    .then(function (all) {
      photos = all;
      render();
    })
    .catch(function () {
      showMsg("Simpanan gambar tak tersedia dalam browser ni");
    });
})();