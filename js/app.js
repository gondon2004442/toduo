// App orchestrator: setup gate → auth gate → app shell (Chat / Tasks).

import {
  hasCredentials,
  saveCredentials,
  clearCredentials,
  getSupabase,
} from "./supabase.js";
import {
  getSession,
  onAuthChange,
  signIn,
  signUp,
  signOut,
  getProfile,
} from "./auth.js";
import { renderChat } from "./chat.js";
import { renderTasks } from "./tasks.js";
import { escapeHtml, initials } from "./util.js";

const appEl = document.getElementById("app");

const state = {
  currentUser: null, // { id, displayName }
  profiles: new Map(), // id -> display_name
  tab: "chat",
  teardown: null, // cleanup for the active tab's realtime subscription
};

// ── Entry ────────────────────────────────────────────────────────────────────
main();

async function main() {
  if (!hasCredentials()) {
    renderSetup();
    return;
  }
  const session = await getSession();
  if (!session) {
    renderAuth();
  } else {
    await enterApp(session.user);
  }
  // React to sign-in / sign-out from anywhere.
  onAuthChange(async (s) => {
    if (s?.user && !state.currentUser) {
      await enterApp(s.user);
    } else if (!s && state.currentUser) {
      state.currentUser = null;
      renderAuth();
    }
  });
}

// ── Setup screen (enter Supabase URL + anon key) ─────────────────────────────
function renderSetup() {
  appEl.innerHTML = `
    <main class="center">
      <div class="card-box wide">
        <div class="brand"><div class="logo">T</div><h1>Toduo</h1></div>
        <p class="lead">Однократная настройка. Вставьте данные вашего проекта
          Supabase — они сохранятся в этом браузере.</p>
        <label>Project URL
          <input id="s-url" placeholder="https://xxxxx.supabase.co" />
        </label>
        <label>anon / publishable key
          <input id="s-key" placeholder="sb_publishable_... или eyJhbGciOi..." />
        </label>
        <p class="hint">Где взять: Supabase → ваш проект → Project Settings → API.
          Нужен публичный ключ (<b>anon</b> или <b>publishable</b>) — не секретный.
          Копируйте кнопкой копирования, а не выделением мышью.</p>
        <button class="btn primary block" id="s-save">Сохранить и продолжить</button>
      </div>
    </main>`;

  appEl.querySelector("#s-save").addEventListener("click", () => {
    const url = appEl.querySelector("#s-url").value.trim().replace(/\/+$/, "");
    const key = appEl.querySelector("#s-key").value.trim().replace(/\s+/g, "");
    if (!url || !key) {
      alert("Заполните оба поля");
      return;
    }
    // Текст, скопированный из обрезанного поля, тянет за собой «…» (или иной
    // не-Latin1 символ), из-за чего позже ломаются заголовки запроса. Ловим сразу.
    if (/[^\x00-\x7F]/.test(url) || /[^\x00-\x7F]/.test(key)) {
      alert(
        "В URL или ключе есть посторонний символ (например «…»).\n\n" +
          "Скорее всего ключ скопирован не полностью. В Supabase нажмите ИКОНКУ " +
          "копирования рядом с ключом (не выделяйте мышью) и вставьте снова.",
      );
      return;
    }
    if (!/^https:\/\/.+/.test(url)) {
      alert("Project URL должен начинаться с https:// и вести на ваш проект Supabase.");
      return;
    }
    saveCredentials(url, key);
    main();
  });
}

