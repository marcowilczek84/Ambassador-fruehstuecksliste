(() => {
  // Existing UI adapters plus the bounded F01–F14 final corrections. Persistence stays in the native app.
  document.body.id = "ambassador-ui";
  let openOnly = false;
  let scheduled = false;
  const roleKey = "ambassador-work-area";
  const previewVersion = "8.51.0";
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
    "Guten Morgen": ["Good morning", "Chào buổi sáng"], "Bereich auswählen": ["Select work area", "Chọn khu vực"], "Bereich wählen": ["Choose work area", "Chọn khu vực"],
    "Rezeption": ["Reception", "Lễ tân"], "Liste laden und Gäste bearbeiten": ["Load list and edit guests", "Tải danh sách và chỉnh sửa khách"],
    "Frühstücksservice": ["Breakfast service", "Phục vụ bữa sáng"], "Frühstück & Check-in": ["Breakfast & check-in", "Bữa sáng & check-in"],
    "Gästeliste & Verwaltung": ["Guest list & management", "Danh sách khách & quản lý"], "Heutige Liste öffnen": ["Open today's list", "Mở danh sách hôm nay"],
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
    "Alle anzeigen": ["Show all", "Hiển thị tất cả"], "Nur offene anzeigen": ["Show open only", "Chỉ hiển thị phòng còn mở"],
    "Noch offen": ["Still open", "Chưa phục vụ"], "Roomservice erfassen": ["Record room service", "Ghi nhận phục vụ tại phòng"],
    "Kein Tisch": ["No table", "Không có bàn"], "Tisch / Service": ["Table / service", "Bàn / phục vụ"],
    "Die Rezeption hat noch keine heutige Liste bereitgestellt.": ["Reception has not provided today's list yet.", "Lễ tân chưa cung cấp danh sách hôm nay."],
    "Arbeitsbereich": ["Work area", "Khu vực làm việc"],
    "Noch keine Frühstücksliste": ["No breakfast list yet", "Chưa có danh sách bữa sáng"],
    "Noch keine Liste geladen": ["No list loaded yet", "Chưa tải danh sách"],
    "Lade den aktuellen Mews-Export, um den heutigen Arbeitstag zu beginnen.": ["Load the current Mews export to start today's work.", "Tải báo cáo Mews hiện tại để bắt đầu ngày làm việc."],
    "Mews-Liste auswählen": ["Select Mews list", "Chọn danh sách Mews"],
    "Nicht belegt": ["Vacant", "Phòng trống"]
  };

  Object.assign(translations, {"Nur offene": ["Only open", "Chỉ còn mở"], "Zimmer belegt": ["Occupied rooms", "Phòng có khách"], "Gäste bearbeiten": ["Edit guests", "Chỉnh sửa khách"], "Keine Zimmer oder Gäste gefunden": ["No rooms or guests found", "Không tìm thấy phòng hoặc khách"], "Suche leeren": ["Clear search", "Xóa tìm kiếm"], "Mindestens einen Gastnamen eingeben. Ein belegtes Zimmer kann hier nicht geleert werden.": ["Enter at least one guest name. An occupied room cannot be cleared here.", "Nhập ít nhất một tên khách. Không thể làm trống phòng tại đây."], "Bitte eine ganze Personenzahl von 1 bis 8 eingeben.": ["Enter a whole number of people from 1 to 8.", "Nhập số người nguyên từ 1 đến 8."], "Die Personenzahl darf nicht kleiner als die Anzahl der Namen oder bereits erfassten Gäste sein.": ["The number of people cannot be less than the number of names or guests already checked in.", "Số người không được ít hơn số tên hoặc khách đã ghi nhận."], "Die Abreise darf nicht vor der Anreise liegen.": ["Departure cannot be before arrival.", "Ngày đi không được trước ngày đến."], "Ungespeicherte Änderungen": ["Unsaved changes", "Thay đổi chưa lưu"], "Gespeichert": ["Saved", "Đã lưu"], "Änderungen speichern?": ["Save changes?", "Lưu thay đổi?"], "Es gibt ungespeicherte Änderungen an diesem Zimmer.": ["This room has unsaved changes.", "Phòng này có thay đổi chưa lưu."], "Zurück": ["Back", "Quay lại"], "Verwerfen": ["Discard", "Hủy thay đổi"], "Speichern": ["Save", "Lưu"], "Liste wird gelesen …": ["Reading list …", "Đang đọc danh sách …"], "Laden fehlgeschlagen": ["Loading failed", "Tải thất bại"], "Aktuell": ["Up to date", "Hiện tại"], "Lokal gespeichert": ["Saved locally", "Đã lưu cục bộ"], "Wird synchronisiert …": ["Synchronising …", "Đang đồng bộ …"], "Weitere Änderungen werden synchronisiert …": ["Synchronising more changes …", "Đang đồng bộ thêm …"], "Liste lokal gelöscht": ["List deleted locally", "Đã xóa danh sách cục bộ"], "Auf allen Geräten gelöscht": ["Deleted on all devices", "Đã xóa trên mọi thiết bị"], "Gäste ohne Zimmer": ["Guests without a room", "Khách không có phòng"]});

  translations["Mindestens einen Gastnamen eingeben."]=["Enter at least one guest name.","Nhập ít nhất một tên khách."];

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
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h16v8H4zM3 13h18M8 13v-2a4 4 0 0 1 8 0v2M9 17h6M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/></svg>';
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
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Zm12 2h1a3 3 0 0 1 0 6h-1M3 21h18M8 3v2m4-2v2m4-2v2"/></svg>';
  }

  const menuItem = (action, iconName, title, subtitle = "") => `
    <button type="button" class="structured-menu-item" role="menuitem" data-menu-action="${action}">
      <span class="structured-menu-icon">${icon(iconName)}</span>
      <span><strong>${tr(title)}</strong>${subtitle ? `<small>${tr(subtitle)}</small>` : ""}</span>
    </button>`;

  function selectRole(role) {
    sessionStorage.setItem("ambassador-service-entry-transition", "pending");
    sessionStorage.setItem(roleKey, role);
    location.reload();
  }

  const workAreaTransition = Object.freeze({ duration: 4700, reducedDuration: 80 });

  function showSharedListReadyAnimation(duration = workAreaTransition.duration) {
    document.querySelector(".success-overlay")?.remove();
    const rooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
    const occupied = rooms.filter((room) => room && !room.vacant && Number(room.people || room.guests || 0) > 0);
    const guests = occupied.reduce((sum, room) => sum + Number(room.people || room.guests || 0), 0);
    const included = occupied
      .filter((room) => Boolean(room.included || room.breakfastIncluded))
      .reduce((sum, room) => sum + Number(room.people || room.guests || 0), 0);
    const occupancy = Math.min(100, Math.round((occupied.length / Math.max(1, rooms.length)) * 100));
    const layer = document.createElement("div");
    layer.className = "success-overlay";
    layer.setAttribute("role", "status");
    layer.setAttribute("aria-live", "polite");
    const copy = activeLanguage === "EN"
      ? { complete: "IMPORT COMPLETE", loaded: "List loaded successfully", ready: "Today’s breakfast list is ready.", included: "included guests", occupancy: "Hotel occupancy" }
      : activeLanguage === "VI"
        ? { complete: "ĐÃ NHẬP DỮ LIỆU", loaded: "Đã tải danh sách thành công", ready: "Danh sách ăn sáng hôm nay đã sẵn sàng.", included: "khách bao gồm ăn sáng", occupancy: "Công suất khách sạn" }
        : { complete: "IMPORT ABGESCHLOSSEN", loaded: "Liste erfolgreich geladen", ready: "Die heutige Frühstücksliste ist bereit.", included: "inklusive Gäste", occupancy: "Hotelauslastung" };
    const ringOffset = (ratio) => 314 - 314 * Math.max(0, Math.min(1, ratio));
    layer.innerHTML = `<div class="success-panel">
      <div class="success-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg></div>
      <span class="entry-eyebrow">${copy.complete}</span>
      <h2>${copy.loaded}</h2>
      <p>${copy.ready}</p>
      <div class="success-rings">
        <div class="success-metric yellow"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="50"></circle><circle class="ring-value" cx="60" cy="60" r="50" style="--ring-offset:${ringOffset(guests ? included / guests : 0)}"></circle></svg><div><strong>${included}</strong><small>${copy.included}</small></div></div>
        <div class="success-metric green"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="50"></circle><circle class="ring-value" cx="60" cy="60" r="50" style="--ring-offset:${ringOffset(occupied.length / Math.max(1, rooms.length))}"></circle></svg><div><strong>${occupancy}%</strong><small>${copy.occupancy}</small></div></div>
      </div>
    </div>`;
    document.body.append(layer);
    layer.style.setProperty("--entry-transition-duration", `${duration}ms`);
    window.setTimeout(() => layer.remove(), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? workAreaTransition.reducedDuration : duration);
  }

  // Approved Hybrid C: 32-unit vector geometry, displayed in the existing 26px role slots.
  // Source: Ambassador_Icon_Entscheidungstest, page 8; functional app icons stay unchanged.
  function roleSelectionIcon(role) {
    const head = (cx) => `<circle cx="${cx}" cy="6.5" r="3.4"/>`;
    const glyph = role === "service"
      ? `${head(11.8)}<path d="M17.1 14C15.7 13 13.8 12.8 11.5 12.8H9C5.4 12.8 3.1 15.5 3.1 19v2.9c0 1.6 1 2.6 2.6 2.6l11 .6"/><path d="M20.3 15.2h8.1c.7 0 1 .5.7 1.2l-3.8 11.1c-.2.7-.6 1.1-1.4 1.1h-8c-.7 0-1-.5-.7-1.2L19 16.3c.3-.8.6-1.1 1.3-1.1Z"/>`
      : `${head(16)}<path d="M8.8 18c.3-3.3 2.7-5.2 7.2-5.2s6.9 1.9 7.2 5.2"/><rect x="4" y="20.5" width="24" height="8.1" rx="1"/><path d="M2.8 20.5h26.4"/>`;
    return `<svg class="role-hybrid-icon" viewBox="0 0 32 32" aria-hidden="true" data-role-symbol="${role === "service" ? "person-tablet" : "person-counter"}">${glyph}</svg>`;
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
    const dateParts = currentDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    const displayDate = dateParts && activeLanguage === "DE"
      ? new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        .format(new Date(Number(dateParts[3]), Number(dateParts[2]) - 1, Number(dateParts[1])))
      : currentDate;
    const chooser = document.createElement("section");
    chooser.className = "role-selection";
    chooser.setAttribute("aria-label", "Arbeitsbereich auswählen");
    chooser.innerHTML = `
      <img class="role-logo" src="/ambassador-logo.svg?v=confirmed-20260816-0517" alt="Ambassador Hotel Zürich">
      <img class="role-app-logo" src="/breakfast-app-logo.svg" width="60" height="60" alt="" aria-hidden="true">
      <span class="role-eyebrow">Frühstücksliste</span>
      <h1>${tr("Arbeitsbereich")}</h1>
      <p class="role-date">${displayDate}</p>
      <div class="role-options">
        <button type="button" data-role="service">
          <span class="role-icon">${roleSelectionIcon("service")}</span>
          <span><strong>${tr("Service")}</strong><small>${tr("Frühstück & Check-in")}</small></span>
        </button>
        <button type="button" data-role="reception">
          <span class="role-icon">${roleSelectionIcon("reception")}</span>
          <span><strong>${tr("Rezeption")}</strong><small>${tr("Gästeliste & Verwaltung")}</small></span>
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
    // The finish action already lives in the native footer, not the native menu.
    // Forward to its existing handler; confirmation and business logic stay intact.
    if (label === "Frühstück beenden") {
      shell.querySelector(".bottom-button.finish")?.click();
      return;
    }
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
    try { localStorage.setItem(languageKey, code); localStorage.setItem("ambassador-language", code.toLowerCase()); window.dispatchEvent(new CustomEvent("ambassador-language-change", {detail:code.toLowerCase()})); } catch (_) { /* local storage may be unavailable */ }
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

    let menuContext = null;
    const closeMenu = () => {
      document.querySelector(".reliable-app-menu-layer")?.remove();
      if (!menuContext) return;
      menuContext.background.forEach(([element, inert]) => { element.inert = inert; });
      if (menuContext.trigger.isConnected) menuContext.trigger.focus({ preventScroll: true });
      menuContext = null;
    };
    document.addEventListener("click", (event) => {
      const currentTrigger = event.target instanceof Element ? event.target.closest(".header-actions .icon-button") : null;
      if (!currentTrigger) return;
      if (document.body.classList.contains("proxy-menu-action")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const existing = document.querySelector(".reliable-app-menu-layer");
      if (existing) {
        closeMenu();
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
        <span class="structured-menu-icon">${icon("tip")}</span><span><strong>${tr("Trinkgeld")}</strong><small>${tr("Zusatz-App öffnen")}</small></span></a>` : "";
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
      menuContext = {
        trigger: currentTrigger,
        background: [...document.body.children].filter((element) => !element.matches("script,style,link")).map((element) => [element, element.inert])
      };
      menuContext.background.forEach(([element]) => { element.inert = true; });
      document.body.append(layer);
      layer.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); closeMenu(); return; }
        if (event.key !== "Tab") return;
        const controls = [...layer.querySelectorAll('button:not(:disabled),a[href]')].filter((element) => element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      });
      layer.querySelector("header button")?.focus({ preventScroll: true });
    }, true);
  }

  function buildReceptionToolbar(shell) {
    const hero = shell.querySelector(".hero");
    if (!hero) return;
    const dailyRooms = readDailyState("ambassador-breakfast-rooms", "rooms", []).filter(r=>r.guests?.length && Number(r.people)>0);
    const rooms = dailyRooms.length;
    const guests = dailyRooms.reduce((sum,r)=>sum+Number(r.people),0);
    const existing = hero.querySelector(".reception-toolbar");
    if (existing) {
      const counts = existing.querySelectorAll(".reception-summary small b");
      [rooms, guests].forEach((value, index) => {
        if (counts[index] && counts[index].textContent !== String(value)) counts[index].textContent = String(value);
      });
      const label=existing.querySelector(".reception-guest-label");
      if(label && label.textContent!==tr(guests===1?"Gast":"Gäste"))label.textContent=tr(guests===1?"Gast":"Gäste");
      return;
    }
    const toolbar = document.createElement("div");
    toolbar.className = "reception-toolbar";
    toolbar.innerHTML = `
      <div class="reception-summary">
        <span class="reception-summary-icon">${icon("reception")}</span>
        <span><strong>${tr("Heutige Liste")}</strong><small><b>${rooms}</b> ${tr("Zimmer")} <i>·</i> <b>${guests}</b> <span class="reception-guest-label">${tr(guests===1?"Gast":"Gäste")}</span></small></span>
      </div>
      <div class="reception-actions">
        <button type="button" class="reception-upload">${tr("Neue Mews-Liste laden")}</button>
        <button type="button" class="reception-add">+ ${tr("Zimmer hinzufügen")}</button>
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
    head.innerHTML = ["Zimmer", "Gast", "Personen", "Anreise", "Abreise", "Frühstück", "Bemerkung"].map((label, index) => `<span class="reception-heading-${index}">${tr(label)}</span>`).join("");
    content.prepend(head);
  }

  function enhanceReceptionRows(shell) {
    const displayRooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
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
      // Display the existing room values only; no lookup by guest name and no writes.
      const room = displayRooms.find((item) => Number(item.room) === roomNumber);
      const note = room?.note || "";
      if (remark.textContent !== note) remark.textContent = note;
      remark.title = note;
      remark.classList.toggle("has-remark", Boolean(note));
      for (const field of ["arrival", "departure"]) {
        let value = row.querySelector(`.reception-${field}`);
        if (!value) {
          value = document.createElement("span");
          value.className = `reception-${field}`;
          row.append(value);
        }
        const text = vacant ? "–" : receptionDisplayDate(room?.[field]);
        if (value.textContent !== text) value.textContent = text;
      }
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

  // UI adapters never move React-owned nodes, change a handler, or persist state.
  function alignFrozenRooms(shell) {
    shell.querySelectorAll(".ipad-room-column").forEach((column, index) => {
      const start = 20 + index * 10;
      column.setAttribute("aria-label", `${start}–${start + 8}`);
      if (start !== 50 || column.querySelector(".room-placeholder")) return;
      const next = [...column.querySelectorAll(".room-row")].find((row) => Number(row.querySelector(".room-number")?.textContent) > 55);
      const placeholder = document.createElement("div");
      placeholder.className = "room-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.setAttribute("inert", "");
      column.insertBefore(placeholder, next || null);
    });
    if (document.body.dataset.appRole !== "service") return;
    shell.querySelectorAll(".room-row").forEach((row) => {
      const names = row.querySelector(".guest-names");
      if (!names) return;
      names.title = [...names.querySelectorAll("strong")].map((x) => x.textContent).join(" · ");
      const landscapeRoom = row.closest(".ipad-room-column") && window.matchMedia("(min-width:1000px) and (max-width:1400px) and (min-height:700px) and (orientation:landscape) and (pointer:coarse)").matches;
      const guestLines = [...names.querySelectorAll("strong")];
      guestLines.forEach((line, index) => {
        const extra = index === 1 && guestLines.length > 2 ? `+${guestLines.length - 2}` : "";
        if (extra) { if (line.dataset.landscapeAdditional !== extra) line.dataset.landscapeAdditional = extra; }
        else if (line.hasAttribute("data-landscape-additional")) line.removeAttribute("data-landscape-additional");
      });
      const capture = row.querySelector(".room-state");
      if (capture) {
        // Shorten only the visual numeric fraction, preserving native status text/semantics.
        const nativeStatus = normalize(capture.textContent);
        const compactStatus = nativeStatus.replace(/(\d+)\s+(?:von|of)\s+(\d+)/, "$1/$2");
        if (landscapeRoom && compactStatus !== nativeStatus) {
          if (capture.dataset.landscapeCapture !== compactStatus) capture.dataset.landscapeCapture = compactStatus;
        } else if (capture.hasAttribute("data-landscape-capture")) capture.removeAttribute("data-landscape-capture");
      }
      // Presentation text for the approved landscape strip; native text/handlers
      // remain available unchanged in every other viewport and in dialogs.
      const breakfastLabel = names.querySelector(".meta-line");
      if (breakfastLabel) {
        breakfastLabel.dataset.landscapeBreakfast = tr("inklusive");
      }
      let note = names.querySelector(".frozen-breakfast-note");
      const needsNote = !row.classList.contains("included") && !names.querySelector(".vacant");
      if (needsNote && !note) {
        note = document.createElement("small");
        note.className = "frozen-breakfast-note";
        names.append(note);
      }
      if (note) { note.hidden = !needsNote; if (note.textContent !== tr("nicht inklusive")) note.textContent = tr("nicht inklusive"); }
    });
  }

  function displayTable(value) {
    if (!value || value === "Kein Tisch") return tr("Kein Tisch");
    if (value === "Roomservice") return tr("Roomservice");
    return value.replace(/^Tisch /, activeLanguage === "EN" ? "Table " : activeLanguage === "VI" ? "Bàn " : "Tisch ");
  }

  function receptionDisplayDate(value) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!parts) return value || "–";
    return `${parts[3]}.${parts[2]}.${parts[1]}`;
  }

  function receptionReadView(root) {
    if (document.body.dataset.appRole !== "reception") return;
    const modal = root.querySelector(".guest-edit-modal");
    const selectedRoom = modal?.querySelector(".modal-kicker")?.textContent.match(/\d+/)?.[0] || "";
    root.querySelectorAll(".room-row").forEach((row) => {
      row.toggleAttribute("data-reception-selected", row.querySelector(".room-number")?.textContent.trim() === selectedRoom);
    });
    if (!modal) return;
    modal.setAttribute("aria-modal", window.innerWidth >= 700 ? "false" : "true");
    if (modal.dataset.viewRoom !== selectedRoom) {
      modal.dataset.viewRoom = selectedRoom;
      modal.dataset.uiEdit = String(window.innerWidth >= 700);
      modal.querySelector(".reception-view-body")?.remove();
      modal.querySelector(".reception-view-actions")?.remove();
    }
    if (window.innerWidth >= 700) modal.dataset.uiEdit = "true";
    const editing = modal.dataset.uiEdit === "true";
    if (modal.classList.contains("reception-view-mode") === editing) modal.classList.toggle("reception-view-mode", !editing);
    const h2 = modal.querySelector(".modal-head h2"), subline = modal.querySelector(".modal-head p");
    const names = modal.querySelector(".guest-edit-grid textarea")?.value || "";
    const title = editing && window.innerWidth < 700 ? tr("Gast bearbeiten") : `${tr("Zimmer")} ${selectedRoom}`;
    const subtitle = editing ? tr("Gast- und Aufenthaltsdaten anpassen") : names.split("\n").join(" · ");
    if (h2 && h2.textContent !== title) h2.textContent = title;
    if (subline && subline.textContent !== subtitle) subline.textContent = subtitle;
    if (modal.querySelector(".reception-view-body")) return;
    const body = document.createElement("div");
    body.className = "reception-view-body";
    const details = document.createElement("dl");
    const dates = modal.querySelectorAll('input[type="date"]');
    const values = [
      ["Anreise", receptionDisplayDate(dates[0]?.value)], ["Abreise", receptionDisplayDate(dates[1]?.value)],
      ["Personen", modal.querySelector('input[type="number"]')?.value || "–"],
      ["Frühstück", tr(modal.querySelector('input[type="checkbox"]')?.checked ? "inklusive" : "nicht inklusive")]
    ];
    values.forEach(([label, value]) => {
      const item = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = tr(label); dd.textContent = value; item.append(dt, dd); details.append(item);
    });
    const remark = document.createElement("section");
    remark.className = "reception-view-remark";
    const label = document.createElement("h3"), text = document.createElement("p");
    label.textContent = tr("Bemerkung");
    text.textContent = modal.querySelector(".final-note-field textarea")?.value || modal.querySelector(".remark-preview")?.textContent || tr("Keine Bemerkung gespeichert");
    remark.append(label, text); body.append(details, remark);
    const footer = document.createElement("div");
    footer.className = "reception-view-actions";
    const edit = document.createElement("button");
    edit.type = "button"; edit.className = "modal-action primary"; edit.textContent = tr("Gast bearbeiten");
    edit.addEventListener("click", () => {
      modal.dataset.uiEdit = "true";
      receptionReadView(document);
      modal.querySelector(".guest-edit-grid textarea")?.focus();
    });
    footer.append(edit); modal.append(body, footer);
  }

  function checkinBreakfastDisplay(root) {
    root.querySelectorAll(".checkin-choice-modal").forEach((modal) => {
      const number = modal.querySelector(".modal-kicker")?.textContent.match(/\d+/)?.[0];
      const row = [...document.querySelectorAll(".room-row")].find((item) => item.querySelector(".room-number")?.textContent.trim() === number);
      if (!row) return;
      let status = modal.querySelector(".frozen-checkin-breakfast");
      if (!status) { status = document.createElement("small"); status.className = "frozen-checkin-breakfast"; modal.querySelector(".modal-head > div")?.append(status); }
      const text = tr(row.classList.contains("included") ? "Frühstück inklusive" : "nicht inklusive");
      if (status.textContent !== text) status.textContent = text;
      status.classList.toggle("included", row.classList.contains("included"));
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
    removeManualGuestInfo(modal);
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
    choice.querySelectorAll("button").forEach((button) => { button.disabled = checkbox.disabled; });
    const includedButton = choice.querySelector('[data-included="true"]');
    const excludedButton = choice.querySelector('[data-included="false"]');
    includedButton?.classList.toggle("selected", checkbox.checked);
    excludedButton?.classList.toggle("selected", !checkbox.checked);
    if (includedButton) includedButton.textContent = checkbox.checked ? tr("✓ inklusive") : tr("inklusive");
    if (excludedButton) excludedButton.textContent = checkbox.checked ? tr("nicht inklusive") : tr("✓ nicht inklusive");
  }

  function removeManualGuestInfo(modal) {
    modal.querySelectorAll(".guest-info-block, [data-field='guest-info'], .guest-info-edit-summary").forEach((block) => block.remove());
    const guestInfoLabels = new Set([
      "gastinfo", "guest information", "thông tin khách",
      "noch keine gastinfos gespeichert", "no guest information saved yet", "chưa lưu thông tin khách",
      "+ gastinfo bearbeiten", "gastinfo bearbeiten", "edit guest information", "chỉnh sửa thông tin khách"
    ]);
    modal.querySelectorAll("h3, h4, label, p, span, button").forEach((node) => {
      const label = normalize(node.textContent || "").toLocaleLowerCase("de-CH");
      if (!guestInfoLabels.has(label)) return;
      const block = node.closest(".guest-info-block, .guest-info-edit-summary, section, fieldset, .form-section, .edit-section") || node;
      block.remove();
    });
  }

  function standardizeModalChrome(root) {
    root.querySelectorAll(".modal-head button, .guest-info-picker-head > button").forEach((button) => {
      const label = normalize(button.getAttribute("aria-label") || button.textContent || "").toLocaleLowerCase("de-CH");
      if (label === "×" || /schließ|close|đóng/.test(label)) button.classList.add("ambassador-modal-close");
    });
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
    block.innerHTML = `<div><span>${tr("Frühstücks-Check-in")}</span><strong>${people} ${people === 1 ? tr("Gast") : tr("Gäste")} · ${displayTable(room.table)}</strong></div><button type="button" class="room-checkin-undo">${tr("Check-in rückgängig machen")}</button>`;
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
      return `<div class="special-guest-entry"><span><strong>${label}</strong><small>${Number(entry.people || 0)} ${Number(entry.people || 0) === 1 ? tr("Gast") : tr("Gäste")} · ${displayTable(entry.table)} · ${time}</small></span><button type="button" data-special-undo="${entry.actionId}">${tr("Rückgängig")}</button></div>`;
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
          <button type="button" data-special-type="opera"><span class="special-guest-icon opera-logo"><img src="/opera-hotel-logo.webp" alt="Opera Hotel"></span><span class="opera-choice-copy"><strong>Opera Gäste</strong><small>Gäste aus dem Hotel Opera</small></span></button>
          <button type="button" data-special-type="external"><span class="special-guest-icon">${icon("service")}</span><span><strong>Externe Gäste</strong><small>Frühstück ohne Übernachtung</small></span></button>
        </div>
        <div data-special-guest-history>${specialGuestEntriesMarkup()}</div>
        <div class="special-count"><span><strong>Gästeanzahl</strong><small>Wie viele Gäste kommen zum Frühstück?</small></span><div><button type="button" data-count-change="-1">−</button><strong data-special-count>1</strong><button type="button" data-count-change="1">+</button></div></div>
        <span class="choice-label">TISCH AUSWÄHLEN</span>
        <div class="special-table-picker">${Array.from({ length: 50 }, (_, index) => `<button type="button" data-special-table="${index + 1}">${index + 1}</button>`).join("")}</div>
        <div class="modal-actions"><button class="modal-action" type="button" data-special-cancel>Abbrechen</button><button class="modal-action primary" type="button" data-special-save disabled>Ohne Tisch erfassen</button></div>
      </div>
    </section>`;
    // Keep the action bar outside the scrollable content, as in the other dialogs.
    layer.querySelector(".special-guest-modal").append(layer.querySelector(".special-guest-modal .modal-actions"));
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
        ? tr(role === "reception" ? "Rezeption" : "Service")
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

  function updateEmptyWorkspace(shell) {
    const role = document.body.dataset.appRole;
    if (role !== "service" && role !== "reception") return;
    const savedRooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
    const hasGuests = [...shell.querySelectorAll(".room-row")].some((row) => !row.querySelector(".vacant"));
    const empty = !savedRooms.length && !hasGuests;
    if (shell.classList.contains("workspace-empty") !== empty) shell.classList.toggle("workspace-empty", empty);
    if (!empty) { shell.querySelector(".workspace-empty-state")?.remove(); return; }

    const content = shell.querySelector(".content");
    if (!content) return;
    let state = content.querySelector(".workspace-empty-state");
    if (!state) {
      state = document.createElement("section");
      state.className = "workspace-empty-state";
      content.prepend(state);
    }
    const html = role === "service"
      ? `<h2>${tr("Noch keine Frühstücksliste")}</h2><p>${tr("Die Rezeption hat noch keine heutige Liste bereitgestellt.")}</p>`
      : `<h2>${activeLanguage === "DE" ? "Für heute ist noch keine Frühstücksliste geladen." : tr("Noch keine Liste geladen")}</h2><p>${activeLanguage === "DE" ? "Lade die aktuelle Mews-Liste, um zu beginnen." : tr("Lade den aktuellen Mews-Export, um den heutigen Arbeitstag zu beginnen.")}</p>`;
    if (state.innerHTML !== html) {
      state.innerHTML = html;
      state.querySelector("button")?.addEventListener("click", () => shell.querySelector('input[type="file"][accept*=".xlsx"]')?.click());
    }
  }

  function updateWorkspaceFeedback(shell) {
    const content = shell.querySelector(".content");
    if (!content) return;
    const query = normalize(shell.querySelector(".search-box input")?.value || "");
    const rows = [...content.querySelectorAll('.room-row')].filter(row=>row.getClientRects().length && getComputedStyle(row).display!=='none');
    const count = new Set(rows.map(row=>row.querySelector('.room-number')?.textContent.trim())).size;
    let summary=content.querySelector('.final-search-summary');
    if(!summary){summary=document.createElement('p');summary.className='final-search-summary';summary.setAttribute('role','status');content.prepend(summary);}
    const summaryText = activeLanguage === 'EN' ? `${count} ${count===1?'result':'results'}` : activeLanguage === 'VI' ? `${count} kết quả` : `${count} ${count===1?'Treffer':'Treffer'}`;
    if(summary.textContent!==summaryText)summary.textContent=summaryText;
    summary.hidden=!query;
    let empty=content.querySelector('.search-empty-state');
    if(!empty){empty=document.createElement('div');empty.className='search-empty-state';empty.innerHTML='<p></p><button type="button"></button>';content.append(empty);empty.querySelector('button').addEventListener('click',()=>{const input=shell.querySelector('.search-box input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();schedule();});}
    const text=tr('Keine Zimmer oder Gäste gefunden');
    if(empty.querySelector('p').textContent!==text)empty.querySelector('p').textContent=text;
    empty.querySelector('button').textContent=tr('Suche leeren');
    empty.hidden=!query || count>0;

    if (document.body.dataset.appRole !== "reception") { shell.querySelector(".reception-detail-empty")?.remove(); return; }
    let detail = shell.querySelector(".reception-detail-empty");
    if (!detail) {
      detail = document.createElement("aside");
      detail.className = "reception-detail-empty";
      shell.append(detail);
    }
    const copy = activeLanguage === "EN" ? ["Select a room", "Select a guest on the left to view their details."] : activeLanguage === "VI" ? ["Chọn phòng", "Chọn khách bên trái để xem thông tin."] : ["Zimmer auswählen", "Wähle links einen Gast, um die Details anzuzeigen."];
    const html = `<strong>${copy[0]}</strong><p>${copy[1]}</p>`;
    if (detail.innerHTML !== html) detail.innerHTML = html;
    const selected = Boolean(shell.querySelector(".guest-edit-modal"));
    if (detail.hidden !== selected) detail.hidden = selected;
    const top = `${Math.round(shell.querySelector(".hero").getBoundingClientRect().top)}px`;
    if (document.body.style.getPropertyValue("--reception-detail-top") !== top) document.body.style.setProperty("--reception-detail-top", top);
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
    shell.classList.toggle("search-active",searchActive);
    button.setAttribute("aria-pressed", String(openOnly));
    button.textContent = openOnly ? tr("Nur offene") : tr("Alle anzeigen");
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
    button.innerHTML = `<span>＋</span> ${tr("Gäste ohne Zimmer")}`;
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
      const mainCount=Number(modal.querySelector('.checkin-quantity-grid button.active')?.textContent.match(/\d+/)?.[0] || 1);
      const grouped=[...modal.querySelectorAll('.group-room-quantity button.active')].reduce((sum,button)=>sum+Number(button.textContent),0);
      const count=mainCount+grouped;
      const label=activeLanguage==='EN'?`Check in ${count} ${count===1?'guest':'guests'}`:activeLanguage==='VI'?`Ghi nhận ${count} khách`:`${count} ${count===1?'Gast':'Gäste'} erfassen`;
      const service=roomService?tr('Roomservice'):selectedTable?`${activeLanguage==='EN'?'Table':activeLanguage==='VI'?'Bàn':'Tisch'} ${selectedTable}`:'';
      const text=label+(service?' · '+service:'');
      primary.disabled=false;
      if(primary.textContent!==text)primary.textContent=text;

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

  function labelMobileReceptionRemarks(root) {
    if (document.body.dataset.appRole !== "reception") return;
    root.querySelectorAll(".reception-remark.has-remark").forEach((remark) => {
      const label = `${tr("Bemerkung")} · `;
      if (remark.dataset.mobileLabel !== label) remark.dataset.mobileLabel = label;
    });
  }

  let previousServiceDetailRoom = null;
  const serviceEditorReturns = new WeakSet();
  function settleServiceEditorContext(root) {
    if (document.body.dataset.appRole !== "service") return;
    const detail = root.querySelector(".guest-modal:not(.guest-edit-modal)");
    if (detail) previousServiceDetailRoom = normalize(detail.querySelector(".modal-kicker")?.textContent || "").match(/\d+/)?.[0] || null;
    const editor = root.querySelector(".guest-edit-modal");
    if (!editor) return;
    // A picker requested in read-only detail is rendered later by the native editor.
    // Close it through its existing React handler BEFORE the legacy field cleanup.
    // Never remove a picker child and leave an empty, intercepting backdrop behind.
    editor.querySelectorAll(".guest-info-picker-layer").forEach((layer) => layer.click());
    if (serviceEditorReturns.has(editor)) return;
    serviceEditorReturns.add(editor);
    const room = normalize(editor.querySelector(".modal-kicker")?.textContent || "").match(/\d+/)?.[0];
    const returnRoom = previousServiceDetailRoom;
    previousServiceDetailRoom = null;
    if (!room || room !== returnRoom) return;
    editor.querySelectorAll(":scope > .modal-head .close-button, :scope > .modal-actions .modal-action:not(.primary)").forEach((button) => {
      button.addEventListener("click", () => requestAnimationFrame(() => {
        if (root.querySelector(".guest-edit-modal")) return;
        // Restore only the previous presentation context using existing controls.
        const editToggle = root.querySelector('.bottom-bar .bottom-button[aria-pressed="true"]');
        editToggle?.click();
        requestAnimationFrame(() => {
          const row = [...root.querySelectorAll(".room-row")].find((candidate) => candidate.offsetWidth && normalize(candidate.querySelector(".room-number")?.textContent || "") === room);
          row?.click();
        });
      }));
    });
  }

  const initializedServiceEditors = new WeakSet();
  function settleServiceEditScroll(root) {
    if (document.body.dataset.appRole !== "service") return;
    const modal = root.querySelector(".guest-edit-modal");
    if (!modal || initializedServiceEditors.has(modal)) return;
    initializedServiceEditors.add(modal);
    const body = modal.querySelector(".modal-body");
    if (body) body.scrollTop = 0;
  }

  function quietSuccessRemark(root) {
    root.querySelectorAll(".checkin-card .important-note.info-note").forEach((note) => {
      const label = note.querySelector("strong");
      if (label && label.textContent !== tr("Bemerkung")) label.textContent = tr("Bemerkung");
    });
  }

  function structureServiceSuccess(root) {
    if (document.body.dataset.appRole !== "service") return;
    const card = root.querySelector(".checkin-card");
    if (!card || card.querySelector(".service-success-body")) return;
    const children = [...card.children];
    const bodyStart = children.findIndex((node) => node.matches(".checkin-facts"));
    const action = children.find((node) => node.matches("button.modal-action"));
    if (bodyStart < 0 || !action) return;
    const head = document.createElement("header");
    const body = document.createElement("div");
    const footer = document.createElement("footer");
    head.className = "service-success-head";
    body.className = "service-success-body";
    footer.className = "service-success-footer";
    children.forEach((node, index) => (node === action ? footer : index < bodyStart ? head : body).append(node));
    card.append(head, body, footer);
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", head.querySelector(".modal-kicker")?.textContent || "");
  }

  function lockServiceDialogBackground(root) {
    const active = document.body.dataset.appRole === "service" && root.querySelector(".modal-layer > :is(.checkin-choice-modal,.special-guest-modal,.checkin-card)");
    root.querySelectorAll(".app-shell > :is(.topbar,.hero,.search-wrap,.content,.bottom-bar)").forEach((node) => {
      if (active && !node.inert) {
        node.dataset.serviceDialogInert = "true";
        node.inert = true;
      } else if (!active && node.dataset.serviceDialogInert === "true") {
        node.inert = false;
        delete node.dataset.serviceDialogInert;
      }
    });
  }

  function serviceEntryTransition(shell) {
    const role = document.body.dataset.appRole;
    if (role !== "service" && role !== "reception") return;
    if (sessionStorage.getItem("ambassador-service-entry-transition") !== "pending") return;
    const rooms = readDailyState("ambassador-breakfast-rooms", "rooms", []);
    sessionStorage.removeItem("ambassador-service-entry-transition");
    if (!rooms.some((room) => Number(room.people || 0) > 0)) return;
    showSharedListReadyAnimation();
    const layer = document.querySelector(".success-overlay");
    if (!layer) return;
    layer.classList.add("work-area-entry-transition");
    if (role === "service") layer.classList.add("service-entry-transition");
    layer.dataset.workArea = role;
    layer.querySelector(".entry-eyebrow").textContent = tr(role === "service" ? "Service" : "Rezeption");
    layer.querySelector("h2").textContent = tr("Frühstücksliste");
  }

  function structureImportReview(root) {
    const modal = root.querySelector(".import-modal");
    const body = modal?.querySelector(":scope > .modal-body");
    const footer = body?.querySelector(":scope > .modal-actions");
    if (footer) modal.append(footer);
    if (document.body.dataset.appRole !== "reception") return;
    root.querySelectorAll(".app-shell > :is(.topbar,.hero,.search-wrap,.content,.bottom-bar)").forEach((node) => {
      if (modal && !node.inert) {
        node.dataset.importDialogInert = "true";
        node.inert = true;
      } else if (!modal && node.dataset.importDialogInert === "true") {
        node.inert = false;
        delete node.dataset.importDialogInert;
      }
    });
  }

  // F01/F03/F10: validation and navigation protection around the existing React editor.
  // Persisting still uses the application's one existing save handler; never autosave.
  const editorFields = (modal) => ({
    guests: modal?.querySelector('.guest-edit-grid > label.wide textarea'),
    people: modal?.querySelector('input[type="number"]'),
    arrival: modal?.querySelectorAll('input[type="date"]')[0],
    departure: modal?.querySelectorAll('input[type="date"]')[1],
    included: modal?.querySelector('input[type="checkbox"]'),
    note: modal?.querySelector('.final-note-field textarea')
  });
  function editorState() {
    if (sessionStorage.getItem(roleKey) !== 'reception') return null;
    const modal = document.querySelector('.guest-edit-modal');
    if (!modal) return null;
    const room = Number(modal.querySelector('.modal-kicker')?.textContent.match(/\d+/)?.[0]);
    const original = readDailyState('ambassador-breakfast-rooms', 'rooms', []).find(r => r.room === room);
    if (!original) return null;
    const f = editorFields(modal);
    const draft = {room, guests:(f.guests?.value || '').split('\n'), people:f.people?.value, arrival:f.arrival?.value || '', departure:f.departure?.value || '', included:!!f.included?.checked, note:f.note?.value || ''};
    const canonical = r => JSON.stringify({guests:(r.guests || []).map(x=>x.trim()).filter(Boolean),people:Number(r.people),arrival:r.arrival || '',departure:r.departure || '',included:!!r.included,note:r.note || ''});
    return {modal, f, original, draft, dirty:canonical(draft)!==canonical(original)};
  }
  function editorErrors(draft, original) {
    const errors = {};
    const names = (draft.guests || []).map(x => x.trim()).filter(Boolean);
    const people = Number(draft.people);
    if (!names.length) errors.guests = tr(original?.guests?.length ? 'Mindestens einen Gastnamen eingeben. Ein belegtes Zimmer kann hier nicht geleert werden.' : 'Mindestens einen Gastnamen eingeben.');
    if (!Number.isInteger(people) || people < 1 || people > 8) errors.people = tr('Bitte eine ganze Personenzahl von 1 bis 8 eingeben.');
    else if (people < Math.max(names.length, Number(original.arrivedCount || 0), Number(original.departedCount || 0))) errors.people = tr('Die Personenzahl darf nicht kleiner als die Anzahl der Namen oder bereits erfassten Gäste sein.');
    if (draft.arrival && draft.departure && draft.departure < draft.arrival) errors.departure = tr('Die Abreise darf nicht vor der Anreise liegen.');
    return errors;
  }
  function validateEditor(draft, original, focus = false) {
    const state = editorState();
    const errors = editorErrors(draft, original);
    if (state) {
      for (const name of ['guests','people','arrival','departure']) {
        const field = state.f[name];
        if (!field) continue;
        const id = `final-error-${name}`;
        let error = state.modal.querySelector('#'+id);
        if (errors[name] && !error) { error = document.createElement('small'); error.id=id; error.className='final-field-error'; field.after(error); }
        if (error) { if (error.textContent !== (errors[name] || '')) error.textContent=errors[name] || ''; error.hidden=!errors[name]; }
        if (errors[name]) { field.setAttribute('aria-invalid','true'); field.setAttribute('aria-describedby',id); }
        else { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); }
      }
      if (focus && Object.keys(errors).length) state.f[Object.keys(errors)[0]]?.focus();
    }
    return !Object.keys(errors).length;
  }
  function updateEditor() {
    const state=editorState(); if (!state) return;
    const {modal,dirty,draft,original}=state;
    const editing=!modal.classList.contains('reception-view-mode');
    const valid=validateEditor(draft,original);
    const save=modal.querySelector(':scope > .modal-actions .primary');
    if (save) save.disabled=!dirty || !valid;
    modal.dataset.dirty=String(dirty);
    let status=modal.querySelector('.final-dirty-status');
    if (!status) { status=document.createElement('small');status.className='final-dirty-status';status.setAttribute('role','status');modal.querySelector('.modal-head > div')?.append(status); }
    const text=dirty?tr('Ungespeicherte Änderungen'):tr('Gespeichert');
    if (status.textContent!==text) status.textContent=text;
    status.hidden=!editing;
  }
  function afterEditorSave() {
    const modal=document.querySelector('.guest-edit-modal');
    if (!modal) return;
    if (innerWidth < 700) modal.dataset.uiEdit='false';
    modal.querySelector('.reception-view-body')?.remove();
    modal.querySelector('.reception-view-actions')?.remove();
    requestAnimationFrame(schedule);
  }
  function validateRoomAdd(draft, original) {
    const modal=document.querySelector('.dialog-add-room');
    const errors=editorErrors(draft,{...original,arrivedCount:0,departedCount:0});
    const fields={guests:modal?.querySelector('textarea'),people:modal?.querySelector('input[type=number]')};
    for(const name of ['guests','people']) {
      const field=fields[name];if(!field)continue;
      let error=field.parentElement.querySelector('.final-field-error');
      if(!error){error=document.createElement('small');error.id='final-add-error-'+name;error.className='final-field-error';field.after(error);}
      error.textContent=errors[name]||'';error.hidden=!errors[name];
      if(errors[name]){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',error.id);}
      else {field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');}
    }
    if(Object.keys(errors).length)fields[Object.keys(errors)[0]]?.focus();
    return !Object.keys(errors).length;
  }
  window.ambassadorFinal = {validate:validateEditor, saved:afterEditorSave, validateRoomAdd};
  let allowEditorLeave=false;
  function continueEditorAction(action) {
    allowEditorLeave=true;
    try { action(); } finally { allowEditorLeave=false; }
  }
  function confirmEditorLeave(action) {
    if (document.querySelector('.final-dirty-layer')) return;
    const state=editorState(); if (!state?.dirty) { continueEditorAction(action); return; }
    const previous=document.activeElement;
    const layer=document.createElement('div'); layer.className='final-dirty-layer';
    layer.innerHTML=`<section class="final-dirty-dialog" role="alertdialog" aria-modal="true" aria-labelledby="final-dirty-title"><header><h2 id="final-dirty-title">${tr('Änderungen speichern?')}</h2></header><p>${tr('Es gibt ungespeicherte Änderungen an diesem Zimmer.')}</p><footer><button data-dirty="back">${tr('Zurück')}</button><button data-dirty="discard">${tr('Verwerfen')}</button><button data-dirty="save" class="primary">${tr('Speichern')}</button></footer></section>`;
    const background=[...document.body.children].filter(x=>!x.matches('script,style,link')).map(x=>[x,x.inert]);
    background.forEach(([x])=>x.inert=true); document.body.append(layer);
    const close=()=>{layer.remove();background.forEach(([x,inert])=>x.inert=inert);if(previous?.isConnected)previous.focus({preventScroll:true});};
    layer.addEventListener('click',event=>{
      const choice=event.target.closest('[data-dirty]')?.dataset.dirty; if(!choice)return;
      close();
      if(choice==='back')return;
      if(choice==='save') {
        const current=editorState();
        if(!current || !validateEditor(current.draft,current.original,true))return;
        current.modal.querySelector(':scope > .modal-actions .primary')?.click();
        // Native save is synchronous to local persistence; continue only when no draft remains.
        requestAnimationFrame(()=>{if(!editorState()?.dirty)continueEditorAction(action);});
      } else continueEditorAction(action);
    });
    layer.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      const buttons=[...layer.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    layer.querySelector('[data-dirty=back]').focus();
  }
  document.addEventListener('click',event=>{
    if(allowEditorLeave || !(event.target instanceof Element))return;
    const state=editorState(); if(!state?.dirty)return;
    const target=event.target.closest('.guest-edit-modal .close-button,.room-row,.home-button,.active-role-badge,.reception-upload,.reception-add,[data-menu-action]');
    const backdrop=event.target.matches('.modal-layer') && event.target.contains(state.modal);
    if(!target&&!backdrop)return;
    if(target?.matches('.room-row')&&Number(target.querySelector('.room-number')?.textContent)===state.draft.room)return;
    event.preventDefault();event.stopImmediatePropagation();
    const clicked=target||event.target;
    confirmEditorLeave(()=>clicked.isConnected&&clicked.click());
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||document.querySelector('.final-dirty-layer,.reliable-app-menu-layer'))return;
    const state=editorState();if(!state?.dirty)return;
    event.preventDefault();event.stopImmediatePropagation();
    confirmEditorLeave(()=>state.modal.querySelector('.close-button')?.click());
  },true);
  window.addEventListener('beforeunload',event=>{if(!allowEditorLeave&&editorState()?.dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('input',event=>{if(event.target.closest('.guest-edit-modal'))schedule();});
  document.addEventListener('change',event=>{if(event.target.closest('.guest-edit-modal'))schedule();});

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
    standardizeModalChrome(document);
    updateCheckinDialog(document);
    document.querySelectorAll(".room-state").forEach((state) => {
      const label = normalize(state.textContent || "").toLocaleLowerCase("de-CH");
      state.classList.toggle("redundant-open-status", ["noch offen", "still open", "chưa phục vụ"].includes(label));
    });
    if (shell) updateFilter(shell);
    if (shell) applyRoleView(shell);
    if (shell) alignFrozenRooms(shell);
    if (shell) updateEmptyWorkspace(shell);
    if (shell) alignMobileInfoBadges(shell);
    if (shell) ensureReliableMenu(shell, sessionStorage.getItem(roleKey) || "service");
    if (shell) updateServiceOpenHeading(shell);
    if (shell) addIPadSpecialGuestShortcut(shell);
    settleServiceEditorContext(document);
    enhanceReceptionModal(document);
    labelMobileReceptionRemarks(document);
    receptionReadView(document);
    checkinBreakfastDisplay(document);
    settleServiceEditScroll(document);
    quietSuccessRemark(document);
    structureServiceSuccess(document);
    structureImportReview(document);
    lockServiceDialogBackground(document);
    if (shell) serviceEntryTransition(shell);
    enhanceRoomUndo(document);
    if (shell) updateWorkspaceFeedback(shell);
    updateEditor();
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
    if (event.target instanceof Element && event.target.closest('.role-selection [data-role="service"]')) {
      sessionStorage.setItem("ambassador-service-entry-transition", "pending");
    }
    const entryOpen = event.target instanceof Element ? event.target.closest(".entry-screen[data-role='service'] .entry-secondary") : null;
    if (entryOpen && !entryOpen.dataset.sharedAnimationTriggered) {
      entryOpen.dataset.sharedAnimationTriggered = "true";
      window.setTimeout(showSharedListReadyAnimation, 80);
    }
    if(event.target instanceof Element && event.target.closest('.checkin-choice-modal')) [0,40,120].forEach(delay=>setTimeout(()=>updateCheckinDialog(document),delay));
  });

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
