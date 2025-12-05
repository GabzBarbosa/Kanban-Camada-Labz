(() => {
  const STORAGE_KEY = "kanbanTasks_v2";
  // DOM refs
  const modal = document.getElementById("taskModal");
  const openBtn = document.getElementById("openModalBtn");
  const closeBtn = modal ? modal.querySelector(".close-btn") : null;
  const addTaskBtn = document.getElementById("addTaskBtn");
  const titleInput = document.getElementById("taskTitle");
  const prioritySelect = document.getElementById("taskPriority");
  const statusSelect = document.getElementById("taskStatus");
  const dueDateInput = document.getElementById("taskDueDate");
  const doneCheckbox = document.getElementById("taskDone");

  const filterPriority = document.getElementById("filterPriority");
  const sortBy = document.getElementById("sortBy");
  const searchInput = document.getElementById("searchInput");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  const board = document.querySelector(".kanban-board");
  let editingCardId = null;

  // helpers
  const uid = () =>
    "card-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  function isExpired(dueDateStr) {
    if (!dueDateStr) return false;
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    return due < todayStart();
  }
  function getColumnByStatus(status) {
    return document.querySelector(`.kanban-cards[data-status="${status}"]`);
  }
  function formatDueLabel(d) {
    if (!d) return "";
    const dt = new Date(d);
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    return `Vence: ${day}/${month}/${year}`;
  }

  // storage functions
  function saveTasksToLocalStorage() {
    const tasks = [];
    document.querySelectorAll(".kanban-card").forEach((card) => {
      tasks.push({
        id: card.dataset.id,
        title: card.querySelector(".card-title").textContent,
        priority: card.dataset.priority,
        status: card.closest(".kanban-cards").dataset.status,
        dueDate: card.dataset.duedate || null,
        concluida: card.classList.contains("concluida")
      });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadTasksFromLocalStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const tasks = JSON.parse(raw);
      tasks.forEach((task) => {
        const col =
          getColumnByStatus(task.status) || getColumnByStatus("pendente");
        const card = createCardElement(task);
        col.appendChild(card);
      });
    } catch (err) {
      console.error("Erro ao carregar tarefas:", err);
    }
  }

  // create card DOM
  function createCardElement({
    id = uid(),
    title,
    priority = "baixa",
    status = "pendente",
    dueDate = null,
    concluida = false
  }) {
    const card = document.createElement("div");
    card.className = "kanban-card";
    card.dataset.id = id;
    card.dataset.priority = priority;
    if (dueDate) card.dataset.duedate = dueDate;
    if (isExpired(dueDate)) card.dataset.expired = "true";
    if (concluida) card.classList.add("concluida");

    // title
    const titleEl = document.createElement("span");
    titleEl.className = "card-title";
    titleEl.textContent = title || "Sem título";

    // meta
    const metaEl = document.createElement("div");
    metaEl.className = "card-meta";
    if (dueDate) {
      const dueSpan = document.createElement("span");
      dueSpan.className = "card-due";
      dueSpan.textContent = formatDueLabel(dueDate);
      metaEl.appendChild(dueSpan);
    }

    // actions
    const actions = document.createElement("div");
    actions.className = "card-actions";

    const toggleDoneBtn = document.createElement("button");
    toggleDoneBtn.className = "btn-toggle-done";
    toggleDoneBtn.title = "Marcar/Desmarcar concluída";
    toggleDoneBtn.textContent = "✔️";
    toggleDoneBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      card.classList.toggle("concluida");
      saveTasksToLocalStorage();
    });

    const editBtn = document.createElement("button");
    editBtn.className = "btn-edit";
    editBtn.title = "Editar";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalForEdit(card);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.title = "Excluir";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Deseja excluir esta tarefa?")) {
        card.remove();
        saveTasksToLocalStorage();
      }
    });

    actions.appendChild(toggleDoneBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(titleEl);
    card.appendChild(metaEl);
    card.appendChild(actions);

    attachDragListeners(card);
    card.addEventListener("dblclick", () => openModalForEdit(card));
    return card;
  }

  // drag & drop
  function attachDragListeners(card) {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      try {
        e.dataTransfer.setData("text/plain", card.dataset.id);
      } catch (err) {}
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      updateCardExpiration(card);
      normalizeStatusesAndPersist();
    });
  }

  function initColumnsDrop() {
    const cols = document.querySelectorAll(".kanban-cards");
    cols.forEach((col) => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        col.classList.add("cards-hover");
        const dragging = document.querySelector(".dragging");
        const afterElement = getDragAfterElement(col, e.clientY);
        if (!afterElement) col.appendChild(dragging);
        else col.insertBefore(dragging, afterElement);
      });

      col.addEventListener("dragleave", () => {
        col.classList.remove("cards-hover");
      });

      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("cards-hover");
        const dragging = document.querySelector(".dragging");
        if (!dragging) return;
        dragging.classList.remove("dragging");
        // status is derived from column parent when saving
        normalizeStatusesAndPersist();
      });
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(".kanban-card:not(.dragging)")
    ];
    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  function updateCardExpiration(card) {
    const dd = card.dataset.duedate || null;
    if (isExpired(dd)) card.dataset.expired = "true";
    else delete card.dataset.expired;
  }

  function normalizeStatusesAndPersist() {
    document.querySelectorAll(".kanban-cards").forEach((col) => {
      col.querySelectorAll(".kanban-card").forEach((card) => {
        updateCardExpiration(card);
      });
    });
    saveTasksToLocalStorage();
    applyFiltersAndSort(); // keep UI consistent after move
  }

  // modal behavior
  function openModalForNew() {
    editingCardId = null;
    titleInput.value = "";
    prioritySelect.value = "baixa";
    statusSelect.value = "pendente";
    dueDateInput.value = "";
    doneCheckbox.checked = false;
    showModal();
  }

  function openModalForEdit(cardEl) {
    editingCardId = cardEl.dataset.id;
    titleInput.value = cardEl.querySelector(".card-title").textContent;
    prioritySelect.value = cardEl.dataset.priority || "baixa";
    statusSelect.value =
      cardEl.closest(".kanban-cards").dataset.status || "pendente";
    dueDateInput.value = cardEl.dataset.duedate || "";
    doneCheckbox.checked = cardEl.classList.contains("concluida");
    showModal();
  }

  function showModal() {
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    titleInput.focus();
  }

  function closeModal() {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    editingCardId = null;
  }

  function handleModalSubmit() {
    const title = titleInput.value.trim();
    const priority = prioritySelect.value;
    const status = statusSelect.value;
    const dueDate = dueDateInput.value || null;
    const done = !!doneCheckbox.checked;

    if (!title) {
      alert("Digite um título para a tarefa.");
      return;
    }

    if (editingCardId) {
      const card = document.querySelector(
        `.kanban-card[data-id="${editingCardId}"]`
      );
      if (card) {
        card.querySelector(".card-title").textContent = title;
        card.dataset.priority = priority;
        if (dueDate) card.dataset.duedate = dueDate;
        else delete card.dataset.duedate;
        if (done) card.classList.add("concluida");
        else card.classList.remove("concluida");

        const targetCol = getColumnByStatus(status);
        if (targetCol && card.closest(".kanban-cards") !== targetCol)
          targetCol.appendChild(card);
        updateCardExpiration(card);
      } else {
        // safety: create new if missing
        createAndAppendTask({
          title,
          priority,
          status,
          dueDate,
          concluida: done
        });
      }
    } else {
      createAndAppendTask({
        id: uid(),
        title,
        priority,
        status,
        dueDate,
        concluida: done
      });
    }

    closeModal();
    normalizeStatusesAndPersist();
  }

  function createAndAppendTask(taskObj) {
    const card = createCardElement(taskObj);
    const col =
      getColumnByStatus(taskObj.status) || getColumnByStatus("pendente");
    col.appendChild(card);
    saveTasksToLocalStorage();
  }

  // filters & sorting
  function applyFiltersAndSort() {
    const pFilter = filterPriority.value;
    const q = searchInput.value.trim().toLowerCase();
    const sort = sortBy.value;

    // For each column, gather cards then optionally sort then re-append filtered ones
    document.querySelectorAll(".kanban-cards").forEach((col) => {
      let cards = Array.from(col.querySelectorAll(".kanban-card"));
      // filter
      cards.forEach((card) => {
        const matchesPriority =
          pFilter === "all" || card.dataset.priority === pFilter;
        const matchesQuery =
          !q ||
          card
            .querySelector(".card-title")
            .textContent.toLowerCase()
            .includes(q);
        card.style.display = matchesPriority && matchesQuery ? "" : "none";
      });

      // sort if needed - only reorder visible cards
      if (sort !== "none") {
        const visibleCards = cards.filter((c) => c.style.display !== "none");
        const hiddenCards = cards.filter((c) => c.style.display === "none");
        if (sort === "priority") {
          const order = { alta: 0, media: 1, baixa: 2 };
          visibleCards.sort(
            (a, b) => order[a.dataset.priority] - order[b.dataset.priority]
          );
        } else if (sort === "dueDateAsc" || sort === "dueDateDesc") {
          visibleCards.sort((a, b) => {
            const da = a.dataset.duedate || "";
            const db = b.dataset.duedate || "";
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return sort === "dueDateAsc"
              ? new Date(da) - new Date(db)
              : new Date(db) - new Date(da);
          });
        }
        // re-append visible cards (hidden stay where they are but hidden)
        visibleCards.forEach((vc) => col.appendChild(vc));
        // hidden cards remain (but keep hidden)
        hiddenCards.forEach((hc) => col.appendChild(hc));
      }
    });
  }

  // Export CSV
  function exportToCSV() {
    const rows = [
      ["id", "title", "priority", "status", "dueDate", "concluida"]
    ];
    document.querySelectorAll(".kanban-card").forEach((card) => {
      const id = card.dataset.id;
      const title = card.querySelector(".card-title").textContent;
      const priority = card.dataset.priority || "";
      const status = card.closest(".kanban-cards").dataset.status || "";
      const dueDate = card.dataset.duedate || "";
      const concluida = card.classList.contains("concluida") ? "true" : "false";
      rows.push([id, title, priority, status, dueDate, concluida]);
    });
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            if (cell == null) return "";
            const s = String(cell).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Import CSV (supports quoted fields)
  function parseCSV(text) {
    const lines = [];
    const regex = /(?:\s*"?([^"\r\n]*)"?\s*,?)/g;
    // safer parser: handle quoted fields & commas inside quotes
    // We'll use a robust approach: iterate chars
    let i = 0,
      cur = "",
      row = [],
      inQuotes = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } // escaped quote
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && text[i + 1] === "\n") {
          i++;
        } // windows newline
        row.push(cur);
        lines.push(row);
        row = [];
        cur = "";
      } else {
        cur += ch;
      }
      i++;
    }
    if (cur !== "" || row.length) {
      row.push(cur);
      lines.push(row);
    }
    // trim spaces around values
    return lines.map((r) => r.map((c) => c.trim().replace(/^"|"$/g, "")));
  }

  function importFromCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (!parsed || parsed.length < 2) {
        alert("CSV vazio ou inválido.");
        return;
      }
      const headers = parsed[0].map((h) => h.toLowerCase());
      const required = ["title"]; // minimal
      // map rows
      for (let r = 1; r < parsed.length; r++) {
        const row = parsed[r];
        if (row.length === 1 && row[0].trim() === "") continue;
        const obj = {};
        headers.forEach((h, idx) => (obj[h] = row[idx] || ""));
        // build task
        const task = {
          id: obj.id || uid(),
          title: obj.title || "Sem título",
          priority: obj.priority || "baixa",
          status: obj.status || "pendente",
          dueDate: obj.duedate || obj["dueDate"] || obj["due_date"] || "",
          concluida:
            String(obj.concluida || obj.done || "").toLowerCase() === "true"
        };
        const col =
          getColumnByStatus(task.status) || getColumnByStatus("pendente");
        const card = createCardElement(task);
        col.appendChild(card);
      }
      normalizeStatusesAndPersist();
      alert("Importação finalizada.");
    };
    reader.readAsText(file, "UTF-8");
  }

  // UI initialization
  function initUI() {
    openBtn && openBtn.addEventListener("click", openModalForNew);
    closeBtn && closeBtn.addEventListener("click", closeModal);
    addTaskBtn && addTaskBtn.addEventListener("click", handleModalSubmit);

    // modal close click outside
    window.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // keyboard: Esc or Enter
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "Enter" && modal.style.display === "block") {
        const active = document.activeElement;
        if (
          modal.contains(active) &&
          (active.tagName === "INPUT" ||
            active.tagName === "SELECT" ||
            active.tagName === "TEXTAREA")
        ) {
          e.preventDefault();
          handleModalSubmit();
        }
      }
    });

    // filter & sort events
    filterPriority &&
      filterPriority.addEventListener("change", applyFiltersAndSort);
    sortBy && sortBy.addEventListener("change", applyFiltersAndSort);
    searchInput &&
      searchInput.addEventListener("input", debounce(applyFiltersAndSort, 180));

    // export/import
    exportBtn && exportBtn.addEventListener("click", exportToCSV);
    importBtn && importBtn.addEventListener("click", () => importFile.click());
    importFile &&
      importFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) importFromCSVFile(file);
        importFile.value = "";
      });

    initColumnsDrop();
  }

  // small debounce
  function debounce(fn, wait = 150) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // observe board changes to persist automatically
  function startMutationObserver() {
    const mo = new MutationObserver(() => {
      // small debounce: wait 60ms to persist
      debounce(() => normalizeStatusesAndPersist(), 60)();
    });
    mo.observe(board, { childList: true, subtree: true });
  }

  // initial load
  window.addEventListener("DOMContentLoaded", () => {
    // validate essentials
    if (!titleInput || !prioritySelect || !statusSelect || !modal) {
      console.error("Elementos essenciais do modal não encontrados.");
      return;
    }
    initUI();
    loadTasksFromLocalStorage();
    // update expirations for loaded
    document
      .querySelectorAll(".kanban-card")
      .forEach((card) => updateCardExpiration(card));
    applyFiltersAndSort();
    startMutationObserver();
  });
})();
