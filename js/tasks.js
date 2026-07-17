// Tasks board: columns by status, task detail modal, attachments (files + links)
// grouped by stage. Files go to Supabase Storage bucket "attachments".
// Context (ctx) from app.js: { sb, currentUser, nameFor }

import { escapeHtml, formatDate } from "./util.js";

const STATUSES = [
  { key: "brief", label: "ТЗ" },
  { key: "in_progress", label: "В работе" },
  { key: "done", label: "Готово" },
];

const STAGES = [
  { key: "brief", label: "ТЗ и материалы", hint: "тз, шрифты, доки" },
  { key: "process", label: "Процесс работы", hint: "промежуточные файлы, заметки" },
  { key: "result", label: "Результат", hint: "финальный файл или ссылка" },
];

const BUCKET = "attachments";

export function renderTasks(root, ctx) {
  root.innerHTML = `
    <header class="panel-head">
      <div>
        <h2>Задачи</h2>
        <p class="sub">Доска задач команды</p>
      </div>
      <button class="btn primary" id="new-task">＋ Новая задача</button>
    </header>
    <div class="board" id="board"></div>
    <div class="modal-root" id="modal-root"></div>
  `;

  const board = root.querySelector("#board");
  const modalRoot = root.querySelector("#modal-root");
  let openTaskId = null;

  async function loadBoard() {
    const { data, error } = await ctx.sb
      .from("tasks")
      .select("id, title, description, status, created_at, created_by, task_attachments(count)")
      .order("created_at", { ascending: false });
    if (error) {
      board.innerHTML = `<div class="error-box">Не удалось загрузить задачи: ${escapeHtml(error.message)}</div>`;
      return;
    }
    renderBoard(data ?? []);
  }

  function renderBoard(tasks) {
    board.innerHTML = "";
    for (const col of STATUSES) {
      const colTasks = tasks.filter((t) => t.status === col.key);
      const column = document.createElement("div");
      column.className = "column";
      column.innerHTML = `
        <div class="col-head">${col.label}<span class="count">${colTasks.length}</span></div>
        <div class="col-body"></div>`;
      const body = column.querySelector(".col-body");
      if (colTasks.length === 0) {
        body.innerHTML = `<div class="col-empty">пусто</div>`;
      }
      for (const t of colTasks) {
        const count = t.task_attachments?.[0]?.count ?? 0;
        const card = document.createElement("button");
        card.className = "card";
        card.innerHTML = `
          <div class="card-title">${escapeHtml(t.title)}</div>
          ${t.description ? `<div class="card-desc">${escapeHtml(t.description)}</div>` : ""}
          <div class="card-meta">
            <span>${formatDate(t.created_at)}</span>
            ${count ? `<span class="chip">📎 ${count}</span>` : ""}
          </div>`;
        card.addEventListener("click", () => openTask(t.id));
        body.appendChild(card);
      }
      board.appendChild(column);
    }
  }

  // ── Task detail modal ─────────────────────────────────────────────────────
  async function openTask(id) {
    openTaskId = id;
    const { data: task, error } = await ctx.sb
      .from("tasks")
      .select("id, title, description, status, created_at, created_by")
      .eq("id", id)
      .single();
    if (error) {
      alert("Ошибка: " + error.message);
      return;
    }
    const { data: attachments } = await ctx.sb
      .from("task_attachments")
      .select("*")
      .eq("task_id", id)
      .order("id", { ascending: true });

    drawModal(task, attachments ?? []);
  }

  function closeModal() {
    openTaskId = null;
    modalRoot.innerHTML = "";
  }

  function drawModal(task, attachments) {
    const statusButtons = STATUSES.map(
      (s) =>
        `<button class="pill ${s.key === task.status ? "active" : ""}" data-status="${s.key}">${s.label}</button>`,
    ).join("");

    const stageSections = STAGES.map((stage) => {
      const items = attachments.filter((a) => a.stage === stage.key);
      const rows = items
        .map(
          (a) => `
        <div class="att">
          <span class="att-ico">${a.kind === "link" ? "🔗" : "📄"}</span>
          <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="att-name">${escapeHtml(a.name || a.url)}</a>
          <button class="att-del" data-del="${a.id}" title="Удалить">✕</button>
        </div>`,
        )
        .join("");
      return `
        <section class="stage">
          <div class="stage-head">
            <h4>${stage.label}</h4>
            <span class="stage-hint">${stage.hint}</span>
          </div>
          <div class="att-list">${rows || `<div class="att-empty">ничего не прикреплено</div>`}</div>
          <div class="stage-actions">
            <label class="btn ghost file-btn">
              📎 Файл
              <input type="file" data-upload="${stage.key}" hidden />
            </label>
            <button class="btn ghost" data-addlink="${stage.key}">🔗 Ссылка</button>
          </div>
        </section>`;
    }).join("");

    modalRoot.innerHTML = `
      <div class="overlay"></div>
      <div class="modal">
        <div class="modal-head">
          <input class="title-input" id="t-title" value="${escapeHtml(task.title)}" />
          <button class="icon-btn" id="close-modal" title="Закрыть">✕</button>
        </div>
        <div class="status-row">${statusButtons}</div>
        <textarea class="desc-input" id="t-desc" rows="3" placeholder="Описание задачи…">${escapeHtml(task.description || "")}</textarea>
        <div class="stages">${stageSections}</div>
        <div class="modal-foot">
          <button class="btn danger-ghost" id="del-task">Удалить задачу</button>
          <span class="saved" id="save-note"></span>
        </div>
      </div>`;

    const q = (sel) => modalRoot.querySelector(sel);
    q(".overlay").addEventListener("click", closeModal);
    q("#close-modal").addEventListener("click", closeModal);

    // Title / description autosave on blur.
    const note = q("#save-note");
    const showSaved = () => {
      note.textContent = "сохранено";
      setTimeout(() => (note.textContent = ""), 1200);
    };
    q("#t-title").addEventListener("blur", async (e) => {
      const title = e.target.value.trim() || "Без названия";
      await ctx.sb.from("tasks").update({ title }).eq("id", task.id);
      showSaved();
      loadBoard();
    });
    q("#t-desc").addEventListener("blur", async (e) => {
      await ctx.sb.from("tasks").update({ description: e.target.value }).eq("id", task.id);
      showSaved();
    });

    // Status pills.
    modalRoot.querySelectorAll("[data-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const status = btn.dataset.status;
        await ctx.sb.from("tasks").update({ status }).eq("id", task.id);
        task.status = status;
        modalRoot.querySelectorAll("[data-status]").forEach((b) =>
          b.classList.toggle("active", b.dataset.status === status),
        );
        loadBoard();
      });
    });

    // File uploads.
    modalRoot.querySelectorAll("[data-upload]").forEach((inp) => {
      inp.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await uploadFile(task.id, inp.dataset.upload, file);
        openTask(task.id);
        loadBoard();
      });
    });

    // Add link.
    modalRoot.querySelectorAll("[data-addlink]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const url = prompt("Вставьте ссылку (URL):");
        if (!url) return;
        const name = prompt("Название (необязательно):") || url;
        const { error } = await ctx.sb.from("task_attachments").insert({
          task_id: task.id,
          stage: btn.dataset.addlink,
          kind: "link",
          url: url.trim(),
          name: name.trim(),
          created_by: ctx.currentUser.id,
        });
        if (error) return alert("Ошибка: " + error.message);
        openTask(task.id);
        loadBoard();
      });
    });

    // Delete attachment.
    modalRoot.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await ctx.sb.from("task_attachments").delete().eq("id", btn.dataset.del);
        openTask(task.id);
        loadBoard();
      });
    });

    // Delete task.
    q("#del-task").addEventListener("click", async () => {
      if (!confirm("Удалить задачу вместе со всеми вложениями?")) return;
      await ctx.sb.from("tasks").delete().eq("id", task.id);
      closeModal();
      loadBoard();
    });
  }

  async function uploadFile(taskId, stage, file) {
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${taskId}/${stage}/${Date.now()}-${safe}`;
    const { error: upErr } = await ctx.sb.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });
    if (upErr) {
      alert("Не удалось загрузить файл: " + upErr.message);
      return;
    }
    const { data } = ctx.sb.storage.from(BUCKET).getPublicUrl(path);
    const { error } = await ctx.sb.from("task_attachments").insert({
      task_id: taskId,
      stage,
      kind: "file",
      url: data.publicUrl,
      name: file.name,
      created_by: ctx.currentUser.id,
    });
    if (error) alert("Файл загружен, но не привязан: " + error.message);
  }

  // ── New task ──────────────────────────────────────────────────────────────
  root.querySelector("#new-task").addEventListener("click", async () => {
    const title = prompt("Название задачи:");
    if (!title || !title.trim()) return;
    const { data, error } = await ctx.sb
      .from("tasks")
      .insert({ title: title.trim(), created_by: ctx.currentUser.id, status: "brief" })
      .select("id")
      .single();
    if (error) return alert("Ошибка: " + error.message);
    await loadBoard();
    openTask(data.id);
  });

  // ── Realtime: refresh board (and open modal) on any change ─────────────────
  const channel = ctx.sb
    .channel("public:tasks")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      loadBoard();
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_attachments" },
      () => {
        loadBoard();
        if (openTaskId) openTask(openTaskId);
      },
    )
    .subscribe();

  loadBoard();

  return () => ctx.sb.removeChannel(channel);
}
