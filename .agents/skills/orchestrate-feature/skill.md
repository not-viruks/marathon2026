---
name: orchestrate-feature
description: Повний цикл реалізації фічі бекенду: створення плану IMPLEMENTATION_PLAN.md, написання лямбди (lambda-developer), написання юніт-тестів (unit-test-writer) та код-рев'ю (code-reviewer).
---
Коли активується цей скіл для реалізації вимоги або завдання:

1. **Створення плану**:
   Створи файл `IMPLEMENTATION_PLAN.md` з описом контракту ендпоінту та чеклистом по всіх 3 етапах (Код, Тести, Рев'ю).

2. **Етап 1: Реалізація коду (`lambda-developer`)**:
   - Створи DTO запиту та відповіді.
   - Оголоси та реалізуй бізнес-логіку у відповідному `Services/` та `Repositories/`.
   - Реалізуй `IApiRequestHandler` у `Handlers/`.
   - Зареєструй DI та новий маршрут у `Routing/RouteRegistry.cs`.
   - Перевір збірку: `cd backend/restaurant-backend-app && dotnet build`.
   - Онови чеклист у `IMPLEMENTATION_PLAN.md`.

3. **Етап 2: Юніт-тести (`unit-test-writer`)**:
   - Створи або онови тестові класи в `backend/restaurant-backend-app/Tests/`.
   - Покрий успішні сценарії (Happy Path) та сценарії помилок (404 NotFound, 403 Forbidden, 400 Validation).
   - Запусти тести: `cd backend/restaurant-backend-app && dotnet test Tests/APIHandler.Tests.csproj`.
   - Онови чеклист у `IMPLEMENTATION_PLAN.md`.

4. **Етап 3: Код-рев'ю (`code-reviewer`)**:
   - Проаналізуй `git diff` за чеклистом безпеки (Owner Auth), архітектури та DynamoDB стандартів.
   - За потреби внеси виправлення за зауваженнями рев'юера.
   - Онови чеклист у `IMPLEMENTATION_PLAN.md` до статусу `Approved`.

5. **Фінал**:
   Надай користувачу звіт із результатами проходження тестів та посиланням на `IMPLEMENTATION_PLAN.md`.

