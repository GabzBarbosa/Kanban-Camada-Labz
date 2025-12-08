/* DASHBOARD E CALENDÁRIO LIGADOS AO KANBAN */

const STORAGE_KEY = "kanbanTasks_v2";
let tasks = [];

function loadTasks() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

tasks = loadTasks();


// ---------- CALENDÁRIO ----------
let currentDate = new Date();

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthName = currentDate.toLocaleString("pt-BR", { month: "long" });
    document.getElementById("calendarTitle").textContent = `${monthName} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const calendarGrid = document.getElementById("calendarGrid");
    calendarGrid.innerHTML = "";

    // Cria espaços vazios antes do dia 1
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.appendChild(document.createElement("div"));
    }

    // Preenche dias reais
    for (let day = 1; day <= totalDays; day++) {
        const div = document.createElement("div");

        const dayLabel = document.createElement("div");
        dayLabel.classList.add("day-number");
        dayLabel.textContent = day;

        div.appendChild(dayLabel);

        // Marcar tarefas do dia
        const dayStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

        const tasksThisDay = tasks.filter(t => t.dueDate === dayStr);

        tasksThisDay.forEach(() => {
            const dot = document.createElement("div");
            dot.classList.add("task-dot");
            div.appendChild(dot);
        });

        calendarGrid.appendChild(div);
    }
}

document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

renderCalendar();


// ---------- DASHBOARD (CHARTS) ----------
function countBy(field) {
    const map = {};
    tasks.forEach(t => {
        const key = t[field] || "sem";
        map[key] = (map[key] || 0) + 1;
    });
    return map;
}

function countDueStatus() {
    let vencidas = 0;
    let noPrazo = 0;
    let semData = 0;

    const today = new Date();
    today.setHours(0,0,0,0);

    tasks.forEach(t => {
        if (!t.dueDate) {
            semData++;
            return;
        }
        const d = new Date(t.dueDate);
        d.setHours(0,0,0,0);

        if (d < today) vencidas++;
        else noPrazo++;
    });

    return { vencidas, noPrazo, semData };
}

function makeChart(id, labels, data, title) {
    new Chart(document.getElementById(id), {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: title } }
        }
    });
}

const statusCount = countBy("status");
makeChart(
    "statusChart",
    Object.keys(statusCount),
    Object.values(statusCount),
    "Status das Tarefas"
);

const priorityCount = countBy("priority");
makeChart(
    "priorityChart",
    Object.keys(priorityCount),
    Object.values(priorityCount),
    "Prioridade"
);

const dueCount = countDueStatus();
makeChart(
    "dueChart",
    ["Vencidas", "No prazo", "Sem Data"],
    [dueCount.vencidas, dueCount.noPrazo, dueCount.semData],
    "Datas de Vencimento"
);
