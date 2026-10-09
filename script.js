/* ============================================
   MUKU EXPLOITS v2.0 — Main Controller
   ============================================ */

(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const cleanIMEI = (s) => String(s).replace(/[^\d]/g, "");

  // Merge auto-expanded DB
  if (window.MukuAutoExpand) {
    const total = window.MukuAutoExpand.merge();
    console.log(`[MUKU] Database loaded: ${total} devices`);
  }

  // ---------- Luhn ----------
  function luhnValid(imei) {
    if (!/^\d{15}$/.test(imei)) return false;
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let d = parseInt(imei[i], 10);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return sum % 10 === 0;
  }

  function computeCheckDigit(first14) {
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let d = parseInt(first14[i], 10);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return (10 - (sum % 10)) % 10;
  }

  function generateValidIMEI() {
    const prefixes = Object.keys(window.MukuDB);
    const tac = prefixes[Math.floor(Math.random() * prefixes.length)];
    let base = tac;
    for (let i = 0; i < 6; i++) base += Math.floor(Math.random() * 10);
    return base + computeCheckDigit(base);
  }

  // ---------- Format ----------
  function formatIMEI(imei) {
    if (imei.length !== 15) return imei;
    return `${imei.slice(0,2)} ${imei.slice(2,8)} ${imei.slice(8,14)} ${imei.slice(14)}`;
  }

  function liveFormat(value) {
    const d = cleanIMEI(value).slice(0, 15);
    const p = [];
    if (d.length > 0) p.push(d.slice(0, 2));
    if (d.length > 2) p.push(d.slice(2, 8));
    if (d.length > 8) p.push(d.slice(8, 14));
    if (d.length > 14) p.push(d.slice(14, 15));
    return p.join(" ");
  }

  // ---------- Lookup ----------
  function findDevice(imei) {
    const tac = imei.slice(0, 8);
    if (window.MukuDB[tac]) return { ...window.MukuDB[tac], matched: "exact" };

    for (let len = 7; len >= 6; len--) {
      const key = tac.slice(0, len);
      for (const dbTac of Object.keys(window.MukuDB)) {
        if (dbTac.startsWith(key)) {
          return { ...window.MukuDB[dbTac], matched: `partial-${len}` };
        }
      }
    }
    return null;
  }

  function fallbackDevice(imei) {
    const rbi = imei.slice(0, 2);
    return {
      brand: window.MukuBrandGuess[rbi] || "Unknown",
      model: "Model not in local database",
      code: "—", year: "—", os: "—", chipset: "—", gpu: "—",
      image: null,
      dims: { h: "—", w: "—", t: "—", wt: "—" },
      display: { type: "—", res: "—", size: "—" },
      network: { g5: false, g4: false, g3: false, g2: false },
      battery: { type: "—", cap: "—" },
      camera: { main: "—", selfie: "—" },
      unknown: true
    };
  }

  // ---------- Image loading ----------
  async function loadDeviceImage(device) {
    const wrapper = $("#deviceImageWrapper");
    const img = $("#deviceImage");
    const fallbackInitial = $("#fallbackInitial");
    const brandInitial = (device.brand || "?")[0].toUpperCase();

    wrapper.classList.remove("failed");
    wrapper.classList.add("loading");
    img.style.display = "none";
    fallbackInitial.style.display = "none";

    if (!device.image || device.unknown) {
      wrapper.classList.remove("loading");
      wrapper.classList.add("failed");
      fallbackInitial.textContent = brandInitial;
      fallbackInitial.style.display = "block";
      return;
    }

    const sources = [
      `https://fdn2.gsmarena.com/vv/bigpic/${device.image}.jpg`,
      `https://fdn2.gsmarena.com/vv/pics/${device.image}-1.jpg`
    ];

    for (const url of sources) {
      const loaded = await tryLoadImage(url);
      if (loaded) {
        wrapper.classList.remove("loading");
        img.src = url;
        img.style.display = "block";
        img.onerror = () => {
          wrapper.classList.add("failed");
          img.style.display = "none";
          fallbackInitial.textContent = brandInitial;
          fallbackInitial.style.display = "block";
        };
        return;
      }
    }

    wrapper.classList.remove("loading");
    wrapper.classList.add("failed");
    fallbackInitial.textContent = brandInitial;
    fallbackInitial.style.display = "block";
  }

  function tryLoadImage(url) {
    return new Promise((resolve) => {
      const test = new Image();
      const timer = setTimeout(() => {
        test.onload = test.onerror = null;
        resolve(false);
      }, 4000);
      test.onload = () => { clearTimeout(timer); resolve(true); };
      test.onerror = () => { clearTimeout(timer); resolve(false); };
      test.src = url;
    });
  }

  // ---------- Render ----------
  function showState(state) {
    $("#emptyState").classList.toggle("hidden", state !== "empty");
    $("#loadingState").classList.toggle("hidden", state !== "loading");
    $("#resultArea").classList.toggle("hidden", state !== "result");
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? "—";
  }

  function setBool(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val ? "✓ True" : "✗ False";
    el.className = val ? "net-yes" : "net-no";
  }

  async function renderResult(imei, device, isValid) {
    setText("bannerIMEI", formatIMEI(imei));
    const validTag = $("#validTag");
    if (isValid) {
      validTag.textContent = "✓ Valid IMEI";
      validTag.style.background = "linear-gradient(135deg, #1e40af, #059669)";
    } else {
      validTag.textContent = "✗ Invalid IMEI";
      validTag.style.background = "#dc2626";
    }
    setText("successTitle", isValid ? "IMEI Found Successfully" : "IMEI Found (Checksum Failed)");

    setText("dBrand", device.brand);
    setText("dModel", device.model);
    setText("dIMEI", formatIMEI(imei));
    setText("dCode", device.code);
    setText("dYear", device.year);
    setText("dOS", device.os);
    setText("dChipset", device.chipset);
    setText("dGPU", device.gpu);

    setText("sHeight", device.dims?.h);
    setText("sWidth", device.dims?.w);
    setText("sThickness", device.dims?.t);
    setText("sWeight", device.dims?.wt);

    setText("sDispType", device.display?.type);
    setText("sDispRes", device.display?.res);
    setText("sDispSize", device.display?.size);

    setBool("s5G", device.network?.g5);
    setBool("s4G", device.network?.g4);
    setBool("s3G", device.network?.g3);
    setBool("s2G", device.network?.g2);

    setText("sBatType", device.battery?.type);
    setText("sBatCap", device.battery?.cap);

    setText("sCamMain", device.camera?.main);
    setText("sCamSelfie", device.camera?.selfie);

    loadDeviceImage(device);
  }

  // ---------- Last lookup data for Full Specifications ----------
  let lastLookup = null;

  function showDialog(title, body, actions = []) {
    let modal = document.getElementById("mukuModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "mukuModal";
      modal.className = "muku-modal-backdrop";
      modal.innerHTML = '<section class="muku-modal" role="dialog" aria-modal="true" aria-labelledby="mukuModalTitle"><button class="muku-modal-close" aria-label="Close">×</button><h2 id="mukuModalTitle"></h2><div class="muku-modal-body"></div><div class="muku-modal-actions"></div></section>';
      document.body.appendChild(modal);
      modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".muku-modal-close")) modal.classList.remove("open"); });
      document.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.remove("open"); });
    }
    modal.querySelector("#mukuModalTitle").textContent = title;
    modal.querySelector(".muku-modal-body").replaceChildren();
    if (typeof body === "string") modal.querySelector(".muku-modal-body").textContent = body;
    else modal.querySelector(".muku-modal-body").appendChild(body);
    const actionBox = modal.querySelector(".muku-modal-actions"); actionBox.replaceChildren();
    actions.forEach(a => { const b = document.createElement("a"); b.className = "muku-modal-link"; b.textContent = a.label; b.href = a.href; b.target = "_blank"; b.rel = "noopener noreferrer"; actionBox.appendChild(b); });
    modal.classList.add("open");
  }

  function openFullSpecs() {
    if (!lastLookup) { toast("Pehle IMEI lookup karein."); return; }
    const d = lastLookup.device;
    const rows = [
      ["IMEI", formatIMEI(lastLookup.imei)], ["Checksum", lastLookup.valid ? "Valid" : "Invalid"],
      ["Brand", d.brand], ["Model", d.model], ["TAC / Code", d.code], ["Release year", d.year],
      ["Operating system", d.os], ["Chipset", d.chipset], ["GPU", d.gpu],
      ["Dimensions (H × W × T)", `${d.dims?.h || "—"} × ${d.dims?.w || "—"} × ${d.dims?.t || "—"}`],
      ["Weight", d.dims?.wt], ["Display", `${d.display?.type || "—"}; ${d.display?.res || "—"}; ${d.display?.size || "—"}`],
      ["Network", `5G: ${d.network?.g5 ? "Yes" : "No"}, 4G: ${d.network?.g4 ? "Yes" : "No"}, 3G: ${d.network?.g3 ? "Yes" : "No"}, 2G: ${d.network?.g2 ? "Yes" : "No"}`],
      ["Battery", `${d.battery?.type || "—"}, ${d.battery?.cap || "—"}`],
      ["Camera", `Main: ${d.camera?.main || "—"}; Selfie: ${d.camera?.selfie || "—"}`]
    ];
    const table = document.createElement("div"); table.className = "muku-spec-table";
    rows.forEach(([k,v]) => { const row = document.createElement("div"); row.className = "muku-spec-row"; const key = document.createElement("b"); key.textContent = k; const val = document.createElement("span"); val.textContent = v ?? "—"; row.append(key,val); table.appendChild(row); });
    showDialog("Full Device Specifications", table);
  }

  function openService(service) {
    const services = {
      location: { title: "Location Sharing (Permission Required)", text: "IMEI se live GPS location nahi milti. Is browser/device ki current location tabhi dikh sakti hai jab aap location permission allow karein. Target phone par bina uski permission/app ke location nahi nikali ja sakti." },
      ring: { title: "Ring / Sound Device", text: "Phone par ring bajane ke liye us phone ke owner ke account se official Find My Device / Find My service use karein. Website IMEI se remote ring command nahi bhej sakti.", links: [{label:"Google Find My Device",href:"https://android.com/find"},{label:"Apple Find Devices",href:"https://www.icloud.com/find"}] },
      lock: { title: "Remote Device Lock", text: "Remote lock ke liye phone ko pehle se owner ke account ke Find My service se linked hona chahiye. IMEI lookup se kisi phone ko lock nahi kiya ja sakta.", links: [{label:"Google Find My Device",href:"https://android.com/find"},{label:"Apple Find Devices",href:"https://www.icloud.com/find"}] },
      lost: { title: "Lost / Stolen Phone Assistance", text: "Agar aapka phone India mein kho gaya/chori hua hai, police complaint karein aur Sanchar Saathi ke CEIR portal par IMEI block request karein. IMEI aur purchase proof apne paas rakhein.", links: [{label:"Sanchar Saathi / CEIR",href:"https://sancharsaathi.gov.in/"}] },
      police: { title: "Official Assistance", text: "Phone chori ya gum hone par local police ko report karein. IMEI tracking ke liye telecom operator aur law-enforcement ki authorized process zaroori ho sakti hai. Yeh demo portal government portal nahi hai.", links: [{label:"Sanchar Saathi",href:"https://sancharsaathi.gov.in/"}] }
    };
    const item = services[service]; if (!item) return;
    const actions = item.links || [];
    if (service !== "location") { showDialog(item.title, item.text, actions); return; }
    if (!navigator.geolocation) { showDialog(item.title, "Is browser mein location feature available nahi hai."); return; }
    const wrap = document.createElement("div"); const msg = document.createElement("p"); msg.textContent = item.text; wrap.appendChild(msg);
    const status = document.createElement("p"); status.textContent = "Location permission ka intezar hai…"; wrap.appendChild(status);
    const mapLink = document.createElement("a"); mapLink.className = "muku-modal-link"; mapLink.target = "_blank"; mapLink.rel = "noopener noreferrer"; mapLink.textContent = "Open location in Maps"; mapLink.style.display = "none"; wrap.appendChild(mapLink);
    showDialog(item.title, wrap);
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(6), lon = pos.coords.longitude.toFixed(6);
      status.textContent = `Current device location: ${lat}, ${lon} (accuracy approx. ${Math.round(pos.coords.accuracy)} m).`;
      mapLink.href = `https://maps.google.com/?q=${lat},${lon}`; mapLink.style.display = "inline-flex";
    }, err => { status.textContent = err.code === 1 ? "Location permission deny hui. Browser settings mein permission allow karein." : "Location nahi mil saki. GPS/location on karke dobara try karein."; }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  // ---------- Main ----------
  async function runCheck() {
    const raw = $("#imeiInput").value;
    const imei = cleanIMEI(raw);

    if (imei.length !== 15) {
      toast("Please enter a valid 15-digit IMEI.");
      return;
    }

    showState("loading");
    await new Promise(r => setTimeout(r, 600));

    const isValid = luhnValid(imei);
    let device = findDevice(imei);
    if (!device) device = fallbackDevice(imei);

    await renderResult(imei, device, isValid);
    lastLookup = { imei, device, valid: isValid };
    showState("result");
    saveRecent(imei, isValid);

    $("#resultArea").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Recent ----------
  const RECENT_KEY = "muku_recent_imei";
  function saveRecent(imei, valid) {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
        .filter(x => x.imei !== imei);
      list.unshift({ imei, valid, ts: Date.now() });
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    } catch {}
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // ---------- DB Count ----------
  function updateDbCount() {
    const badge = document.getElementById("dbCountBadge");
    if (!badge) return;
    const count = Object.keys(window.MukuDB).length;
    const formatted = count >= 1000 ? (count / 1000).toFixed(1) + "K" : count;
    badge.textContent = `📱 ${formatted}+ Devices`;
  }

  // ---------- Init ----------
  function init() {
    const d = new Date();
    setText("lastUpdated", d.toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    }));

    updateDbCount();

    const input = $("#imeiInput");
    input.addEventListener("input", () => {
      const atEnd = input.selectionStart === input.value.length;
      input.value = liveFormat(input.value);
      if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
    });
    input.addEventListener("keydown", e => { if (e.key === "Enter") runCheck(); });

    $("#checkBtn").addEventListener("click", runCheck);
    $("#sampleBtn").addEventListener("click", () => {
      const imei = generateValidIMEI();
      input.value = liveFormat(imei);
      runCheck();
    });
    $("#viewFullBtn").addEventListener("click", openFullSpecs);

    const serviceMap = [
      ["location", /Live Location Tracking/i], ["ring", /Ring \/ Sound Device/i],
      ["lock", /Remote Device Lock/i], ["lost", /Lost \/ Stolen Status/i],
      ["police", /Police \/ Government Assistance/i]
    ];
    document.querySelectorAll(".sidebar-item.disabled, .coming-card").forEach(card => {
      card.style.cursor = "pointer";
      card.setAttribute("role", "button"); card.setAttribute("tabindex", "0");
      const activate = () => {
        const text = card.textContent;
        const match = serviceMap.find(([, re]) => re.test(text));
        if (match) openService(match[0]);
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
    });

    document.querySelectorAll(".sidebar-item:not(.disabled)").forEach(item => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".sidebar-item").forEach(x => x.classList.remove("active"));
        item.classList.add("active");
      });
    });

    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
        item.classList.add("active");
      });
    });

    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".lang-btn").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        toast(btn.textContent === "EN" ? "Language: English" : "भाषा: हिंदी");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();