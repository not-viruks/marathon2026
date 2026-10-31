---
name: review-code
description: Автоматичний аналіз останніх змін (git diff), перевірка коду за чеклистом безпеки, архітектури та тестів для restaurant-backend-app.
---
Коли активується цей скіл:
1. Переглянь останні змінені або створені файли:
   ```bash
   git status --short
   git diff
   ```
2. Проаналізуй код за чеклистом:
   - Архітектура (Handler -> Service -> Repository -> RouteRegistry)
   - Безпека та авторизація (перевірка Owner, валідація вхідних даних)
   - Робота з DynamoDB (використання ResourceNames/GSI, відсутність Scan)
   - Обробка помилок (HTTP 400, 401, 403, 404)
   - Покриття юніт-тестами (xUnit, Moq)
3. Запусти перевірку компіляції та тестів:
   ```bash
   cd backend/restaurant-backend-app && dotnet test Tests/APIHandler.Tests.csproj
   ```
4. Сформуй структурований звіт з вердиктом (`APPROVED` або `CHANGES REQUESTED`) та готовими виправленнями.

