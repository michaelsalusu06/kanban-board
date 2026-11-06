let boardTasks = [];
let undoStack = [];
let nextTaskId = 1;
let tasksData = { tasks: [], statuses: [], hours: [], taskList: [] };

const POMODORO_SEQUENCE = 
[
    { type: "focus", round: 1, badge: "Round 1 of 4", label: "Focus", seconds: 25 * 60 },
    { type: "break", round: 1, badge: "Round 1 of 4", label: "Break", seconds: 5 * 60 },
    { type: "focus", round: 2, badge: "Round 2 of 4", label: "Focus", seconds: 25 * 60 },
    { type: "break", round: 2, badge: "Round 2 of 4", label: "Break", seconds: 5 * 60 },
    { type: "focus", round: 3, badge: "Round 3 of 4", label: "Focus", seconds: 25 * 60 },
    { type: "break", round: 3, badge: "Round 3 of 4", label: "Break", seconds: 5 * 60 },
    { type: "focus", round: 4, badge: "Round 4 of 4", label: "Focus", seconds: 25 * 60 },
    { type: "long-break", round: 4, badge: "Cycle Complete", label: "Long Break", seconds: 15 * 60 }
];

let timerInterval = null;
let sequenceIndex = 0;
let remainingSeconds = POMODORO_SEQUENCE[0].seconds;
let isTimerRunning = false;

const STAGES = ["to-do", "on progress", "done"];
const INITIAL_SAMPLE_TASKS = 
[
    {name: "Draft Q4 product roadmap", status: "done", hours: 1.5, completedColor: true},
    {name: "Review open pull requests", status: "done", hours: 2.0, completedColor: true},
    {name: "Refine dashboard layout and spacing", status: "on progress", hours: 2.5, completedColor: false},
    {name: "Write release notes for v1.2", status: "to-do", hours: 1.0, completedColor: false}
];

document.addEventListener("DOMContentLoaded", function () 
{
    setupKeyboardShortcuts();
    setupColumnDragAndDrop();
    loadInitialBoard();
    updateTimerUI();
    fetchExistingReport();
});

function setupKeyboardShortcuts() 
{
    const taskInput = document.getElementById("taskInput");
    const hoursInput = document.getElementById("hoursInput");

    if(taskInput) 
    {
        taskInput.addEventListener("keydown", function (e) 
        {
            if(e.key === "Enter") 
            {
                e.preventDefault();
                addTask();
            }
        });
    }

    if(hoursInput) 
    {
        hoursInput.addEventListener("keydown", function (e) 
        {
            if(e.key === "Enter") 
            {
                e.preventDefault();
                addTask();
            }
        });
    }
}

function loadInitialBoard() 
{
    const saved = localStorage.getItem("kanban_studio_tasks_v3");
    if(saved) 
    {
        try 
        {
            const parsed = JSON.parse(saved);
            if(Array.isArray(parsed) && parsed.length > 0) 
            {
                parsed.forEach(function (item) 
                {
                    createAndMountTask(item.name, item.status, item.hours, item.completedColor, false);
                });
                syncTasksData();
                return;
            }
        } 
        
        catch(err) 
        {
            console.warn("Could not parse saved tasks:", err);
        }
    }

    INITIAL_SAMPLE_TASKS.forEach(function (item) 
    {
        createAndMountTask(item.name, item.status, item.hours, item.completedColor, false);
    });
    syncTasksData();
}

function getListElementForStatus(statusVal) 
{
    if(statusVal === "to-do") 
    {
        return document.getElementById("todoList");
    } 
    
    else if(statusVal === "on progress") 
    {
        return document.getElementById("progressList");
    } 
    
    else 
    {
        return document.getElementById("doneList");
    }
}

function getStageClass(statusVal) 
{
    if(statusVal === "to-do") return "task-todo";
    if(statusVal === "on progress") return "task-progress";
    return "task-done";
}

function formatStatusLabel(statusVal) 
{
    if(statusVal === "to-do") return "To-Do";
    if(statusVal === "on progress") return "In Progress";
    return "Done";
}

