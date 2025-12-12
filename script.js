/* script.js - Kanban reescrito e padronizado
   Comentários em português.
   Funcionalidades:
   - Criar / editar tarefas via modal
   - Tags (várias) por tarefa
   - Drag & drop robusto com inserção por posição
   - Persistência no localStorage (id, title, priority, status, dueDate, concluida, tags)
   - Filtros (prioridade), busca, ordenação
   - Exportar / importar CSV (tags em coluna separada por ;)
*/

(() => {
  // -----------------------
  // Constantes e referências DOM
  // -----------------------
  const STORAGE_KEY = "kanbanTasks_v2";

  const modal = document.getElementById("taskModal");
  const openBtn = document.getElementById("openModalBtn");
  const closeBtn = modal ? modal.querySelector(".close-btn") : null;
  const addTaskBtn = document.getElementById("addTaskBtn");
  const titleInput = document.getElementById("taskTitle");
  const tagsInput = document.getElementById("taskTags"); // campo de tags (vírgula separado)
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

  // -----------------------
  // Helpers
  // -----------------------
  const uid = () => "card-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

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

  // -----------------------
  // Persistência (LocalStorage)
  // -----------------------
  function saveTasksToLocalStorage() {
    const tasks = [];
    document.querySelectorAll(".kanban-card").forEach((card) => {
      // coletar tags do card
      const tags = Array.from(card.querySelectorAll(".tag")).map((t) =>
        t.textContent.trim()
      );

      // garantir que o status esteja sincronizado com a coluna atual
      const status = card.closest(".kanban-cards")?.dataset.status || "pendente";
      card.dataset.status = status;

      tasks.push({
        id: card.dataset.id,
        title: card.querySelector(".card-title").textContent,
        priority: card.dataset.priority,
        status: status,
        dueDate: card.dataset.duedate || null,
        concluida: card.classList.contains("concluida"),
        tags: tags,
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
        const col = getColumnByStatus(task.status) || getColumnByStatus("pendente");
        const card = createCardElement(task);
        col.appendChild(card);
      });
    } catch (err) {
      console.error("Erro ao carregar tarefas:", err);
    }
  }

  // -----------------------
  // Criação do elemento card
  // -----------------------
  function createCardElement({
    id = uid(),
    title = "Sem título",
    priority = "baixa",
    status = "pendente",
    dueDate = null,
    concluida = false,
    tags = [],
  }) {
    // elemento base
    const card = document.createElement("div");
    card.className = "kanban-card";
    card.dataset.id = id;
    card.dataset.priority = priority;
    if (dueDate) card.dataset.duedate = dueDate;
    if (isExpired(dueDate)) card.dataset.expired = "true";
    if (concluida) card.classList.add("concluida");
    // OBS: dataset.status sincronizado ao salvar / mover

    // TÍTULO
    const titleEl = document.createElement("span");
    titleEl.className = "card-title";
    titleEl.textContent = title;

    // TAGS (container)
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "card-tags";
    (tags || []).forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "tag";
      tagEl.textContent = tag;
      tagsContainer.appendChild(tagEl);
    });

    // META (data de vencimento)
    const metaEl = document.createElement("div");
    metaEl.className = "card-meta";
    if (dueDate) {
      const dueSpan = document.createElement("span");
      dueSpan.className = "card-due";
      dueSpan.textContent = formatDueLabel(dueDate);
      metaEl.appendChild(dueSpan);
    }

    // AÇÕES (botões)
    const actions = document.createElement("div");
    actions.className = "card-actions";

    const toggleDoneBtn = document.createElement("button");
    toggleDoneBtn.className = "btn-toggle-done";
    toggleDoneBtn.title = "Marcar/Desmarcar concluída";
    toggleDoneBtn.textContent = "✔️";
    toggleDoneBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      card.classList.toggle("concluida");
      updateCardExpiration(card);
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

    // montar card
    card.appendChild(titleEl);
    card.appendChild(tagsContainer);
    card.appendChild(metaEl);
    card.appendChild(actions);

    // comportamentos
    attachDragListeners(card);
    card.addEventListener("dblclick", () => openModalForEdit(card));

    return card;
  }

  // -----------------------
  // Drag & Drop
  // -----------------------
  function attachDragListeners(card) {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      try {
        e.dataTransfer.setData("text/plain", card.dataset.id);
      } catch (err) {
        // some browsers block cross-origin setData in some contexts
      }
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      updateCardExpiration(card);
      normalizeStatusesAndPersist();
    });
  }

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

  function initColumnsDrop() {
    const cols = document.querySelectorAll(".kanban-cards");
    cols.forEach((col) => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        col.classList.add("cards-hover");
        const dragging = document.querySelector(".dragging");
        if (!dragging) return;
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
        // atualiza status do card para refletir a coluna alvo
        dragging.dataset.status = col.dataset.status;
        normalizeStatusesAndPersist();
      });
    });
  }

  // -----------------------
  // Expiração / normalização
  // -----------------------
  function updateCardExpiration(card) {
    const dd = card.dataset.duedate || null;
    if (isExpired(dd)) card.dataset.expired = "true";
    else delete card.dataset.expired;
  }

  function normalizeStatusesAndPersist() {
    // sincroniza dataset.status com a coluna atual e atualiza expiração
    document.querySelectorAll(".kanban-cards").forEach((col) => {
      const status = col.dataset.status;
      col.querySelectorAll(".kanban-card").forEach((card) => {
        card.dataset.status = status;
        updateCardExpiration(card);
      });
    });
    saveTasksToLocalStorage();
    applyFiltersAndSort(); // mantém UI consistente
  }

  // -----------------------
  // Modal: abrir / fechar / preencher
  // -----------------------
  function openModalForNew() {
    editingCardId = null;
    titleInput.value = "";
    tagsInput && (tagsInput.value = "");
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
    statusSelect.value = cardEl.closest(".kanban-cards").dataset.status || "pendente";
    dueDateInput.value = cardEl.dataset.duedate || "";
    doneCheckbox.checked = cardEl.classList.contains("concluida");

    // preencher campo de tags com o que existe no card
    const existingTags = Array.from(cardEl.querySelectorAll(".tag")).map(t => t.textContent);
    if (tagsInput) tagsInput.value = existingTags.join(", ");

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
    editingCardId = null;
  }

  // -----------------------
  // Atualizar tags visuais do card
  // -----------------------
  function updateCardTags(card, tags) {
    let container = card.querySelector(".card-tags");
    if (!container) {
      container = document.createElement("div");
      container.className = "card-tags";
      // inserir antes da meta
      const meta = card.querySelector(".card-meta");
      if (meta) card.insertBefore(container, meta);
      else card.appendChild(container);
    }
    container.innerHTML = "";
    (tags || []).forEach(tag => {
      const t = document.createElement("span");
      t.className = "tag";
      t.textContent = tag;
      container.appendChild(t);
    });
  }

  // -----------------------
  // Submissão do modal (criar / editar)
  // -----------------------
  function handleModalSubmit() {
    const title = titleInput.value.trim();
    const priority = prioritySelect.value;
    const status = statusSelect.value;
    const dueDate = dueDateInput.value || null;
    const done = !!doneCheckbox.checked;

    // ler tags do input (se existir)
    const tags = tagsInput
      ? tagsInput.value
          .split(",")
          .map(t => t.trim())
          .filter(t => t !== "")
      : [];

    if (!title) {
      alert("Digite um título para a tarefa.");
      return;
    }

    if (editingCardId) {
      // editar existente
      const card = document.querySelector(`.kanban-card[data-id="${editingCardId}"]`);
      if (card) {
        // atualizar conteúdo e metadados
        card.querySelector(".card-title").textContent = title;
        card.dataset.priority = priority;
        if (dueDate) card.dataset.duedate = dueDate;
        else delete card.dataset.duedate;

        if (done) card.classList.add("concluida");
        else card.classList.remove("concluida");

        // atualizar tags visuais
        updateCardTags(card, tags);

        // mover para coluna alvo se necessário
        const targetCol = getColumnByStatus(status);
        if (targetCol && card.closest(".kanban-cards") !== targetCol) {
          targetCol.appendChild(card);
        }

        // garantir dataset.status atualizado
        card.dataset.status = status;
        updateCardExpiration(card);
      } else {
        // safety: criar novo se não encontrou
        createAndAppendTask({
          id: uid(),
          title,
          priority,
          status,
          dueDate,
          concluida: done,
          tags
        });
      }
    } else {
      // criar novo
      createAndAppendTask({
        id: uid(),
        title,
        priority,
        status,
        dueDate,
        concluida: done,
        tags
      });
    }

    closeModal();
    normalizeStatusesAndPersist();
  }

  function createAndAppendTask(taskObj) {
    const card = createCardElement(taskObj);
    // assegurar tags visuais se vierem como parte do objeto
    updateCardTags(card, taskObj.tags || []);
    const col = getColumnByStatus(taskObj.status) || getColumnByStatus("pendente");
    col.appendChild(card);
    saveTasksToLocalStorage();
  }

  // -----------------------
  // Filtros, busca e ordenação
  // -----------------------
  function applyFiltersAndSort() {
    const pFilter = filterPriority?.value || "all";
    const q = searchInput?.value.trim().toLowerCase() || "";
    const sort = sortBy?.value || "none";

    document.querySelectorAll(".kanban-cards").forEach((col) => {
      let cards = Array.from(col.querySelectorAll(".kanban-card"));

      // filter by priority & search
      cards.forEach((card) => {
        const matchesPriority = pFilter === "all" || card.dataset.priority === pFilter;
        const matchesQuery = !q || card.querySelector(".card-title").textContent.toLowerCase().includes(q);
        card.style.display = matchesPriority && matchesQuery ? "" : "none";
      });

      // sorting (reordena os visíveis)
      if (sort !== "none") {
        const visibleCards = cards.filter(c => c.style.display !== "none");
        const hiddenCards = cards.filter(c => c.style.display === "none");

        if (sort === "priority") {
          const order = { "alta": 0, "media": 1, "baixa": 2 };
          visibleCards.sort((a, b) => (order[a.dataset.priority] - order[b.dataset.priority]));
        } else if (sort === "dueDateAsc" || sort === "dueDateDesc") {
          visibleCards.sort((a, b) => {
            const da = a.dataset.duedate || "";
            const db = b.dataset.duedate || "";
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return sort === "dueDateAsc" ? (new Date(da) - new Date(db)) : (new Date(db) - new Date(da));
          });
        }

        visibleCards.forEach(vc => col.appendChild(vc));
        hiddenCards.forEach(hc => col.appendChild(hc));
      }
    });
  }

  // -----------------------
  // Export / Import CSV (tags em coluna separada por ;)
  // -----------------------
  function exportToCSV() {
    const rows = [["id", "title", "priority", "status", "dueDate", "concluida", "tags"]];
    document.querySelectorAll(".kanban-card").forEach((card) => {
      const id = card.dataset.id;
      const title = card.querySelector(".card-title").textContent;
      const priority = card.dataset.priority || "";
      const status = card.closest(".kanban-cards").dataset.status || "";
      const dueDate = card.dataset.duedate || "";
      const concluida = card.classList.contains("concluida") ? "true" : "false";
      const tags = Array.from(card.querySelectorAll(".tag")).map(t => t.textContent).join(";");
      rows.push([id, title, priority, status, dueDate, concluida, tags]);
    });

    const csv = rows.map(r => r.map(cell => {
      if (cell == null) return "";
      const s = String(cell).replace(/"/g, '""');
      return `"${s}"`;
    }).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // parser CSV robusto (suporta campos entre aspas e aspas escapadas)
  function parseCSV(text) {
    const lines = [];
    let i = 0, cur = "", row = [], inQuotes = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i+1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(cur); cur = "";
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && text[i+1] === '\n') i++;
        row.push(cur); lines.push(row); row = []; cur = "";
      } else {
        cur += ch;
      }
      i++;
    }
    if (cur !== "" || row.length) { row.push(cur); lines.push(row); }
    return lines.map(r => r.map(c => c.trim().replace(/^"|"$/g, "")));
  }

  function importFromCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (!parsed || parsed.length < 2) { alert("CSV vazio ou inválido."); return; }

      const headers = parsed[0].map(h => h.toLowerCase());
      for (let r = 1; r < parsed.length; r++) {
        const row = parsed[r];
        if (row.length === 1 && row[0].trim() === "") continue;
        const obj = {};
        headers.forEach((h, idx) => obj[h] = row[idx] || "");
        // montar task
        const task = {
          id: obj.id || uid(),
          title: obj.title || "Sem título",
          priority: obj.priority || "baixa",
          status: obj.status || "pendente",
          dueDate: obj.duedate || obj["dueDate"] || obj["due_date"] || "",
          concluida: String(obj.concluida || obj.done || "").toLowerCase() === "true",
          tags: (obj.tags || "").split(";").map(t => t.trim()).filter(t => t !== "")
        };
        const col = getColumnByStatus(task.status) || getColumnByStatus("pendente");
        const card = createCardElement(task);
        updateCardTags(card, task.tags);
        col.appendChild(card);
      }

      normalizeStatusesAndPersist();
      alert("Importação finalizada.");
    };
    reader.readAsText(file, "UTF-8");
  }

  // -----------------------
  // UI inicialização e eventos
  // -----------------------
  function initUI() {
    openBtn && openBtn.addEventListener("click", openModalForNew);
    closeBtn && closeBtn.addEventListener("click", closeModal);
    addTaskBtn && addTaskBtn.addEventListener("click", handleModalSubmit);

    // fechar modal clicando fora
    window.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    // teclas: Esc e Enter
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "Enter" && modal && modal.style.display === "block") {
        const active = document.activeElement;
        if (modal.contains(active) && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA")) {
          e.preventDefault();
          handleModalSubmit();
        }
      }
    });

    // filtros / ordenação / busca
    filterPriority && filterPriority.addEventListener("change", applyFiltersAndSort);
    sortBy && sortBy.addEventListener("change", applyFiltersAndSort);
    searchInput && searchInput.addEventListener("input", debounce(applyFiltersAndSort, 180));

    // export / import
    exportBtn && exportBtn.addEventListener("click", exportToCSV);
    importBtn && importBtn.addEventListener("click", () => importFile && importFile.click());
    importFile && importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importFromCSVFile(file);
      importFile.value = "";
    });

    initColumnsDrop();
  }

  // -----------------------
  // util: debounce
  // -----------------------
  function debounce(fn, wait = 150) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  // -----------------------
  // Observador de mutações (persistir automaticamente)
  // -----------------------
  function startMutationObserver() {
    const mo = new MutationObserver(debounce(() => normalizeStatusesAndPersist(), 80));
    if (board) mo.observe(board, { childList: true, subtree: true });
  }

  // -----------------------
  // Inicialização final
  // -----------------------
  window.addEventListener("DOMContentLoaded", () => {
    // verificar elementos essenciais
    if (!titleInput || !prioritySelect || !statusSelect || !modal) {
      console.error("Elementos essenciais do modal não encontrados. Verifique seu HTML.");
      return;
    }

    initUI();
    loadTasksFromLocalStorage();

    // após carregar, atualizar expirações e aplicar filtros
    document.querySelectorAll(".kanban-card").forEach(card => updateCardExpiration(card));
    applyFiltersAndSort();
    startMutationObserver();
  });

})(); // fim do módulo IIFE
