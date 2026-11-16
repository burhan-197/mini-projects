const todo = document.getElementById("todo");
const progress = document.getElementById("progress");
const done = document.getElementById("done");
const toggleModalBtn = document.getElementById("toggle-modal");
const modal = document.querySelector(".modal");
const addTaskBtn = document.getElementById("add-task");
const columns = [todo, progress, done];
const STORAGE_KEY = "kanban-board-tasks";

let draggedTask = null;

function updateCounts() {
    columns.forEach((column) => {
        const countBox = column.querySelector(".heading .right");
        const taskCount = column.querySelectorAll(".task").length;

        if (countBox) {
            countBox.textContent = taskCount;
        }
    });
}

function getTasksFromColumn(column) {
    return Array.from(column.querySelectorAll(".task")).map((task) => ({
        title: task.querySelector("h2")?.textContent.trim() || "",
        description: task.querySelector("p")?.textContent.trim() || ""
    }));
}

function saveTasks() {
    const state = {
        todo: getTasksFromColumn(todo),
        progress: getTasksFromColumn(progress),
        done: getTasksFromColumn(done)
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadTasks() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (saved && Array.isArray(saved.todo) && Array.isArray(saved.progress) && Array.isArray(saved.done)) {
            return saved;
        }
    } catch (error) {
        console.warn("Could not load tasks from localStorage", error);
    }

    return null;
}

function makeDraggable(task) {
    task.addEventListener("dragstart", () => {
        draggedTask = task;
    });

    task.addEventListener("dragend", () => {
        draggedTask = null;
    });
}

function makeDeleteable(task) {
    const deleteBtn = task.querySelector(".delete-btn");

    deleteBtn.addEventListener("click", () => {
        task.remove();
        updateCounts();
        saveTasks();
    });
}

function createTask(title, description, column = todo, shouldSave = true) {
    const task = document.createElement("div");
    task.classList.add("task");
    task.setAttribute("draggable", "true");
    task.innerHTML = `
        <h2>${title}</h2>
        <p>${description}</p>
        <button class="delete-btn">Delete</button>
    `;

    makeDraggable(task);
    makeDeleteable(task);
    column.appendChild(task);
    updateCounts();

    if (shouldSave) {
        saveTasks();
    }
}

function addDragEvents(column) {
    column.addEventListener("dragenter", (e) => {
        e.preventDefault();
        column.classList.add("hover-over");
    });

    column.addEventListener("dragleave", (e) => {
        column.classList.remove("hover-over");
    });

    column.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    column.addEventListener("drop", (e) => {
        if (draggedTask) {
            column.appendChild(draggedTask);
            column.classList.remove("hover-over");
            updateCounts();
            saveTasks();
        }
        e.preventDefault();
    });
}

function renderTasksFromState(state) {
    columns.forEach((column) => {
        column.querySelectorAll(".task").forEach((task) => task.remove());
    });

    const tasksByColumn = state || {
        todo: [],
        progress: [],
        done: []
    };

    tasksByColumn.todo.forEach((taskData) => createTask(taskData.title, taskData.description, todo, false));
    tasksByColumn.progress.forEach((taskData) => createTask(taskData.title, taskData.description, progress, false));
    tasksByColumn.done.forEach((taskData) => createTask(taskData.title, taskData.description, done, false));

    updateCounts();
    saveTasks();
}

addDragEvents(todo);
addDragEvents(progress);
addDragEvents(done);

const savedTasks = loadTasks();
const initialState = savedTasks || {
    todo: getTasksFromColumn(todo),
    progress: getTasksFromColumn(progress),
    done: getTasksFromColumn(done)
};

renderTasksFromState(initialState);

toggleModalBtn.addEventListener("click", () => {
    modal.style.display = "flex";
});

window.addEventListener("click", (e) => {
    if (!modal.contains(e.target) && e.target !== toggleModalBtn) {
        modal.style.display = "none";
    }
});

addTaskBtn.addEventListener("click", () => {
    const title = document.querySelector(".modal input").value.trim();
    const description = document.querySelector(".modal textarea").value.trim();

    if (!title && !description) {
        return;
    }

    createTask(title, description);
    document.querySelector(".modal input").value = "";
    document.querySelector(".modal textarea").value = "";
    modal.style.display = "none";
});
