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
  const board = document.querySelector(".kanban-board");
  let editingCardId = null; // id da card sendo editada

  // --- Helpers ---
  const uid = () => "card-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

  const todayStart = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  };

  const isExpired = (dueDateStr) => {
    if (!dueDateStr) return false;
    const due = new Date(dueDateStr);
    due.setHours(0,0,0,0);
    return due < todayStart();
  };

  const getColumnByStatus = (status) => document.querySelector(`.kanban-cards[data-status="${status}"]`);

  // Ensure modal has dueDate input and concluida checkbox (adds if missing)
  function ensureModalExtras() {
    if (!modal) return;
    // due date
    if (!modal.querySelector("#taskDueDate")) {
      const label = document.createElement("label");
      label.setAttribute("for", "taskDueDate");
      label.textContent = "Data de Vencimento";

      const input = document.createElement("input");
      input.type = "date";
      input.id = "taskDueDate";

      // insert before add button
      modal.querySelector(".modal-content").insertBefore(label, addTaskBtn);
      modal.querySelector(".modal-content").insertBefore(input, addTaskBtn);
    }

    // concluida checkbox
    if (!modal.querySelector("#taskDone")) {
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";
      wrapper.style.gap = "8px";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "taskDone";

      const label = document.createElement("label");
      label.setAttribute("for", "taskDone");
      label.textContent = "Concluída";

      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);

      modal.querySelector(".modal-content").insertBefore(wrapper, addTaskBtn);
    }
  }

  // Read modal inputs
  function readModalValues() {
    const dueInput = modal.querySelector("#taskDueDate");
    const doneInput = modal.querySelector("#taskDone");
    return {
      title: titleInput.value.trim(),
      priority: prioritySelect ? prioritySelect.value : "baixa",
      status: statusSelect ? statusSelect.value : "pendente",
      dueDate: dueInput ? dueInput.value || null : null,
      done: doneInput ? !!doneInput.checked : false
    };
  }

  function fillModalWithTask(task) {
    titleInput.value = task.title || "";
    if (prioritySelect) prioritySelect.value = task.priority || "baixa";
    if (statusSelect) statusSelect.value = task.status || "pendente";
    const due = modal.querySelector("#taskDueDate");
    if (due) due.value = task.dueDate || "";
    const done = modal.querySelector("#taskDone");
    if (done) done.checked = !!task.concluida;
  }

  // Modal open/close
  function openModalForNew() {
    editingCardId = null;
    fillModalWithTask({ title: "", priority: "baixa", status: "pendente", dueDate: "", concluida: false });
    showModal();
  }

  function openModalForEdit(cardEl) {
    editingCardId = cardEl.dataset.id;
    const task = {
      title: cardEl.querySelector(".card-title").textContent,
      priority: cardEl.dataset.priority,
      status: cardEl.closest(".kanban-cards").dataset.status,
      dueDate: cardEl.dataset.duedate || "",
      concluida: cardEl.classList.contains("concluida")
    };
    fillModalWithTask(task);
    showModal();
  }

  function showModal() {
    if (!modal) return;
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    titleInput.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  // --- Storage ---
  function saveTasksToLocalStorage() {
    const tasks = [];
    document.querySelectorAll(".kanban-card").forEach(card => {
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
      tasks.forEach(task => {
        const col = getColumnByStatus(task.status) || document.querySelector('.kanban-cards[data-status="pendente"]');
        const card = createCardElement(task);
        col.appendChild(card);
      });
    } catch (err) {
      console.error("Erro ao parsear tarefas salvas:", err);
    }
  }

  // --- Card creation and listeners ---
  function createCardElement({ id = uid(), title, priority = "baixa", status = "pendente", dueDate = null, concluida = false }) {
    const card = document.createElement("div");
    card.className = "kanban-card";
    card.dataset.id = id;
    card.dataset.priority = priority;
    if (dueDate) card.dataset.duedate = dueDate;
    if (isExpired(dueDate)) card.dataset.expired = "true";

    if (concluida) card.classList.add("concluida");

    // content
    const titleEl = document.createElement("span");
    titleEl.className = "card-title";
    titleEl.textContent = title;

    const metaEl = document.createElement("div");
    metaEl.className = "card-meta";
    metaEl.style.fontSize = "12px";
    metaEl.style.marginTop = "8px";

    // due date display
    if (dueDate) {
      const dueSpan = document.createElement("span");
      dueSpan.className = "card-due";
      dueSpan.textContent = formatDueLabel(dueDate);
      metaEl.appendChild(dueSpan);
    }

    // actions
    const actions = document.createElement("div");
    actions.className = "card-actions";

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
      const ok = confirm("Tem certeza que deseja excluir esta tarefa?");
      if (ok) {
        card.remove();
        saveTasksToLocalStorage();
      }
    });

    const toggleDoneBtn = document.createElement("button");
    toggleDoneBtn.className = "btn-toggle-done";
    toggleDoneBtn.title = "Marcar/Desmarcar concluída";
    toggleDoneBtn.textContent = "✔️";
    toggleDoneBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      card.classList.toggle("concluida");
      saveTasksToLocalStorage();
    });

    actions.appendChild(toggleDoneBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(titleEl);
    card.appendChild(metaEl);
    card.appendChild(actions);

    // attach drag listeners
    attachDragListeners(card);

    // double click to edit
    card.addEventListener("dblclick", () => openModalForEdit(card));

    return card;
  }

  function formatDueLabel(d) {
    // d expected YYYY-MM-DD
    if (!d) return "";
    const dt = new Date(d);
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    return `Vence: ${day}/${month}/${year}`;
  }

  function attachDragListeners(card) {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      // set dataTransfer for cross-window compatibility (not strictly necessary here)
      try { e.dataTransfer.setData("text/plain", card.dataset.id); } catch (err) {}
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      // after drag ends, recompute expiration and persist
      updateCardExpiration(card);
      saveTasksToLocalStorage();
    });
  }

  // update expired attr for a card (based on dataset.duedate)
  function updateCardExpiration(card) {
    const dd = card.dataset.duedate || null;
    if (isExpired(dd)) {
      card.dataset.expired = "true";
    } else {
      delete card.dataset.expired;
    }
  }

  // --- Column drag/drop (one-time setup) ---
  function initColumnsDrop() {
    const cols = document.querySelectorAll(".kanban-cards");
    cols.forEach(col => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        col.classList.add("cards-hover");
        // show insertion point
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
        // append handled in dragover insertion code, but ensure status is updated
        dragging.classList.remove("dragging");
        // update status in DOM (not only on dataset) - status is stored in column element
        // persist the new status by moving to this column
        saveTasksToLocalStorage();
      });
    });
  }

  // Helper: find element after which the dragged card should be inserted
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".kanban-card:not(.dragging)")];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // After drop, ensure every card's status matches the column it's in
  function normalizeStatusesAndPersist() {
    document.querySelectorAll(".kanban-cards").forEach(col => {
      const status = col.dataset.status;
      col.querySelectorAll(".kanban-card").forEach(card => {
        // when saving, we read the column of the card, so nothing extra needed
        // but update expiration metadata anyway
        updateCardExpiration(card);
      });
    });
    saveTasksToLocalStorage();
  }

  // --- Actions on Add/Edit submit ---
  function handleModalSubmit() {
    const vals = readModalValues();
    if (!vals.title) {
      alert("Digite um título para a tarefa.");
      return;
    }

    if (editingCardId) {
      // find card and update
      const card = document.querySelector(`.kanban-card[data-id="${editingCardId}"]`);
      if (!card) {
        console.warn("Card para editar não encontrado. Criando novo.");
        createAndAppendTask(vals);
      } else {
        card.querySelector(".card-title").textContent = vals.title;
        card.dataset.priority = vals.priority;
        if (vals.dueDate) card.dataset.duedate = vals.dueDate;
        else delete card.dataset.duedate;

        if (vals.done) card.classList.add("concluida"); else card.classList.remove("concluida");
        // move to target column if status changed
        const targetCol = getColumnByStatus(vals.status);
        if (targetCol && card.closest(".kanban-cards") !== targetCol) {
          targetCol.appendChild(card);
        }
        updateCardExpiration(card);
      }
    } else {
      // create new task
      createAndAppendTask(vals);
    }

    closeModal();
    normalizeStatusesAndPersist();
  }

  function createAndAppendTask(vals) {
    const taskObj = {
      id: uid(),
      title: vals.title,
      priority: vals.priority,
      status: vals.status,
      dueDate: vals.dueDate,
      concluida: vals.done
    };
    const card = createCardElement(taskObj);
    const col = getColumnByStatus(taskObj.status) || document.querySelector('.kanban-cards[data-status="pendente"]');
    col.appendChild(card);
    saveTasksToLocalStorage();
  }

  // --- Keyboard accessibility for modal ---
  function initModalKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (!modal) return;
      if (e.key === "Escape") {
        if (modal.style.display === "block") closeModal();
      }
      if (e.key === "Enter") {
        // if modal open and focused element is not a button (to avoid accidental submits),
        // submit form when Enter pressed inside the modal inputs
        if (modal.style.display === "block") {
          const active = document.activeElement;
          const insideModal = modal.contains(active);
          if (insideModal && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA")) {
            e.preventDefault();
            handleModalSubmit();
          }
        }
      }
    });
  }

  // --- Init UI events (one-time) ---
  function initUI() {
    if (!modal) return;
    ensureModalExtras();

    openBtn && openBtn.addEventListener("click", () => {
      openModalForNew();
    });

    closeBtn && closeBtn.addEventListener("click", closeModal);

    // clicking outside modal content closes
    window.addEventListener("click", (e) => {
      if (!modal) return;
      if (e.target === modal) closeModal();
    });

    addTaskBtn && addTaskBtn.addEventListener("click", handleModalSubmit);

    // ensure columns accept drops and manage insertion
    initColumnsDrop();

    // accessibility shortcuts
    initModalKeyboard();

    // when modal opened for edit, make sure editingCardId is set by callers
  }

  // --- On load ---
  window.addEventListener("DOMContentLoaded", () => {
    // Ensure referenced inputs exist
    if (!titleInput || !prioritySelect || !statusSelect || !modal) {
      console.error("Elementos essenciais do modal não encontrados. Verifique se HTML contém #taskModal, #taskTitle, #taskPriority e #taskStatus.");
      return;
    }

    initUI();
    loadTasksFromLocalStorage();

    // After loading, attach expirations and ensure drag listeners (cards were created via createCardElement so they already have listeners)
    document.querySelectorAll(".kanban-card").forEach(card => updateCardExpiration(card));

    // As safety, observe mutations on the board to persist changes whenever nodes move or are added
    const mo = new MutationObserver((mutations) => {
      // debounce quick changes
      normalizeStatusesAndPersist();
    });
    mo.observe(board, { childList: true, subtree: true });

    // final normalization (in case load placed some in wrong columns)
    normalizeStatusesAndPersist();
  });

})();