// ── Auth screen (sign in / sign up) ──────────────────────────────────────────
function renderAuth() {
  let mode = "login";

  function draw() {
    const isReg = mode === "register";
    appEl.innerHTML = `
      <main class="center">
        <div class="card-box">
          <div class="brand"><div class="logo">T</div><h1>Toduo</h1></div>
          <p class="lead">${isReg ? "Создайте аккаунт" : "Войдите, чтобы продолжить"}</p>
          <form id="auth-form">
            <label>Email
              <input id="a-email" type="email" autocomplete="username" required />
            </label>
            ${
              isReg
                ? `<label>Имя<input id="a-name" placeholder="Как показывать в чате" /></label>`
                : ""
            }
            <label>Пароль
              <input id="a-pass" type="password" autocomplete="${isReg ? "new-password" : "current-password"}" required />
            </label>
            <p class="err" id="a-err"></p>
            <button class="btn primary block" type="submit">${isReg ? "Зарегистрироваться" : "Войти"}</button>
          </form>
          <p class="switch">${isReg ? "Уже есть аккаунт?" : "Нет аккаунта?"}
            <a href="#" id="a-switch">${isReg ? "Войти" : "Создать"}</a></p>
          <p class="switch"><a href="#" id="a-reset">Сменить проект Supabase</a></p>
        </div>
      </main>`;

    appEl.querySelector("#a-switch").addEventListener("click", (e) => {
      e.preventDefault();
      mode = isReg ? "login" : "register";
      draw();
    });
    appEl.querySelector("#a-reset").addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Отвязать проект Supabase от этого браузера?")) {
        clearCredentials();
        location.reload();
      }
    });

    appEl.querySelector("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = appEl.querySelector("#a-err");
      err.textContent = "";
      const email = appEl.querySelector("#a-email").value.trim();
      const password = appEl.querySelector("#a-pass").value;
      const displayName = isReg ? appEl.querySelector("#a-name").value.trim() : "";
      try {
        if (isReg) {
          const res = await signUp({ email, password, displayName });
          if (!res.session) {
            err.style.color = "var(--muted)";
            err.textContent =
              "Аккаунт создан. Если включено подтверждение email — проверьте почту, иначе просто войдите.";
            mode = "login";
            return;
          }
        } else {
          await signIn({ email, password });
        }
      } catch (ex) {
        err.style.color = "";
        err.textContent = translateAuthError(ex.message);
      }
    });
  }
  draw();
}

function translateAuthError(msg = "") {
  if (/ISO-8859-1|non.*code point/i.test(msg))
    return "Ключ Supabase скопирован не полностью (есть символ «…»). Нажмите «Сменить проект Supabase» ниже и вставьте ключ заново кнопкой копирования.";
  if (/invalid api key/i.test(msg))
    return "Неверный или неполный ключ Supabase. Проверьте publishable/anon key.";
  if (/failed to fetch/i.test(msg))
    return "Не удаётся связаться с Supabase. Проверьте Project URL.";
  if (/invalid login credentials/i.test(msg)) return "Неверный email или пароль";
  if (/already registered/i.test(msg)) return "Этот email уже зарегистрирован";
  if (/password should be at least/i.test(msg)) return "Пароль слишком короткий (мин. 6 символов)";
  return msg || "Что-то пошло не так";
}

// ── App shell ────────────────────────────────────────────────────────────────
async function enterApp(user) {
  const profile = await getProfile(user);
  state.currentUser = profile;
  await refreshProfiles();

  appEl.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="side-brand"><div class="logo sm">T</div><span>Toduo</span></div>
        <nav class="side-nav">
          <button class="nav-item" data-tab="chat">💬 Чат</button>
          <button class="nav-item" data-tab="tasks">✓ Задачи</button>
        </nav>
        <div class="side-foot">
          <div class="me">
            <div class="avatar">${escapeHtml(initials(profile.displayName))}</div>
            <div class="me-name">${escapeHtml(profile.displayName)}</div>
          </div>
          <button class="logout" id="logout">Выйти</button>
        </div>
      </aside>
      <main class="panel" id="panel"></main>
    </div>`;

  appEl.querySelector("#logout").addEventListener("click", async () => {
    if (state.teardown) state.teardown();
    await signOut();
  });

  appEl.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  switchTab(state.tab);
}

function switchTab(tab) {
  state.tab = tab;
  if (state.teardown) {
    state.teardown();
    state.teardown = null;
  }
  appEl.querySelectorAll("[data-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab),
  );
  const panel = appEl.querySelector("#panel");
  const ctx = {
    sb: getSupabase(),
    currentUser: state.currentUser,
    nameFor: (id) => state.profiles.get(id),
    refreshProfiles,
  };
  state.teardown = tab === "chat" ? renderChat(panel, ctx) : renderTasks(panel, ctx);
}

async function refreshProfiles() {
  const sb = getSupabase();
  const { data } = await sb.from("profiles").select("id, display_name");
  state.profiles = new Map((data ?? []).map((p) => [p.id, p.display_name]));
  // Always know our own name.
  if (state.currentUser) {
    state.profiles.set(state.currentUser.id, state.currentUser.displayName);
  }
}
