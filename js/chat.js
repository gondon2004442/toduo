// Live team chat: history + realtime subscription + sending.
// Context (ctx) is provided by app.js: { sb, currentUser, nameFor, refreshProfiles }

import { escapeHtml, formatTime } from "./util.js";

export function renderChat(root, ctx) {
  root.innerHTML = `
    <header class="panel-head">
      <div>
        <h2>Чат команды</h2>
        <p class="sub">Живая переписка</p>
      </div>
      <span class="status" id="chat-status"><i></i>подключение…</span>
    </header>
    <div class="chat-scroll" id="chat-scroll">
      <div class="empty" id="chat-empty">Пока сообщений нет. Напишите первое 👇</div>
      <div class="messages" id="chat-messages"></div>
    </div>
    <form class="composer" id="chat-form">
      <textarea id="chat-input" rows="1" placeholder="Сообщение…"></textarea>
      <button type="submit">Отправить</button>
    </form>
  `;

  const scroll = root.querySelector("#chat-scroll");
  const list = root.querySelector("#chat-messages");
  const empty = root.querySelector("#chat-empty");
  const form = root.querySelector("#chat-form");
  const input = root.querySelector("#chat-input");
  const statusEl = root.querySelector("#chat-status");

  const seen = new Set();

  function scrollToBottom() {
    scroll.scrollTop = scroll.scrollHeight;
  }

  async function appendMessage(m, { animate = false } = {}) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    empty.style.display = "none";

    let name = ctx.nameFor(m.user_id);
    if (!name) {
      await ctx.refreshProfiles();
      name = ctx.nameFor(m.user_id) || "Пользователь";
    }

    const mine = m.user_id === ctx.currentUser.id;
    const el = document.createElement("div");
    el.className = `msg ${mine ? "mine" : "theirs"}${animate ? " pop" : ""}`;
    el.innerHTML = `
      <div class="bubble">
        ${mine ? "" : `<div class="who">${escapeHtml(name)}</div>`}
        <div class="body">${escapeHtml(m.body)}</div>
        <div class="time">${formatTime(m.created_at)}</div>
      </div>`;
    list.appendChild(el);
    scrollToBottom();
  }

  async function loadHistory() {
    const { data, error } = await ctx.sb
      .from("messages")
      .select("id, user_id, body, created_at")
      .order("id", { ascending: true })
      .limit(300);
    if (error) {
      console.error("chat history:", error);
      return;
    }
    for (const m of data) await appendMessage(m);
  }

  function subscribe() {
    const channel = ctx.sb
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => appendMessage(payload.new, { animate: true }),
      )
      .subscribe((status) => {
        const online = status === "SUBSCRIBED";
        statusEl.classList.toggle("on", online);
        statusEl.innerHTML = `<i></i>${online ? "онлайн" : "подключение…"}`;
      });
    return channel;
  }

  async function send() {
    const body = input.value.trim();
    if (!body) return;
    input.value = "";
    autoGrow();
    const { error } = await ctx.sb
      .from("messages")
      .insert({ body, user_id: ctx.currentUser.id });
    if (error) {
      console.error("send:", error);
      input.value = body;
      alert("Не удалось отправить сообщение: " + error.message);
    }
  }

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send();
  });
  input.addEventListener("input", autoGrow);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  const channel = subscribe();
  loadHistory();

  // Return a teardown so app.js can unsubscribe when switching tabs.
  return () => ctx.sb.removeChannel(channel);
}
