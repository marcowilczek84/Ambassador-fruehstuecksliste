(() => {
  let openOnly = false;
  let scheduled = false;
  const roleKey = "ambassador-work-area";
  const previewVersion = "8.49.0";
  const languageKey = "ambassador-ui-language";
  const supportedLanguages = ["DE", "EN", "VI"];
  let activeLanguage = (() => {
    try {
      const stored = localStorage.getItem(languageKey);
      return supportedLanguages.includes(stored) ? stored : "DE";
    } catch (_) {
      return "DE";
    }
  })();

  const translations = {
    "MENÜ": ["MENU", "MENU"], "Frühstücksliste": ["Breakfast list", "Danh sách bữa sáng"],
    "REZEPTION": ["RECEPTION", "LỄ TÂN"], "SERVICE": ["SERVICE", "PHỤC VỤ"], "Service": ["Service", "Phục vụ"],
    "EINSTELLUNGEN": ["SETTINGS", "CÀI ĐẶT"], "ZUSATZ-APP": ["ADDITIONAL APP", "ỨNG DỤNG BỔ SUNG"],
    "Sprache": ["Language", "Ngôn ngữ"], "Hauptmenü": ["Main menu", "Menu chính"],
    "Menü schließen": ["Close menu", "Đóng menu"], "Menü öffnen": ["Open menu", "Mở menu"],
    "Gäste ohne Zimmer erfassen": ["Check in guests without a room", "Ghi nhận khách không có phòng"],
    "Opera- oder externe Gäste": ["Opera or external guests", "Khách Opera hoặc khách bên ngoài"],
    "Frühstück beenden": ["Finish breakfast", "Kết thúc bữa sáng"],
    "Tagesabschluss vorbereiten": ["Prepare end of day", "Chuẩn bị kết thúc ngày"],
    "Statistik": ["Statistics", "Thống kê"], "Tages- und Wochenübersicht": ["Daily and weekly overview", "Tổng quan ngày và tuần"],
    "Zimmer hinzufügen": ["Add room", "Thêm phòng"],
    "Gast manuell zur heutigen Liste ergänzen": ["Add guest manually to today's list", "Thêm khách thủ công vào danh sách hôm nay"],
    "Frühstücksliste löschen": ["Delete breakfast list", "Xóa danh sách bữa sáng"],
    "Heutige Liste entfernen": ["Remove today's list", "Xóa danh sách hôm nay"],
    "Trinkgeld": ["Tips", "Tiền boa"], "Zusatz-App öffnen": ["Open additional app", "Mở ứng dụng bổ sung"],
    "Abmelden": ["Log out", "Đăng xuất"], "Arbeitsbereich auswählen": ["Select work area", "Chọn khu vực làm việc"],
    "Arbeitsbereich wechseln": ["Change work area", "Đổi khu vực làm việc"], "Zur Startseite": ["Go to home", "Về trang chủ"],
    "Guten Morgen": ["Good morning", "Chào buổi sáng"], "Bereich auswählen": ["Select work area", "Chọn khu vực"],
    "Rezeption": ["Reception", "Lễ tân"], "Liste laden und Gäste bearbeiten": ["Load list and edit guests", "Tải danh sách và chỉnh sửa khách"],
    "Frühstücksservice": ["Breakfast service", "Phục vụ bữa sáng"],
    "Gäste erfassen und Tische verwalten": ["Check in guests and manage tables", "Ghi nhận khách và quản lý bàn"],
    "Heutige Liste": ["Today's list", "Danh sách hôm nay"], "Zimmer": ["Room", "Phòng"], "Gast": ["Guest", "Khách"],
    "Gäste": ["Guests", "Khách"], "Frühstück": ["Breakfast", "Bữa sáng"], "Bemerkung": ["Note", "Ghi chú"],
    "Bearbeiten": ["Edit", "Chỉnh sửa"], "Neue Mews-Liste laden": ["Load new Mews list", "Tải danh sách Mews mới"],
    "Mews-Liste laden": ["Load Mews list", "Tải danh sách Mews"], "Belegte Zimmer": ["Occupied rooms", "Phòng có khách"],
    "inklusive": ["included", "bao gồm"], "nicht inklusive": ["not included", "không bao gồm"],
    "✓ inklusive": ["✓ included", "✓ bao gồm"], "✓ nicht inklusive": ["✓ not included", "✓ không bao gồm"],
    "Frühstück inklusive": ["Breakfast included", "Bao gồm bữa sáng"],
    "Zimmer oder Name suchen": ["Search room or name", "Tìm phòng hoặc tên"],
    "Zimmer, Name oder Tisch suchen": ["Search room, name or table", "Tìm phòng, tên hoặc bàn"],
    "Gast bearbeiten": ["Edit guest", "Chỉnh sửa khách"], "Gast- und Aufenthaltsdaten anpassen": ["Edit guest and stay details", "Chỉnh sửa thông tin khách và lưu trú"],
    "Gastname(n)": ["Guest name(s)", "Tên khách"], "Personen": ["People", "Số người"], "Anreise": ["Arrival", "Ngày đến"],
    "Abreise": ["Departure", "Ngày đi"], "Gastinfo": ["Guest information", "Thông tin khách"], "Info": ["Info", "Thông tin"],
    "Noch keine Gastinfos gespeichert": ["No guest information saved yet", "Chưa lưu thông tin khách"],
    "Gastinfo bearbeiten": ["Edit guest information", "Chỉnh sửa thông tin khách"],
    "Keine Bemerkung gespeichert": ["No note saved", "Chưa lưu ghi chú"], "Bemerkung hinzufügen": ["Add note", "Thêm ghi chú"],
    "Abbrechen": ["Cancel", "Hủy"], "Änderungen speichern": ["Save changes", "Lưu thay đổi"],
    "Gastart": ["Guest type", "Loại khách"], "GASTART": ["GUEST TYPE", "LOẠI KHÁCH"],
    "Gastart, Anzahl und Tisch auswählen": ["Select guest type, number and table", "Chọn loại khách, số lượng và bàn"],
    "Opera Gäste": ["Opera guests", "Khách Opera"], "Gäste aus dem Hotel Opera": ["Guests from Hotel Opera", "Khách từ Hotel Opera"],
    "Externe Gäste": ["External guests", "Khách bên ngoài"], "Frühstück ohne Übernachtung": ["Breakfast without overnight stay", "Ăn sáng không lưu trú"],
    "Gästeanzahl": ["Number of guests", "Số lượng khách"], "Wie viele Gäste kommen zum Frühstück?": ["How many guests are coming for breakfast?", "Có bao nhiêu khách dùng bữa sáng?"], "Tisch auswählen": ["Select table", "Chọn bàn"],
    "TISCH AUSWÄHLEN": ["SELECT TABLE", "CHỌN BÀN"], "Ohne Tisch erfassen": ["Check in without table", "Ghi nhận không có bàn"],
    "Erfasst ✓": ["Checked in ✓", "Đã ghi nhận ✓"], "Schließen": ["Close", "Đóng"],
    "Heute erfasst": ["Checked in today", "Đã ghi nhận hôm nay"], "Rückgängig": ["Undo", "Hoàn tác"],
    "Diese Erfassung wirklich rückgängig machen?": ["Really undo this check-in?", "Bạn có thực sự muốn hoàn tác lần ghi nhận này không?"],
    "Frühstücks-Check-in": ["Breakfast check-in", "Check-in bữa sáng"],
    "Check-in rückgängig machen": ["Undo check-in", "Hoàn tác check-in"],
    "Check-in von Zimmer": ["Really undo the check-in for room", "Thực sự hoàn tác check-in phòng"],
    "wirklich rückgängig machen?": ["?", "?"],
    "Check-in wurde rückgängig gemacht": ["Check-in was undone", "Đã hoàn tác check-in"],
    "WIE VIELE GÄSTE KOMMEN JETZT ZUM FRÜHSTÜCK?": ["HOW MANY GUESTS ARE COMING TO BREAKFAST NOW?", "CÓ BAO NHIÊU KHÁCH ĐẾN ĂN SÁNG BÂY GIỜ?"],
    "Wie viele Gäste kommen jetzt zum Frühstück?": ["How many guests are coming to breakfast now?", "Có bao nhiêu khách đến ăn sáng bây giờ?"],
    "1 Gast": ["1 guest", "1 khách"], "Roomservice": ["Room service", "Phục vụ tại phòng"],
    "Frühstück wird auf das Zimmer gebracht": ["Breakfast is delivered to the room", "Bữa sáng được mang đến phòng"],
    "Weitere Zimmer hinzufügen": ["Add more rooms", "Thêm phòng khác"], "Mehrere Zimmer gemeinsam erfassen": ["Check in several rooms together", "Ghi nhận nhiều phòng cùng lúc"],
    "Alle anzeigen ›": ["Show all ›", "Hiển thị tất cả ›"], "Offene anzeigen ×": ["Show open ×", "Hiển thị chưa phục vụ ×"],
    "Noch offen": ["Still open", "Chưa phục vụ"], "Roomservice erfassen": ["Record room service", "Ghi nhận phục vụ tại phòng"],
    "Kein Tisch": ["No table", "Không có bàn"], "Tisch / Service": ["Table / service", "Bàn / phục vụ"],
    "Die Rezeption hat noch keine heutige Liste bereitgestellt.": ["Reception has not provided today's list yet.", "Lễ tân chưa cung cấp danh sách hôm nay."],
    "Nicht belegt": ["Vacant", "Phòng trống"]
  };

  const languageIndex = () => activeLanguage === "EN" ? 0 : activeLanguage === "VI" ? 1 : -1;
  function tr(german) {
    const index = languageIndex();
    return index < 0 || !translations[german] ? german : translations[german][index];
  }

  function translateUi(root = document) {
    const reverse = new Map();
    Object.entries(translations).forEach(([de, values]) => [de, ...values].forEach((value) => reverse.set(value, de)));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement?.closest("script, style, textarea, [data-no-auto-translate]")) return;
      const raw = node.nodeValue || "";
      const value = raw.trim();
      const source = reverse.get(value);
      if (!source) return;
      const translated = tr(source);
      if (translated !== value) node.nodeValue = raw.replace(value, translated);
    });
    root.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach((element) => {
      ["placeholder", "aria-label", "title"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        const source = value ? reverse.get(value) : null;
        if (source) element.setAttribute(attribute, tr(source));
      });
    });
    document.documentElement.lang = activeLanguage === "DE" ? "de" : activeLanguage === "EN" ? "en" : "vi";
  }

  const normalize = (value) => value.replace(/\s+/g, " ").trim();

  function icon(name) {
    if (name === "reception") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16M6 17a6 6 0 0 1 12 0M12 8v3M10 7h4"/></svg>';
    }
    const paths = {
      guests: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      finish: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
      add: '<path d="M12 5v14M5 12h14"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
      logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/>',
      tip: '<ellipse cx="9" cy="7" rx="5" ry="2"/><path d="M4 7v9c0 1 2 2 5 2M14 7v5"/><circle cx="17" cy="16" r="4"/><path d="M17 14v4M15.5 15h2.5"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
    };
    if (paths[name]) return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Zm12 2h1a3 3 0 0 1 0 6h-1M8 4v2m4-2v2m4-2v2"/></svg>';
  }

  const menuItem = (action, iconName, title, subtitle = "") => `
    <button type="button" class="structured-menu-item" role="menuitem" data-menu-action="${action}">
      <span class="structured-menu-icon">${icon(iconName)}</span>
      <span><strong>${tr(title)}</strong>${subtitle ? `<small>${tr(subtitle)}</small>` : ""}</span>
      <span class="structured-menu-chevron" aria-hidden="true">›</span>
    </button>`;

  function selectRole(role) {
    sessionStorage.setItem(roleKey, role);
    document.body.dataset.appRole = role;
    document.querySelector(".role-selection")?.remove();
    document.querySelector(".entry-screen")?.classList.remove("role-pending");
    schedule();
  }

  function renderRoleSelection(entry) {
    if (!entry.querySelector(".load-card")) return;
    const role = sessionStorage.getItem(roleKey);
    document.body.dataset.appRole = role || "";
    if (role) {
      entry.classList.remove("role-pending");
      document.querySelector(".role-selection")?.remove();
      return;
    }

    entry.classList.add("role-pending");
    if (entry.querySelector(".role-selection")) return;
    const currentDate = entry.querySelector(".load-date")?.textContent || "";
    const chooser = document.createElement("section");
    chooser.className = "role-selection";
    chooser.setAttribute("aria-label", "Arbeitsbereich auswählen");
    chooser.innerHTML = `
      <img class="role-logo" src="/ambassador-logo.svg?v=confirmed-20260816-0517" alt="Ambassador Hotel Zürich">
      <span class="role-eyebrow">Frühstücksliste</span>
      <h1>Bereich wählen</h1>
      <p class="role-date">${currentDate}</p>
      <div class="role-options">
        <button type="button" data-role="service">
          <span class="role-icon">${icon("service")}</span>
          <span><strong>Service</strong><small>Frühstück &amp; Check-in</small></span><b>›</b>
        </button>
        <button type="button" data-role="reception">
          <span class="role-icon">${icon("reception")}</span>
          <span><strong>Rezeption</strong><small>Gästeliste &amp; Verwaltung</small></span><b>›</b>
        </button>
      </div>`;
    chooser.querySelectorAll("[data-role]").forEach((button) => {
      button.addEventListener("click", () => selectRole(button.dataset.role));
    });
    entry.prepend(chooser);
  }

  function addRoleBadge(shell, role) {
    const title = shell.querySelector(".page-title");
    if (!title) return;
    let badge = title.querySelector(".active-role-badge");
    if (!badge) {
      badge = document.createElement("button");
      badge.type = "button";
      badge.className = "active-role-badge";
      badge.title = "Arbeitsbereich wechseln";
      badge.addEventListener("click", () => {
        sessionStorage.removeItem(roleKey);
        location.reload();
      });
      title.append(badge);
    }
    badge.textContent = tr(role === "reception" ? "Rezeption" : "Service");
  }

  function addViewSwitcher(shell, role) {
    const actions = shell.querySelector(".header-actions");
    if (!actions || actions.querySelector(".view-switch-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "view-switch-button home-button";
    button.title = "Zur Startseite";
    button.setAttribute("aria-label", button.title);
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>';
    button.addEventListener("click", () => {
      sessionStorage.removeItem(roleKey);
      location.reload();
    });
    actions.prepend(button);
  }

  function clickMenuAction(shell, label) {
    document.body.classList.add("proxy-menu-action");
    shell.querySelector(".icon-button")?.click();
    let attempts = 0;
    window.setTimeout(() => document.body.classList.remove("proxy-menu-action"), 1500);
    const triggerAction = () => {
      const labels = [label, ...(translations[label] || [])];
      const action = [...document.querySelectorAll(".menu-card button")].find((button) => {
        const text = normalize(button.textContent || "");
        return labels.some((candidate) => text.includes(candidate));
      });
      if (action) {
        const sourceMenu = action.closest(".menu-sheet");
        action.click();
        if (supportedLanguages.includes(label)) window.setTimeout(() => sourceMenu?.querySelector(".menu-close, [aria-label*='schließ'], [aria-label*='Close'], [aria-label*='Đóng']")?.click() || sourceMenu?.remove(), 180);
        window.setTimeout(() => document.body.classList.remove("proxy-menu-action"), 120);
        return;
      }
      attempts += 1;
      if (attempts < 40) window.setTimeout(triggerAction, 25);
      else document.body.classList.remove("proxy-menu-action");
    };
    window.setTimeout(triggerAction, 0);
  }

  function changeLanguage(shell, code) {
    if (!supportedLanguages.includes(code)) return;
    activeLanguage = code;
    try { localStorage.setItem(languageKey, code); } catch (_) { /* local storage may be unavailable */ }
    translateUi(document);
    [40, 160, 400].forEach((delay) => window.setTimeout(() => {
      translateUi(document);
      schedule();
    }, delay));
  }

  function ensureReliableMenu(shell, role) {
    const trigger = shell.querySelector(".header-actions .icon-button");
    if (!trigger || document.body.dataset.reliableMenuHandler === "true") return;
    document.body.dataset.reliableMenuHandler = "true";

    const closeMenu = () => document.querySelector(".reliable-app-menu-layer")?.remove();
    document.addEventListener("click", (event) => {
      const currentTrigger = event.target instanceof Element ? event.target.closest(".header-actions .icon-button") : null;
      if (!currentTrigger) return;
      if (document.body.classList.contains("proxy-menu-action")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const existing = document.querySelector(".reliable-app-menu-layer");
      if (existing) {
        existing.remove();
        return;
      }

      const layer = document.createElement("div");
      layer.className = "reliable-app-menu-layer";
      const currentRole = sessionStorage.getItem(roleKey) || role;
      const roleActions = currentRole === "reception"
        ? `${menuItem("Zimmer hinzufügen", "add", "Zimmer hinzufügen", "Gast manuell zur heutigen Liste ergänzen")}
           ${menuItem("Frühstücksliste löschen", "trash", "Frühstücksliste löschen", "Heutige Liste entfernen")}`
        : `${menuItem("special-guests", "guests", "Gäste ohne Zimmer erfassen", "Opera- oder externe Gäste")}
           ${menuItem("Frühstück beenden", "finish", "Frühstück beenden", "Tagesabschluss vorbereiten")}
           ${menuItem("Statistik", "stats", "Statistik", "Tages- und Wochenübersicht")}`;
      const tipEntry = currentRole === "service" ? `<a class="structured-menu-item" role="menuitem" href="https://silk-trinkgeld-uiux-polish.vercel.app">
        <span class="structured-menu-icon">${icon("tip")}</span><span><strong>${tr("Trinkgeld")}</strong><small>${tr("Zusatz-App öffnen")}</small></span><span class="structured-menu-chevron">›</span></a>` : "";
      layer.innerHTML = `<section class="reliable-app-menu structured-app-menu" role="menu" aria-label="${tr("Hauptmenü")}">
        <header><span><small>${tr("MENÜ")}</small><strong>${tr("Frühstücksliste")}</strong></span><button type="button" aria-label="${tr("Menü schließen")}">×</button></header>
        <div class="structured-menu-scroll">
          <section><h3>${tr(currentRole === "reception" ? "REZEPTION" : "SERVICE")}</h3>${roleActions}</section>
          <section><h3>${tr("EINSTELLUNGEN")}</h3>
            <div class="structured-language"><span class="structured-menu-icon">${icon("globe")}</span><strong>${tr("Sprache")}</strong><div role="group" aria-label="${tr("Sprache")}">
              ${supportedLanguages.map((code) => `<button type="button" data-language="${code}" aria-pressed="${String(activeLanguage === code)}">${code}</button>`).join("")}
            </div></div>
          </section>
          ${tipEntry ? `<section><h3>${tr("ZUSATZ-APP")}</h3>${tipEntry}</section>` : ""}
        </div>
        <footer>Ambassador Liste · ${previewVersion}</footer>
      </section>`;
      layer.addEventListener("click", (clickEvent) => {
        if (clickEvent.target === layer || clickEvent.target.closest(".structured-app-menu > header button")) closeMenu();
        const action = clickEvent.target.closest("[data-menu-action]");
        const language = clickEvent.target.closest("[data-language]");
        if (language) {
          const code = language.dataset.language;
          layer.querySelectorAll("[data-language]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.language === code));
          });
          window.setTimeout(() => changeLanguage(shell, code), 20);
          return;
        }
        if (!action) return;
        const label = action.dataset.menuAction;
        closeMenu();
        if (label === "special-guests") window.setTimeout(openSpecialGuestDialog, 20);
        else if (label) window.setTimeout(() => clickMenuAction(shell, label), 20);
      });
      document.body.append(layer);
    }, true);
  }

  function buildReceptionToolbar(shell) {
    const hero = shell.querySelector(".hero");
    if (!hero || hero.querySelector(".reception-toolbar")) return;
    const uniqueRooms = new Map();
    [...shell.querySelectorAll(".room-row")]
      .filter((row) => !row.querySelector(".vacant"))
      .forEach((row) => {
        const room = normalize(row.querySelector(".room-number")?.textContent || "");
        if (room && !uniqueRooms.has(room)) uniqueRooms.set(room, row);
      });
    const occupiedRows = [...uniqueRooms.values()];
    const rooms = occupiedRows.length;
    const guests = occupiedRows.reduce((total, row) => {
      const node = row.querySelector(".people");
      const match = normalize(node?.textContent || "").match(/\d+/);
      return total + (match ? Number(match[0]) : 0);
    }, 0);
    const toolbar = document.createElement("div");
    toolbar.className = "reception-toolbar";
    toolbar.innerHTML = `
      <div class="reception-summary">
        <span class="reception-summary-icon">${icon("reception")}</span>
        <span><strong>${tr("Heutige Liste")}</strong><small><b>${rooms}</b> ${tr("Zimmer")} <i>·</i> <b>${guests}</b> ${tr("Gäste")}</small></span>
      </div>
      <div class="reception-actions">
        <button type="button" class="reception-upload">${tr("Neue Mews-Liste laden")}</button>
        <button type="button" class="reception-add">＋ ${tr("Zimmer hinzufügen")}</button>
      </div>`;
    toolbar.querySelector(".reception-upload").addEventListener("click", () => {
      const fileInput = shell.querySelector('input[type="file"][accept*=".xlsx"]');
      if (fileInput) fileInput.click();
    });
    toolbar.querySelector(".reception-add").addEventListener("click", () => clickMenuAction(shell, "Zimmer hinzufügen"));
    hero.append(toolbar);
  }

  function buildReceptionTable(shell) {
    const content = shell.querySelector(".content");
    if (!content || content.querySelector(".reception-table-head")) return;
    const head = document.createElement("div");
    head.className = "reception-table-head";
    head.innerHTML = ["Zimmer", "Gast", "Gäste", "Frühstück", "Bemerkung", "Bearbeiten"].map((label) => `<span>${tr(label)}</span>`).join("");
    content.prepend(head);
  }

  function enhanceReceptionRows(shell) {
    shell.querySelectorAll(".room-row").forEach((row) => {
      let breakfast = row.querySelector(".reception-breakfast");
      if (!breakfast) {
        breakfast = document.createElement("span");
        breakfast.className = "reception-breakfast";
        row.append(breakfast);
      }
      const included = row.classList.contains("included");
      const roomNumber = Number.parseInt(normalize(row.querySelector(".room-number")?.textContent || ""), 10);
      if (Number.isFinite(roomNumber)) row.style.setProperty("--reception-room-order", String(roomNumber));
      row.classList.toggle("reception-occupied", !row.querySelector(".vacant"));
      const vacant = Boolean(row.querySelector(".vacant"));
      breakfast.classList.toggle("included", included && !vacant);
      breakfast.classList.toggle("not-applicable", vacant);
      breakfast.textContent = vacant ? "–" : included ? tr("inklusive") : tr("nicht inklusive");

      let remark = row.querySelector(".reception-remark");
      if (!remark) {
        remark = document.createElement("span");
        remark.className = "reception-remark";
        row.append(remark);
      }
      const hasRemark = Boolean(row.querySelector(".guest-info-indicator"));
      remark.classList.toggle("has-remark", hasRemark);
      remark.innerHTML = hasRemark
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM15 3v5h5M9 12h7M9 16h7"/></svg>'
        : "–";
    });

    const occupiedRooms = new Set(
      [...shell.querySelectorAll(".room-row.reception-occupied .room-number")]
        .map((node) => normalize(node.textContent || ""))
        .filter(Boolean)
    );
    const sections = [...shell.querySelectorAll(".content .section")];
    sections.forEach((section, index) => {
      section.classList.toggle("reception-continuation", index > 0);
      if (index === 0) {
        const heading = section.querySelector(".section-head h3");
        const count = section.querySelector(".section-count");
        if (heading) heading.textContent = tr("Belegte Zimmer");
        if (count) count.textContent = String(occupiedRooms.size);
      }
    });
  }

  function alignMobileInfoBadges(shell) {
    shell.querySelectorAll(".room-row").forEach((row) => {
      const source = row.querySelector(".guest-info-indicator:not(.mobile-inline-info-badge)");
      const target = row.querySelector(".room-tail");
      if (!source || !target || target.querySelector(".mobile-inline-info-badge")) return;
      const inlineInfo = source.cloneNode(true);
      inlineInfo.classList.add("mobile-inline-info-badge");
      inlineInfo.removeAttribute("aria-hidden");
      inlineInfo.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v11H9l-4 4zM8 9h8M8 12h6"/></svg>';
      inlineInfo.setAttribute("aria-label", tr("Bemerkung"));
      inlineInfo.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        source.click();
      });
      const status = target.querySelector(".room-state");
      if (status) target.insertBefore(inlineInfo, status);
      else target.append(inlineInfo);
    });
  }

  function enhanceReceptionModal(root) {
    const modal = root.querySelector(".guest-edit-modal");
    if (!modal) return;
    const checkbox = modal.querySelector('input[type="checkbox"]');
    const field = checkbox?.closest("label");
    if (!checkbox || !field) return;
    let choice = modal.querySelector(".reception-breakfast-choice");
    if (!choice) {
      choice = document.createElement("div");
      choice.className = "reception-breakfast-choice";
      choice.innerHTML = `<span>${tr("Frühstück")}</span><div><button type="button" data-included="true">${tr("inklusive")}</button><button type="button" data-included="false">${tr("nicht inklusive")}</button></div>`;
      field.after(choice);
      choice.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
          const next = button.dataset.included === "true";
          if (checkbox.checked !== next) checkbox.click();
          schedule();
        });
      });
    }
    field.classList.add("reception-original-included");
    const includedButton = choice.querySelector('[data-included="true"]');
    const excludedButton = choice.querySelector('[data-included="false"]');
    includedButton?.classList.toggle("selected", checkbox.checked);
    excludedButton?.classList.toggle("selected", !checkbox.checked);
    modal.querySelectorAll(".guest-info-block, [data-field='guest-info']").forEach((block) => block.remove());
    if (includedButton) includedButton.textContent = checkbox.checked ? tr("✓ inklusive") : tr("inklusive");
    if (excludedButton) excludedButton.textContent = checkbox.checked ? tr("nicht inklusive") : tr("✓ nicht inklusive");
  }

  function specialGuestDate() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  }

  function readDailyState(key, property, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value?.date === specialGuestDate() ? value[property] || fallback : fallback;
    } catch { return fallback; }
  }

  function readBreakfastHistory() {
    try { return JSON.parse(localStorage.getItem("ambassador-breakfast-history") || "[]"); }
    catch { return []; }
  }

  function persistBreakfastState(rooms, arrivals, activity) {
    const date = specialGuestDate();
    const updated = Date.now();
    const history = readBreakfastHistory();
    localStorage.setItem("ambassador-breakfast-rooms", JSON.stringify({ date, rooms }));
    localStorage.setItem("ambassador-breakfast-arrivals", JSON.stringify({ date, events: arrivals }));
    localStorage.setItem("ambassador-breakfast-activity-v1", JSON.stringify({ date, items: activity.slice(-30) }));
    localStorage.setItem("ambassador-breakfast-pending-sync-v1", JSON.stringify({ date, rooms, arrivals, history, activity: activity.slice(-30), updated }));
    window.dispatchEvent(new Event("focus"));
  }

  function activeRoomCheckin(roomNumber) {
    const activity = readDailyState("ambassador-breakfast-activity-v1", "items", []);
    const undone = new Set(activity.filter((item) => item.kind === "undo" && item.targetId).map((item) => item.targetId));
    return [...activity].reverse().find((item) =>
      item.kind === "checkin" &&
      !item.guestType &&
      !undone.has(item.id) &&
      Array.isArray(item.roomNumbers) &&
      item.roomNumbers.includes(roomNumber)
    ) || null;
  }

  function undoRoomCheckin(roomNumber, action) {
    const rooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
    const arrivals = readDailyState("ambassador-breakfast-arrivals", "events", []);
    const activity = readDailyState("ambassador-breakfast-activity-v1", "items", []);
    const before = action.beforeRooms?.find((room) => Number(room.room) === roomNumber);
    const current = rooms.find((room) => Number(room.room) === roomNumber);
    if (!before || !current) return false;

    const restored = {
      ...current,
      arrivedCount: Number(before.arrivedCount || 0),
      departedCount: Number(before.departedCount || 0),
      present: Boolean(before.present),
      departed: Boolean(before.departed),
      table: before.table || ""
    };
    const nextRooms = rooms.map((room) => Number(room.room) === roomNumber ? restored : room);
    const nextArrivals = arrivals.filter((event) => !(event.actionId === action.id && Number(event.room) === roomNumber));
    const remainingRooms = (action.roomNumbers || []).filter((room) => Number(room) !== roomNumber);
    const remainingBefore = (action.beforeRooms || []).filter((room) => Number(room.room) !== roomNumber);
    const remainingAfter = (action.afterRooms || []).filter((room) => Number(room.room) !== roomNumber);
    const remainingPeople = remainingAfter.reduce((sum, afterRoom) => {
      const beforeRoom = remainingBefore.find((room) => Number(room.room) === Number(afterRoom.room));
      return sum + Math.max(0, Number(afterRoom.arrivedCount || 0) - Number(beforeRoom?.arrivedCount || 0));
    }, 0);
    const nextActivity = activity.flatMap((item) => {
      if (item.id !== action.id) return [item];
      if (!remainingRooms.length) return [];
      return [{ ...item, roomNumbers: remainingRooms, beforeRooms: remainingBefore, afterRooms: remainingAfter, people: remainingPeople }];
    });
    const at = Date.now();
    nextActivity.push({
      id: `undo-room-${at}-${roomNumber}`,
      at,
      kind: "undo",
      roomNumbers: [roomNumber],
      people: Math.max(0, Number(current.arrivedCount || 0) - Number(before.arrivedCount || 0)),
      table: current.table || "",
      label: `Zimmer ${roomNumber}: Check-in rückgängig gemacht`,
      beforeRooms: [current],
      afterRooms: [restored],
      targetId: remainingRooms.length ? `${action.id}:${roomNumber}` : action.id
    });
    persistBreakfastState(nextRooms, nextArrivals, nextActivity);
    return true;
  }

  function enhanceRoomUndo(root) {
    if (document.body.dataset.appRole !== "service") return;
    const modal = root.querySelector(".guest-edit-modal");
    if (!modal || modal.querySelector(".room-checkin-management")) return;
    const roomNumber = Number.parseInt(normalize(modal.querySelector(".modal-kicker")?.textContent || "").replace(/\D+/g, ""), 10);
    if (!Number.isFinite(roomNumber)) return;
    const action = activeRoomCheckin(roomNumber);
    if (!action) return;
    const rooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
    const room = rooms.find((item) => Number(item.room) === roomNumber);
    if (!room || !Number(room.arrivedCount || 0)) return;
    const block = document.createElement("section");
    block.className = "room-checkin-management";
    const people = Math.max(0, Number(room.arrivedCount || 0) - Number(room.departedCount || 0)) || Number(action.people || 0);
    block.innerHTML = `<div><span>${tr("Frühstücks-Check-in")}</span><strong>${people} ${people === 1 ? tr("Gast") : tr("Gäste")} · ${room.table || tr("Kein Tisch")}</strong></div><button type="button" class="room-checkin-undo">${tr("Check-in rückgängig machen")}</button>`;
    const actions = modal.querySelector(".modal-actions");
    (actions?.parentElement || modal.querySelector(".modal-body"))?.insertBefore(block, actions || null);
    block.querySelector("button")?.addEventListener("click", () => {
      if (!window.confirm(`${tr("Check-in von Zimmer")} ${roomNumber} ${tr("wirklich rückgängig machen?")}`)) return;
      if (!undoRoomCheckin(roomNumber, action)) return;
      block.innerHTML = `<div><strong>${tr("Check-in wurde rückgängig gemacht")}</strong></div>`;
      window.setTimeout(() => modal.querySelector('[aria-label="Schließen"]')?.click(), 500);
    });
  }

  function saveSpecialGuestCheckin(type, people, table) {
    const date = specialGuestDate();
    const at = Date.now();
    const actionId = `special-checkin-${at}-${type}`;
    const rooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
    const arrivals = readDailyState("ambassador-breakfast-arrivals", "events", []);
    const activity = readDailyState("ambassador-breakfast-activity-v1", "items", []);
    const label = type === "opera" ? "Opera Gäste" : "Externe Gäste";
    const event = { room: type === "opera" ? -1 : -2, at, included: false, people, table, guestType: type, actionId };
    const activityItem = { id: actionId, at, kind: "checkin", roomNumbers: [], people, table, guestType: type, label: `${label}: ${people} ${people === 1 ? "Person" : "Personen"} eingecheckt`, beforeRooms: [], afterRooms: [] };
    const nextArrivals = [...arrivals, event];
    const nextActivity = [...activity, activityItem].slice(-30);
    persistBreakfastState(rooms, nextArrivals, nextActivity);
  }

  function undoSpecialGuestCheckin(actionId) {
    const rooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
    const arrivals = readDailyState("ambassador-breakfast-arrivals", "events", []);
    const activity = readDailyState("ambassador-breakfast-activity-v1", "items", []);
    const event = arrivals.find((item) => item.actionId === actionId && item.guestType);
    if (!event) return false;
    const action = activity.find((item) => item.id === actionId);
    const at = Date.now();
    const nextActivity = activity.filter((item) => item.id !== actionId);
    nextActivity.push({
      id: `undo-${at}-${actionId}`,
      at,
      kind: "undo",
      roomNumbers: [],
      people: Number(event.people || 0),
      table: event.table || "",
      guestType: event.guestType,
      label: `${event.guestType === "opera" ? "Opera Gäste" : "Externe Gäste"}: Check-in rückgängig gemacht`,
      beforeRooms: [],
      afterRooms: [],
      targetId: action?.id || actionId
    });
    persistBreakfastState(rooms, arrivals.filter((item) => item.actionId !== actionId), nextActivity);
    return true;
  }

  function specialGuestEntriesMarkup() {
    const entries = readDailyState("ambassador-breakfast-arrivals", "events", [])
      .filter((event) => event.guestType && event.actionId)
      .sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
    if (!entries.length) return "";
    return `<details class="special-guest-today"><summary>${tr("Heute erfasst")} · ${entries.reduce((sum, entry) => sum + Number(entry.people || 0), 0)} ›</summary><div class="special-guest-entry-list">${entries.map((entry) => {
      const label = entry.guestType === "opera" ? tr("Opera Gäste") : tr("Externe Gäste");
      const time = new Intl.DateTimeFormat(activeLanguage === "EN" ? "en-GB" : activeLanguage === "VI" ? "vi-VN" : "de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date(Number(entry.at || Date.now())));
      return `<div class="special-guest-entry"><span><strong>${label}</strong><small>${Number(entry.people || 0)} ${Number(entry.people || 0) === 1 ? tr("Gast") : tr("Gäste")} · ${entry.table || tr("Kein Tisch")} · ${time}</small></span><button type="button" data-special-undo="${entry.actionId}">${tr("Rückgängig")}</button></div>`;
    }).join("")}</div></details>`;
  }

  function openSpecialGuestDialog() {
    document.querySelector(".special-guest-layer")?.remove();
    const layer = document.createElement("div");
    layer.className = "modal-layer special-guest-layer";
    layer.innerHTML = `<section class="modal special-guest-modal" role="dialog" aria-modal="true" aria-labelledby="special-guest-title">
      <header class="modal-head"><div><span class="modal-kicker">SERVICE</span><h2 id="special-guest-title">Gäste ohne Zimmer erfassen</h2><p>Gastart, Anzahl und Tisch auswählen</p></div><button class="close-button" type="button" aria-label="Schließen">×</button></header>
      <div class="modal-body">
        <span class="choice-label">GASTART</span>
        <div class="special-type-picker">
          <button type="button" data-special-type="opera"><span class="special-guest-icon opera-logo"><img src="/opera-hotel-logo.webp" alt="Opera Hotel"></span><span><strong>Opera Gäste</strong><small>Gäste aus dem Hotel Opera</small></span></button>
          <button type="button" data-special-type="external"><span class="special-guest-icon">${icon("service")}</span><span><strong>Externe Gäste</strong><small>Frühstück ohne Übernachtung</small></span></button>
        </div>
        <div data-special-guest-history>${specialGuestEntriesMarkup()}</div>
        <div class="special-count"><span><strong>Gästeanzahl</strong><small>Wie viele Gäste kommen zum Frühstück?</small></span><div><button type="button" data-count-change="-1">−</button><strong data-special-count>1</strong><button type="button" data-count-change="1">+</button></div></div>
        <span class="choice-label">TISCH AUSWÄHLEN</span>
        <div class="special-table-picker">${Array.from({ length: 50 }, (_, index) => `<button type="button" data-special-table="${index + 1}">${index + 1}</button>`).join("")}</div>
        <div class="modal-actions"><button class="modal-action" type="button" data-special-cancel>Abbrechen</button><button class="modal-action primary" type="button" data-special-save disabled>Ohne Tisch erfassen</button></div>
      </div>
    </section>`;
    let type = "";
    let count = 1;
    let table = "";
    const save = layer.querySelector("[data-special-save]");
    const update = () => {
      layer.querySelector("[data-special-count]").textContent = String(count);
      save.disabled = !type;
      save.classList.toggle("is-ready", Boolean(type));
      save.textContent = table ? (activeLanguage === "EN" ? `Check in at table ${table}` : activeLanguage === "VI" ? `Ghi nhận tại bàn ${table}` : `An Tisch ${table} erfassen`) : tr("Ohne Tisch erfassen");
    };
    const close = () => layer.remove();
    layer.addEventListener("click", (event) => {
      if (event.target === layer || event.target.closest(".close-button") || event.target.closest("[data-special-cancel]")) return close();
      const typeButton = event.target.closest("[data-special-type]");
      if (typeButton) {
        type = typeButton.dataset.specialType;
        layer.querySelectorAll("[data-special-type]").forEach((button) => button.classList.toggle("selected", button === typeButton));
      }
      const change = event.target.closest("[data-count-change]");
      if (change) count = Math.max(1, Math.min(20, count + Number(change.dataset.countChange)));
      const tableButton = event.target.closest("[data-special-table]");
      if (tableButton) {
        table = tableButton.dataset.specialTable;
        layer.querySelectorAll("[data-special-table]").forEach((button) => button.classList.toggle("selected", button === tableButton));
      }
      const undoButton = event.target.closest("[data-special-undo]");
      if (undoButton) {
        if (!window.confirm(tr("Diese Erfassung wirklich rückgängig machen?"))) return;
        if (undoSpecialGuestCheckin(undoButton.dataset.specialUndo)) {
          layer.querySelector("[data-special-guest-history]").innerHTML = specialGuestEntriesMarkup();
        }
        return;
      }
      if (event.target.closest("[data-special-save]") && type) {
        saveSpecialGuestCheckin(type, count, table ? `Tisch ${table}` : "Kein Tisch");
        save.textContent = tr("Erfasst ✓");
        save.disabled = true;
        window.dispatchEvent(new Event("storage"));
        window.setTimeout(() => {
          close();
          schedule();
        }, 650);
      }
      update();
    });
    document.body.append(layer);
    update();
  }

  function applyRoleView(shell) {
    const role = sessionStorage.getItem(roleKey);
    if (!role) return;
    document.body.dataset.appRole = role;
    addRoleBadge(shell, role);
    addViewSwitcher(shell, role);
    const title = shell.querySelector(".page-title h1");
    if (title) {
      const compactHeader = window.matchMedia("(max-width: 560px)").matches;
      title.textContent = compactHeader
        ? tr("Frühstücksliste")
        : role === "reception" ? `${tr("Frühstücksliste")} · ${tr("Rezeption")}` : `${tr("Frühstücksliste")} · ${tr("Service")}`;
    }
    const search = shell.querySelector('.search-box input');
    if (search) search.placeholder = tr(role === "reception" ? "Zimmer oder Name suchen" : "Zimmer, Name oder Tisch suchen");
    if (role !== "reception") return;

    buildReceptionToolbar(shell);
    buildReceptionTable(shell);
    enhanceReceptionRows(shell);

    const editButton = shell.querySelector(".bottom-bar .bottom-button:not(.finish)");
    if (editButton && !shell.dataset.receptionEditStarted) {
      shell.dataset.receptionEditStarted = "true";
      requestAnimationFrame(() => editButton.click());
    }
  }

  function enforceRoleFunctions(root) {
    const role = sessionStorage.getItem(roleKey);
    if (!role) return;
    root.querySelectorAll("button").forEach((button) => {
      const label = normalize(button.textContent || "");
      if (role === "service" && (
        label === "Zimmer hinzufügen" ||
        label === "Frühstücksliste löschen"
      )) button.remove();
      if (role === "reception" && (
        label === "Frühstück beenden" ||
        label === "Statistik"
      )) button.remove();
    });

    root.querySelectorAll(".menu-card").forEach((menu) => {
      menu.querySelectorAll("*").forEach((node) => {
        if (node.children.length === 0 && /Ambassador Liste · 8\.\d+\.\d+/.test(normalize(node.textContent || ""))) {
          node.textContent = `Ambassador Liste · ${previewVersion}`;
        }
      });
    });
  }

  function getCheckinRoomPeople(modal) {
    const room = normalize(modal.querySelector(".modal-kicker")?.textContent || "").match(/\d+/)?.[0];
    if (!room) return null;
    const row = [...document.querySelectorAll(".room-row")].find((candidate) =>
      normalize(candidate.querySelector(".room-number")?.textContent || "") === room
    );
    const people = normalize(row?.querySelector(".people")?.textContent || "").match(/\d+/)?.[0];
    return people ? Number(people) : null;
  }

  function standardizeCheckinGuestDisplay(modal) {
    const people = getCheckinRoomPeople(modal);
    const existing = modal.querySelector(".single-guest-count");
    if (people !== 1) {
      existing?.remove();
      const countBlock = modal.querySelector(".checkin-count-block");
      const label = countBlock?.querySelector(".choice-label");
      const heading = tr("Wie viele Gäste kommen zum Frühstück?");
      if (label && label.textContent !== heading) label.textContent = heading;
      countBlock?.querySelectorAll(".checkin-quantity-grid button").forEach((button) => {
        const count = Number(normalize(button.textContent || "").match(/\d+/)?.[0]);
        const text = count ? `${count} ${count === 1 ? tr("Gast") : tr("Gäste")}` : "";
        if (text && normalize(button.textContent || "") !== text) button.textContent = text;
      });
      return;
    }
    if (existing) {
      const label = existing.querySelector(".choice-label");
      const heading = tr("Wie viele Gäste kommen zum Frühstück?");
      if (label && label.textContent !== heading) label.textContent = heading;
      return;
    }
    if (modal.querySelector(".checkin-count-block")) return;

    const block = document.createElement("div");
    block.className = "checkin-count-block single-guest-count";
    block.setAttribute("aria-label", tr("Wie viele Gäste kommen jetzt zum Frühstück?"));
    block.innerHTML = `<span class="choice-label">${tr("Wie viele Gäste kommen zum Frühstück?")}</span><div class="single-guest-value">${tr("1 Gast")}</div>`;
    const anchor = modal.querySelector(".room-service-option");
    if (anchor) anchor.before(block);
    else modal.querySelector(".modal-body")?.prepend(block);
  }

  function updateEntryForRole(entry) {
    const role = sessionStorage.getItem(roleKey);
    if (!role || entry.classList.contains("role-pending")) return;
    entry.dataset.role = role;
    const heading = entry.querySelector("h1");
    if (heading) heading.textContent = tr(role === "service" ? "Service" : "Rezeption");
    let subtitle = entry.querySelector(".entry-role-subtitle");
    if (!subtitle && heading) {
      subtitle = document.createElement("p");
      subtitle.className = "entry-role-subtitle";
      heading.after(subtitle);
    }
    if (subtitle) subtitle.textContent = role === "service" ? tr("Frühstücksservice") : (activeLanguage === "DE" ? "Gästeliste & Verwaltung" : activeLanguage === "EN" ? "Guest list & management" : "Danh sách khách & quản lý");

    const importButton = entry.querySelector(".load-choice");
    const openButton = entry.querySelector(".entry-secondary");
    const importTitle = importButton?.querySelector("strong");
    if (importTitle) importTitle.textContent = tr(openButton ? "Neue Mews-Liste laden" : "Mews-Liste laden");

    let note = entry.querySelector(".service-waiting-note");
    if (role === "service" && !entry.querySelector(".entry-secondary")) {
      if (!note) {
        note = document.createElement("p");
        note.className = "service-waiting-note";
        note.textContent = tr("Die Rezeption hat noch keine heutige Liste bereitgestellt.");
        entry.querySelector(".load-actions")?.append(note);
      }
    } else {
      note?.remove();
    }
  }

  function removeDepartureControls(root) {
    root.querySelectorAll("button").forEach((button) => {
      const label = normalize(button.textContent || "");
      if (label === "Verlassen" || label === "Alle Anwesenden verlassen") {
        button.remove();
      }
    });
  }

  function markOpenRooms(shell) {
    shell.querySelectorAll(".room-row").forEach((row) => {
      const isOpen = row.classList.contains("included") &&
        !row.classList.contains("departed") &&
        (!row.classList.contains("present") || row.classList.contains("partial"));
      row.dataset.openMatch = String(isOpen);
    });

    shell.querySelectorAll(".section").forEach((section) => {
      section.dataset.openSection = String(Boolean(section.querySelector('.room-row[data-open-match="true"]')));
    });
  }

  function updateFilter(shell) {
    const heading = shell.querySelector(".hero h2");
    if (!heading) return;

    let button = heading.querySelector(".open-filter-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "open-filter-button";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openOnly = !openOnly;
        updateFilter(shell);
      });
      heading.append(button);
    }

    shell.classList.toggle("open-only", openOnly);
    const searchInput = shell.querySelector('.search-box input');
    const searchActive = Boolean(searchInput && normalize(searchInput.value || ""));
    shell.classList.toggle("compact-results", openOnly || searchActive);
    button.setAttribute("aria-pressed", String(openOnly));
    button.textContent = openOnly ? (activeLanguage === "EN" ? "Open only ›" : activeLanguage === "VI" ? "Chỉ còn mở ›" : "Nur offene anzeigen ›") : tr("Alle anzeigen ›");
    markOpenRooms(shell);
  }

  function updateServiceOpenHeading(shell) {
    if (document.body.dataset.appRole !== "service") return;
    const section = shell.querySelector(".section");
    const heading = section?.querySelector(".section-head h3");
    const count = section?.querySelector(".section-count");
    if (!heading || !count) return;
    const number = normalize(count.textContent || "").match(/\d+/)?.[0];
    if (!number) return;
    heading.textContent = activeLanguage === "EN" ? `${number} rooms open` : activeLanguage === "VI" ? `${number} phòng chưa phục vụ` : `${number} Zimmer offen`;
    count.style.display = "none";
  }

  function addIPadSpecialGuestShortcut(shell) {
    if (document.body.dataset.appRole !== "service") return;
    const wrap = shell.querySelector(".search-wrap");
    if (!wrap || wrap.querySelector(".ipad-special-guest-shortcut")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ipad-special-guest-shortcut";
    button.innerHTML = `<span>＋</span> ${tr("Gäste ohne Zimmer erfassen").replace(" erfassen", "")}`;
    button.addEventListener("click", openSpecialGuestDialog);
    wrap.append(button);
  }

  function updateCheckinDialog(root) {
    root.querySelectorAll(".checkin-choice-modal").forEach((modal) => {
      standardizeCheckinGuestDisplay(modal);
      modal.querySelectorAll("span, div, p, small").forEach((node) => {
        if (node.children.length === 0 && ["oder tisch wählen", "or select table", "hoặc chọn bàn"].includes(normalize(node.textContent || "").toLocaleLowerCase("de-CH"))) {
          node.textContent = tr("Tisch auswählen");
        }
      });
      modal.querySelectorAll(".choice-label").forEach((label) => {
        if (normalize(label.textContent || "").toLocaleUpperCase("de-CH") === "TISCH AUSWÄHLEN") {
          label.textContent = tr("Tisch auswählen");
        }
      });
      const primary = modal.querySelector(".modal-actions .primary");
      if (!primary) return;

      const selectedTable = modal.dataset.selectedTable || normalize(modal.querySelector(".table-picker button.selected")?.textContent || "");
      const roomService = modal.querySelector(".room-service-option.selected");
      if (!modal.dataset.choiceListeners) {
        modal.dataset.choiceListeners = "true";
        modal.querySelectorAll(".table-picker button").forEach((button) => {
          button.addEventListener("click", () => {
            modal.dataset.selectedTable = normalize(button.textContent || "");
            window.setTimeout(() => updateCheckinDialog(document), 50);
          });
        });
        modal.querySelectorAll(".room-service-option").forEach((button) => {
          button.addEventListener("click", () => {
            modal.dataset.selectedTable = "";
            window.setTimeout(() => updateCheckinDialog(document), 50);
          });
        });
      }
      if (!selectedTable && !roomService) {
        primary.disabled = false;
        primary.textContent = tr("Ohne Tisch erfassen");
      } else if (selectedTable) {
        primary.textContent = activeLanguage === "EN" ? `Check in at table ${selectedTable}` : activeLanguage === "VI" ? `Ghi nhận tại bàn ${selectedTable}` : `An Tisch ${selectedTable} erfassen`;
      } else if (roomService) {
        primary.textContent = tr("Roomservice erfassen");
      }
    });

    root.querySelectorAll(".checkin-fact").forEach((fact) => {
      const label = fact.querySelector("small");
      const value = fact.querySelector("strong");
      if (label && value && normalize(label.textContent || "") === "Tisch / Service" && !normalize(value.textContent || "")) {
        value.textContent = tr("Kein Tisch");
      }
    });
  }

  function classifyDialogs(root) {
    root.querySelectorAll(".modal").forEach((modal) => {
      const title = normalize(modal.querySelector(".modal-head h2")?.textContent || "").toLowerCase();
      modal.classList.toggle("dialog-add-room", Boolean(modal.dataset.guestType) || title === "zimmer hinzufügen" || title === "add room" || title === "thêm phòng");
      modal.classList.toggle("dialog-finish-breakfast", title === "frühstück beenden" || title === "finish breakfast" || title === "kết thúc bữa sáng");
    });
  }

  function apply() {
    scheduled = false;
    const entry = document.querySelector(".entry-screen");
    if (entry) renderRoleSelection(entry);
    if (entry) updateEntryForRole(entry);
    const shell = document.querySelector(".app-shell");
    document.querySelectorAll('meta[name="app-version"]').forEach((meta) => meta.setAttribute("content", previewVersion));
    enforceRoleFunctions(document);
    removeDepartureControls(document);
    classifyDialogs(document);
    updateCheckinDialog(document);
    document.querySelectorAll(".room-state").forEach((state) => {
      const label = normalize(state.textContent || "").toLocaleLowerCase("de-CH");
      state.classList.toggle("redundant-open-status", ["noch offen", "still open", "chưa phục vụ"].includes(label));
    });
    if (shell) updateFilter(shell);
    if (shell) applyRoleView(shell);
    if (shell) alignMobileInfoBadges(shell);
    if (shell) ensureReliableMenu(shell, sessionStorage.getItem(roleKey) || "service");
    if (shell) updateServiceOpenHeading(shell);
    if (shell) addIPadSpecialGuestShortcut(shell);
    enhanceReceptionModal(document);
    enhanceRoomUndo(document);
    if (shell) {
      const finished = Boolean(shell.querySelector(".bottom-button.finish.finished"));
      shell.classList.toggle("breakfast-finished", finished);
      shell.querySelectorAll(".room-row").forEach((row) => {
        row.setAttribute("aria-disabled", String(finished));
      });
      const editButton = shell.querySelector(".bottom-bar .bottom-button:not(.finish)");
      if (editButton) editButton.disabled = finished;
    }
    translateUi(document);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.closest(".search-box")) {
      schedule();
    }
  });

  document.addEventListener("click", (event) => {
    const tableButton = event.target instanceof Element ? event.target.closest(".checkin-choice-modal .table-picker button") : null;
    if (tableButton) {
      const table = normalize(tableButton.textContent || "");
      [0, 40, 120].forEach((delay) => window.setTimeout(() => {
        const modal = document.querySelector(".checkin-choice-modal");
        const primary = modal?.querySelector(".modal-actions .primary");
        if (!modal || !primary) return;
        modal.dataset.selectedTable = table;
        primary.disabled = false;
        primary.textContent = activeLanguage === "EN" ? `Check in at table ${table}` : activeLanguage === "VI" ? `Ghi nhận tại bàn ${table}` : `An Tisch ${table} erfassen`;
      }, delay));
    }
    const roomServiceButton = event.target instanceof Element ? event.target.closest(".checkin-choice-modal .room-service-option") : null;
    if (roomServiceButton) {
      [0, 40, 120].forEach((delay) => window.setTimeout(() => {
        const modal = document.querySelector(".checkin-choice-modal");
        const primary = modal?.querySelector(".modal-actions .primary");
        if (!modal || !primary) return;
        modal.dataset.selectedTable = "";
        primary.disabled = false;
        primary.textContent = tr("Roomservice erfassen");
      }, delay));
    }
  }, true);

  window.addEventListener("resize", schedule, { passive: true });

  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
    characterData: true
  });
  schedule();
})();