function addTask() 
{
    let taskInput = document.getElementById("taskInput");
    let hoursInput = document.getElementById("hoursInput");
    let statusSelect = document.getElementById("statusSelect");

    let taskName = taskInput.value.trim();
    let statusVal = statusSelect.value;
    let hoursVal = parseFloat(hoursInput ? hoursInput.value : "1.0");

    if(taskName === "") 
    {
        taskInput.focus();
        return;
    }

    if(isNaN(hoursVal) || hoursVal <= 0) 
    {
        hoursVal = 1.0;
    }

    let isDone = statusVal === "done";
    createAndMountTask(taskName, statusVal, hoursVal, isDone, true);

    taskInput.value = "";
    taskInput.focus();
}

function createAndMountTask(taskName, statusVal, hoursVal, isCompletedVisual, persist) 
{
    const taskId = "task-" + (nextTaskId++);
    const normalizedStatus = STAGES.includes(statusVal) ? statusVal : "to-do";
    const numericHours = typeof hoursVal === "number" && !isNaN(hoursVal) ? hoursVal : 1.0;

    const taskRecord = 
    {
        id: taskId,
        name: taskName,
        status: normalizedStatus,
        hours: numericHours,
        completedColor: Boolean(isCompletedVisual || normalizedStatus === "done")
    };

    boardTasks.push(taskRecord);

    let li = document.createElement("li");
    li.id = taskId;
    li.draggable = true;

    renderTaskCardContents(li, taskRecord);

    li.addEventListener("dragstart", function (event) 
    {
        event.dataTransfer.setData("text/plain", taskRecord.id);
        event.dataTransfer.effectAllowed = "move";
    });

    const targetList = getListElementForStatus(normalizedStatus);
    targetList.appendChild(li);

    if(persist) 
    {
        syncTasksData();
    }
}

