let editingCard = null;

function saveTasksToLocalStorage() {
  const tasks = [];
  document.querySelectorAll('.kanban-card').forEach(card => {
    tasks.push({
      title: card.querySelector("span").textContent,
      priority: card.getAttribute("data-priority"),
      status: card.closest(".kanban-cards").getAttribute("data-status")
    });
  });
  localStorage.setItem("kanbanTasks", JSON.stringify(tasks));
}

function loadTasksFromLocalStorage() {
  const saved = localStorage.getItem("kanbanTasks");
  if (saved) {
    const tasks = JSON.parse(saved);
    tasks.forEach(task => {
      const card = createCard(task.title, task.priority, task.status);
      document.querySelector(`.kanban-cards[data-status="${task.status}"]`).appendChild(card);
    });
  }
}

function initDragAndDrop() {
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', e => {
      e.currentTarget.classList.add('dragging');
    });

    card.addEventListener('dragend', e => {
      e.currentTarget.classList.remove('dragging');
      saveTasksToLocalStorage();
    });
  });

  document.querySelectorAll('.kanban-cards').forEach(column => {
    column.addEventListener('dragover', e => {
      e.preventDefault();
      column.classList.add('cards-hover');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('cards-hover');
    });

    column.addEventListener('drop', e => {
      const draggingCard = document.querySelector('.dragging');
      column.classList.remove('cards-hover');
      if (draggingCard) column.appendChild(draggingCard);
      saveTasksToLocalStorage();
    });
  });
}

function createCard(title, priority, status) {
  const card = document.createElement("div");
  card.className = "kanban-card";
  card.setAttribute("data-priority", priority);
  card.setAttribute("draggable", "true");

  const text = document.createElement("span");
  text.textContent = title;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const editBtn = document.createElement("button");
  editBtn.innerHTML = "✏️";
  editBtn.title = "Editar";
  editBtn.onclick = () => {
    openEditModal(card);
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.innerHTML = "🗑️";
  deleteBtn.title = "Excluir";
  deleteBtn.onclick = () => {
    const confirmDelete = confirm("Tem certeza que deseja excluir esta tarefa?");
    if (confirmDelete) {
      card.remove();
      saveTasksToLocalStorage();
    }
  };

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(text);
  card.appendChild(actions);

  card.addEventListener("dblclick", () => {
    openEditModal(card);
  });

  card.addEventListener("dragstart", e => {
    e.currentTarget.classList.add("dragging");
  });

  card.addEventListener("dragend", e => {
    e.currentTarget.classList.remove("dragging");
  });

  return card;
}

function openEditModal(card) {
  editingCard = card;
  document.getElementById("taskTitle").value = card.querySelector("span").textContent;
  document.getElementById("taskPriority").value = card.getAttribute("data-priority");
  document.getElementById("taskStatus").value = card.closest(".kanban-cards").getAttribute("data-status");
  modal.style.display = "block";
}

// Modal control
const modal = document.getElementById("taskModal");
const openBtn = document.getElementById("openModalBtn");
const closeBtn = document.querySelector(".close-btn");
const addTaskBtn = document.getElementById("addTaskBtn");

openBtn.onclick = () => {
  editingCard = null;
  modal.style.display = "block";
  document.getElementById("taskTitle").value = "";
  document.getElementById("taskPriority").value = "baixa";
  document.getElementById("taskStatus").value = "pendente";
};

closeBtn.onclick = () => {
  modal.style.display = "none";
};

addTaskBtn.onclick = () => {
  const title = document.getElementById("taskTitle").value.trim();
  const priority = document.getElementById("taskPriority").value;
  const status = document.getElementById("taskStatus").value;

  if (!title) {
    alert("Digite um título para a tarefa.");
    return;
  }

  const targetColumn = document.querySelector(`.kanban-cards[data-status="${status}"]`);

  if (editingCard) {
    editingCard.querySelector("span").textContent = title;
    editingCard.setAttribute("data-priority", priority);
    targetColumn.appendChild(editingCard);
    editingCard = null;
  } else {
    const newCard = createCard(title, priority, status);
    targetColumn.appendChild(newCard);
  }

  modal.style.display = "none";
  saveTasksToLocalStorage();
  initDragAndDrop();
};



// Inicialização
window.onload = () => {
  loadTasksFromLocalStorage();
  initDragAndDrop();
};

