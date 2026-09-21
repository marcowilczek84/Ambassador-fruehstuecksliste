(() => {
  let openOnly = false;
  let scheduled = false;
  const roleKey = "ambassador-work-area";
  const previewVersion = "8.39.0";

  const normalize = (value) => value.replace(/\s+/g, " ").trim();

  function icon(name) {
    if (name === "reception") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16M6 17a6 6 0 0 1 12 0M12 8v3M10 7h4"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Zm12 2h1a3 3 0 0 1 0 6h-1M8 4v2m4-2v2m4-2v2"/></svg>';
  }

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
      <span class="role-app-mark">${icon("service")}</span>
      <span class="role-eyebrow">Frühstücksliste</span>
      <h1>Guten Morgen</h1>
      <p class="role-date">${currentDate}</p>
      <p class="role-prompt">Bereich auswählen</p>
      <div class="role-options">
        <button type="button" data-role="reception">
          <span class="role-icon">${icon("reception")}</span>
          <strong>Rezeption</strong>
          <small>Liste laden und Gäste bearbeiten</small>
        </button>
        <button type="button" data-role="service">
          <span class="role-icon">${icon("service")}</span>
          <strong>Frühstücksservice</strong>
          <small>Gäste erfassen und Tische verwalten</small>
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
    badge.textContent = role === "reception" ? "Rezeption" : "Service";
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
      const action = [...document.querySelectorAll(".menu-card button")].find((button) => normalize(button.textContent || "").includes(label));
      if (action) {
        action.click();
        window.setTimeout(() => document.body.classList.remove("proxy-menu-action"), 120);
        return;
      }
      attempts += 1;
      if (attempts < 40) window.setTimeout(triggerAction, 25);
      else document.body.classList.remove("proxy-menu-action");
    };
    window.setTimeout(triggerAction, 0);
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
        <span><strong>Heutige Liste</strong><small>${rooms} Zimmer · ${guests} Gäste</small></span>
      </div>
      <div class="reception-actions">
        <button type="button" class="reception-upload">Neue Mews-Liste laden</button>
        <button type="button" class="reception-add">＋ Zimmer hinzufügen</button>
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
    head.innerHTML = "<span>Zimmer</span><span>Gast</span><span>Gäste</span><span>Frühstück</span><span>Bemerkung</span><span></span>";
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
      breakfast.classList.toggle("included", included);
      breakfast.textContent = included ? "inklusive" : "nicht inklusive";

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
        if (heading) heading.textContent = "Belegte Zimmer";
        if (count) count.textContent = String(occupiedRooms.size);
      }
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
      choice.innerHTML = '<span>Frühstück</span><div><button type="button" data-included="true">inklusive</button><button type="button" data-included="false">nicht inklusive</button></div>';
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
    if (includedButton) includedButton.textContent = checkbox.checked ? "✓ inklusive" : "inklusive";
    if (excludedButton) excludedButton.textContent = checkbox.checked ? "nicht inklusive" : "✓ nicht inklusive";
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
        ? "Frühstücksliste"
        : role === "reception" ? "Frühstücksliste · Rezeption" : "Frühstücksliste · Service";
    }
    const search = shell.querySelector('.search-box input');
    if (search) search.placeholder = role === "reception" ? "Zimmer oder Name suchen" : "Zimmer, Name oder Tisch suchen";
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

  function ensureSingleGuestDisplay(modal) {
    const people = getCheckinRoomPeople(modal);
    const existing = modal.querySelector(".single-guest-count");
    if (people !== 1) {
      existing?.remove();
      return;
    }
    if (existing || modal.querySelector(".checkin-count-block")) return;

    const block = document.createElement("div");
    block.className = "checkin-count-block single-guest-count";
    block.setAttribute("aria-label", "Personen");
    block.innerHTML = '<span class="choice-label">Personen</span><div class="single-guest-value">1 Gast</div>';
    const anchor = modal.querySelector(".room-service-option");
    if (anchor) anchor.before(block);
    else modal.querySelector(".modal-body")?.prepend(block);
  }

  function updateEntryForRole(entry) {
    const role = sessionStorage.getItem(roleKey);
    if (!role || entry.classList.contains("role-pending")) return;
    entry.dataset.role = role;

    const importButton = entry.querySelector(".load-choice");
    const openButton = entry.querySelector(".entry-secondary");
    const importTitle = importButton?.querySelector("strong");
    if (importTitle) importTitle.textContent = openButton ? "Neue Mews-Liste laden" : "Mews-Liste laden";

    let note = entry.querySelector(".service-waiting-note");
    if (role === "service" && !entry.querySelector(".entry-secondary")) {
      if (!note) {
        note = document.createElement("p");
        note.className = "service-waiting-note";
        note.textContent = "Die Rezeption hat noch keine heutige Liste bereitgestellt.";
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
    button.textContent = openOnly ? "Offene anzeigen ×" : "Alle anzeigen ›";
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
    heading.textContent = `${number} Zimmer offen`;
    count.style.display = "none";
  }

  function updateCheckinDialog(root) {
    root.querySelectorAll(".checkin-choice-modal").forEach((modal) => {
      ensureSingleGuestDisplay(modal);
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
        primary.textContent = "Ohne Tisch erfassen";
      } else if (selectedTable) {
        primary.textContent = `An Tisch ${selectedTable} erfassen`;
      } else if (roomService) {
        primary.textContent = "Roomservice erfassen";
      }
    });

    root.querySelectorAll(".checkin-fact").forEach((fact) => {
      const label = fact.querySelector("small");
      const value = fact.querySelector("strong");
      if (label && value && normalize(label.textContent || "") === "Tisch / Service" && !normalize(value.textContent || "")) {
        value.textContent = "Kein Tisch";
      }
    });
  }

  function classifyDialogs(root) {
    root.querySelectorAll(".modal").forEach((modal) => {
      const title = normalize(modal.querySelector(".modal-head h2")?.textContent || "").toLowerCase();
      modal.classList.toggle("dialog-add-room", title === "zimmer hinzufügen" || title === "add room" || title === "thêm phòng");
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
    if (shell) updateFilter(shell);
    if (shell) applyRoleView(shell);
    if (shell) updateServiceOpenHeading(shell);
    enhanceReceptionModal(document);
    if (shell) {
      const finished = Boolean(shell.querySelector(".bottom-button.finish.finished"));
      shell.classList.toggle("breakfast-finished", finished);
      shell.querySelectorAll(".room-row").forEach((row) => {
        row.setAttribute("aria-disabled", String(finished));
      });
      const editButton = shell.querySelector(".bottom-bar .bottom-button:not(.finish)");
      if (editButton) editButton.disabled = finished;
    }
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
        primary.textContent = `An Tisch ${table} erfassen`;
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
        primary.textContent = "Roomservice erfassen";
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
