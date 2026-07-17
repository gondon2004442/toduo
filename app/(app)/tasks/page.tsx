export default function TasksPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Задачи</h2>
        <p className="text-xs text-muted">Доска задач команды</p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sidebar text-2xl">
            🚧
          </div>
          <h3 className="mb-2 text-lg font-semibold text-ink">
            Модуль задач — скоро
          </h3>
          <p className="text-sm text-muted">
            Здесь появятся задачи с этапами: ТЗ → процесс работы → результат.
            Можно будет прикреплять файлы (ТЗ, шрифты, доки) и ссылки на
            результат. Пока пользуйтесь чатом 💬
          </p>
        </div>
      </div>
    </div>
  );
}