function renderTaskCardContents(li, taskRecord) 
{
    li.className = "";
    li.classList.add(getStageClass(taskRecord.status));

    if(taskRecord.completedColor || taskRecord.status === "done") 
    {
        li.style.backgroundColor = "rgba(214, 242, 226, 0.72)";
        li.classList.add("task-completed-visual");
    } 
    
    else 
    {
        li.style.backgroundColor = "rgba(255, 255, 255, 0.70)";
    }

    const stageIdx = STAGES.indexOf(taskRecord.status);
    const canMoveLeft = stageIdx > 0;
    const canMoveRight = stageIdx < STAGES.length - 1;

    li.innerHTML = "";

    const topRow = document.createElement("div");
    topRow.className = "task-top-row";

    const titleSpan = document.createElement("span");
    titleSpan.className = "task-title-text";
    titleSpan.textContent = taskRecord.name;

    const hoursSpan = document.createElement("span");
    hoursSpan.className = "task-hours-pill";
    hoursSpan.textContent = taskRecord.hours.toFixed(1) + "h";

    topRow.appendChild(titleSpan);
    topRow.appendChild(hoursSpan);

    const bottomRow = document.createElement("div");
    bottomRow.className = "task-bottom-row";

    const statusHint = document.createElement("span");
    statusHint.className = "task-status-hint";
    statusHint.textContent = taskRecord.completedColor ? "Completed" : formatStatusLabel(taskRecord.status);

    const actionsGroup = document.createElement("div");
    actionsGroup.className = "task-actions";

    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "card-action-btn";
    leftBtn.innerHTML = "&larr;";
    leftBtn.title = "Move to previous box";
    leftBtn.disabled = !canMoveLeft;
    leftBtn.addEventListener("click", function (e) 
    {
        e.stopPropagation();
        if(canMoveLeft) 
        {
            moveTaskToStatus(taskRecord.id, STAGES[stageIdx - 1], false);
        }
    });

    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "card-action-btn";
    rightBtn.innerHTML = "&rarr;";
    rightBtn.title = "Move to next box";
    rightBtn.disabled = !canMoveRight;
    rightBtn.addEventListener("click", function (e) 
    {
        e.stopPropagation();
        if(canMoveRight) 
        {
            moveTaskToStatus(taskRecord.id, STAGES[stageIdx + 1], false);
        }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "card-action-btn card-delete-btn";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = "Remove task from this box";
    deleteBtn.addEventListener("click", function (e) 
    {
        e.stopPropagation();
        removeTask(taskRecord.id);
    });

    actionsGroup.appendChild(leftBtn);
    actionsGroup.appendChild(rightBtn);
    actionsGroup.appendChild(deleteBtn);

    bottomRow.appendChild(statusHint);
    bottomRow.appendChild(actionsGroup);

    li.appendChild(topRow);
    li.appendChild(bottomRow);
}

function moveTaskToStatus(taskId, newStatus, preserveColorFlag) 
{
    const taskRecord = boardTasks.find(function (t) { return t.id === taskId; });
    const li = document.getElementById(taskId);
    if(!taskRecord || !li) return;

    taskRecord.status = newStatus;
    if(!preserveColorFlag) 
    {
        taskRecord.completedColor = (newStatus === "done");
    }

    const destinationList = getListElementForStatus(newStatus);
    destinationList.appendChild(li);

    renderTaskCardContents(li, taskRecord);
    syncTasksData();
}

function removeTask(taskId) 
{
    const idx = boardTasks.findIndex(function (t) { return t.id === taskId; });
    if(idx === -1) return;

    const removedTask = boardTasks.splice(idx, 1)[0];
    const li = document.getElementById(taskId);
    if(li && li.parentNode) 
    {
        li.parentNode.removeChild(li);
    }

    undoStack.push(removedTask);
    syncTasksData();

    fetch("/undo/push", 
    {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify
        ({
            name: removedTask.name,
            status: removedTask.status,
            hours: removedTask.hours
        })
    }).catch(function () {});
}

async function undoDelete() 
{
    if(undoStack.length === 0) return;

    const restoredTask = undoStack.pop();
    createAndMountTask
    (
        restoredTask.name,
        restoredTask.status,
        restoredTask.hours,
        restoredTask.completedColor,
        true
    );

    try 
    {
        await fetch("/undo/pop", { method: "POST" });
    } 
    
    catch(e) {}
}

function setupColumnDragAndDrop() 
{
    const columns = document.querySelectorAll(".column");
    columns.forEach(function (col) 
    {
        col.addEventListener("dragover", function (e) 
        {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            col.classList.add("drag-over");
        });

        col.addEventListener("dragleave", function () 
        {
            col.classList.remove("drag-over");
        });

        col.addEventListener("drop", function (e) 
        {
            e.preventDefault();
            col.classList.remove("drag-over");
            const taskId = e.dataTransfer.getData("text/plain");
            const targetStatus = col.getAttribute("data-status");
            if(taskId && targetStatus) 
            {
                moveTaskToStatus(taskId, targetStatus, false);
            }
        });
    });
}

function syncTasksData() 
{
    tasksData.tasks = boardTasks.map(function (t) {return t.name;});
    tasksData.statuses = boardTasks.map(function (t) {return t.status;});
    tasksData.hours = boardTasks.map(function (t) {return t.hours;});
    tasksData.taskList = boardTasks.map(function (t) 
    {
        return {
            name: t.name,
            status: t.status === "done" ? "Done" : (t.status === "on progress" ? "On Progress" : "To-Do"),
            hours: t.hours
        };
    });

    localStorage.setItem("kanban_studio_tasks_v3", JSON.stringify(boardTasks));
    updateBoardMetrics();
}

function updateBoardMetrics() 
{
    let todoCount = 0, todoHours = 0;
    let progressCount = 0, progressHours = 0;
    let doneCount = 0, doneHours = 0;

    boardTasks.forEach(function (t) 
    {
        if(t.status === "to-do") 
        {
            todoCount++;
            todoHours += t.hours;
        } 
        
        else if(t.status === "on progress") 
        {
            progressCount++;
            progressHours += t.hours;
        } 
        
        else if(t.status === "done") 
        {
            doneCount++;
            doneHours += t.hours;
        }
    });

    const remainingHours = todoHours + progressHours;
    const pendingCount = todoCount + progressCount;

    document.getElementById("count-todo").textContent = todoCount;
    document.getElementById("hours-todo").textContent = todoHours.toFixed(1) + "h";

    document.getElementById("count-progress").textContent = progressCount;
    document.getElementById("hours-progress").textContent = progressHours.toFixed(1) + "h";

    document.getElementById("count-done").textContent = doneCount;
    document.getElementById("hours-done").textContent = doneHours.toFixed(1) + "h";

    document.getElementById("metricPending").textContent = pendingCount;
    document.getElementById("metricDone").textContent = doneCount;
    document.getElementById("metricHours").textContent = remainingHours.toFixed(1) + "h";

    const undoBtn = document.getElementById("undoBtn");
    const undoBadge = document.getElementById("undoCountBadge");
    if(undoBtn && undoBadge) 
    {
        undoBadge.textContent = undoStack.length;
        undoBtn.disabled = undoStack.length === 0;
    }
}

function formatSeconds(sec) 
{
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    const minStr = minutes < 10 ? "0" + minutes : String(minutes);
    const secStr = seconds < 10 ? "0" + seconds : String(seconds);
    return minStr + ":" + secStr;
}

function updateTimerUI() 
{
    const step = POMODORO_SEQUENCE[sequenceIndex];
    const displayEl = document.getElementById("timerDisplay");
    const modeLabel = document.getElementById("timerModeLabel");
    const badgeEl = document.getElementById("sessionCounter");
    const progressEl = document.getElementById("timerProgressBar");
    const startBtn = document.getElementById("startTimerBtn");
    const dotsContainer = document.getElementById("pomoDots");

    if(displayEl) 
    {
        displayEl.textContent = formatSeconds(remainingSeconds);
        displayEl.classList.remove("timer-running", "timer-break");

        if(isTimerRunning) 
        {
            displayEl.classList.add(step.type === "focus" ? "timer-running" : "timer-break");
        }
    }

    if(modeLabel)
    {
        modeLabel.textContent = step.label;
    }

    if(badgeEl) 
    {
        badgeEl.textContent = step.badge;
    }

    if(progressEl && step.seconds > 0) 
    {
        const pct = Math.max(0, Math.min(100, (remainingSeconds / step.seconds) * 100));
        progressEl.style.width = pct + "%";
    }

    if(startBtn) 
    {
        startBtn.textContent = isTimerRunning ? "Running..." : "Start";
        startBtn.disabled = isTimerRunning;
    }

    if(dotsContainer) 
    {
        const dots = dotsContainer.querySelectorAll(".pomo-dot");
        dots.forEach(function (dot, i) 
        {
            dot.classList.remove("active", "completed");
            const dotRound = i + 1;
            if(dotRound < step.round || (dotRound === step.round && step.type !== "focus")) 
            {
                dot.classList.add("completed");
            } 
            
            else if(dotRound === step.round && step.type === "focus") 
            {
                dot.classList.add("active");
            }
        });
    }
}

function toggleTimer() 
{
    if(isTimerRunning) 
    {
        return;
    }

    isTimerRunning = true;
    updateTimerUI();

    timerInterval = setInterval(function () 
    {
        remainingSeconds--;
        updateTimerUI();

        if(remainingSeconds <= 0) 
        {
            clearInterval(timerInterval);
            timerInterval = null;
            playCompletionChime();

            sequenceIndex = (sequenceIndex + 1) % POMODORO_SEQUENCE.length;
            remainingSeconds = POMODORO_SEQUENCE[sequenceIndex].seconds;

            if(sequenceIndex === 0) 
            {
                isTimerRunning = false;
                updateTimerUI();
            } 
            
            else 
            {
                isTimerRunning = false;
                toggleTimer();
            }
        }
    }, 1000);
}

function resetTimer() 
{
    if(timerInterval !== null) 
    {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    isTimerRunning = false;
    sequenceIndex = 0;
    remainingSeconds = POMODORO_SEQUENCE[0].seconds;
    updateTimerUI();
}

function playCompletionChime() 
{
    try 
    {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if(!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.65);
    } 
    
    catch(e) {}
}

let latestReportContent = "";

async function fetchExistingReport() 
{
    try 
    {
        const res = await fetch("/report");
        if(res.ok) 
        {
            const text = await res.text();
            if(text && text.trim().length > 0) 
            {
                latestReportContent = text;
            }
        }
    } 
    
    catch (e) {}
}

async function exportBoard() 
{
    const statusMsg = document.getElementById("statusMsg");

    statusMsg.textContent = "Generating daily report...";
    statusMsg.style.color = "#4a6fa5";

    try 
    {
        let response = await fetch("/process", 
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tasksData)
        });

        if(!response.ok) 
        {
            throw new Error("Server returned status " + response.status);
        }

        let contentType = response.headers.get("content-type") || "";
        if(contentType.includes("application/json")) 
        {
            let result = await response.json();
            statusMsg.textContent = "Report saved! Click Download in the Daily Productivity Report section below to view it.";
            statusMsg.style.color = "#2d684b";
            if(result.report) 
            {
                latestReportContent = result.report;
            }
        } 

        else
        {
            await response.text();
            statusMsg.textContent = "Report saved! Click Download in the Daily Productivity Report section below to view it.";
            statusMsg.style.color = "#2d684b";
            await fetchExistingReport();
        }
    } 
    
    catch(error) 
    {
        latestReportContent = buildClientFallbackReport();
        statusMsg.textContent = "Report saved! Click Download in the Daily Productivity Report section below to view it.";
        statusMsg.style.color = "#2d684b";
    }
}

function buildClientFallbackReport() 
{
    const completed = boardTasks
        .filter(function (t) {return t.status === "done";})
        .map(function (t) {return t.name + " (" + t.hours.toFixed(1) + "h)";})
        .sort();
    const pendingCount = boardTasks.filter(function (t) {return t.status !== "done";}).length;
    const completedHours = boardTasks
        .filter(function (t) {return t.status === "done";})
        .reduce(function (sum, t) {return sum + t.hours;}, 0);
    const totalHours = boardTasks.reduce(function (sum, t) {return sum + t.hours;}, 0);

    let lines = 
    [
        "====================================================",
        "          DAILY PRODUCTIVITY & WORKLOAD LOG         ",
        "====================================================",
        "",
        "COMPLETED TASKS (Alphabetical Roster):",
        "----------------------------------------------------"
    ];

    if(completed.length === 0) 
    {
        lines.push("  (No completed tasks recorded yet)");
    } 
    
    else 
    {
        completed.forEach(function (item, idx) 
        {
            lines.push("  " + (idx + 1) + ". " + item);
        });
    }
    lines.push("");
    lines.push("----------------------------------------------------");
    lines.push("WORKLOAD SUMMARY");
    lines.push("----------------------------------------------------");
    lines.push("  Completed Tasks        : " + completed.length);
    lines.push("  Pending Tasks          : " + pendingCount);
    lines.push("  Completed Work Hours   : " + completedHours.toFixed(1) + " hrs");
    lines.push("  Total Daily Workload   : " + totalHours.toFixed(1) + " hrs");
    lines.push("====================================================");
    return lines.join("\r\n");
}

function downloadReportText() 
{
    const content = latestReportContent || buildClientFallbackReport();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daily_report.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function toggleCustomDropdown(event) 
{
    event.stopPropagation();
    const container = document.getElementById("customStatusSelect");
    const trigger = document.getElementById("customSelectTrigger");
    if(!container) return;

    const isOpen = container.classList.toggle("open");
    if(trigger) 
    {
        trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
}

function selectCustomOption(value, label, dotClass) 
{
    const nativeSelect = document.getElementById("statusSelect");
    const textEl = document.getElementById("customSelectText");
    const dotEl = document.getElementById("customSelectDot");
    const container = document.getElementById("customStatusSelect");
    const trigger = document.getElementById("customSelectTrigger");

    if(nativeSelect) 
    {
        nativeSelect.value = value;
    }

    if(textEl) 
    {
        textEl.textContent = label;
    }

    if(dotEl) 
    {
        dotEl.className = "status-dot " + dotClass;
    }

    const options = document.querySelectorAll(".custom-select-option");
    options.forEach(function (opt) 
    {
        opt.classList.toggle("selected", opt.getAttribute("data-value") === value);
    });

    if(container) 
    {
        container.classList.remove("open");
    }

    if(trigger) 
    {
        trigger.setAttribute("aria-expanded", "false");
    }
}

function openPomoModal() 
{
    const modal = document.getElementById("pomoInfoModal");
    if(modal) 
    {
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    }
}

function closePomoModal() 
{
    const modal = document.getElementById("pomoInfoModal");
    if(modal) 
    {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }
}

function handleModalBackdropClick(event) 
{
    if(event.target && event.target.id === "pomoInfoModal") 
    {
        closePomoModal();
    }
}

document.addEventListener("click", function (event) 
{
    const container = document.getElementById("customStatusSelect");
    const trigger = document.getElementById("customSelectTrigger");
    if(container && !container.contains(event.target)) 
    {
        container.classList.remove("open");
        if(trigger) 
        {
            trigger.setAttribute("aria-expanded", "false");
        }
    }
});

document.addEventListener("keydown", function (event) 
{
    if(event.key === "Escape") 
    {
        closePomoModal();
        const container = document.getElementById("customStatusSelect");
        if(container) 
        {
            container.classList.remove("open");
        }
    }
});
