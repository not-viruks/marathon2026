---
name: write-unit-tests
description: Автоматичне написання та запуск юніт-тестів xUnit / Moq для сервісів та хендлерів у restaurant-backend-app.
---
Коли активується цей скіл:
1. Визнач сервіс або клас, для якого потрібно написати тести.
2. Проаналізуй залежності класу (інтерфейси репозиторіїв та інших сервісів).
3. Створи або доповни відповідний тестовий файл у `backend/restaurant-backend-app/Tests/Services/`.
4. Використовуй:
   - `xUnit` (`[Fact]`, `[Theory]`)
   - `AutoFixture.Xunit2` (`[AutoData]`, `[InlineAutoData]`)
   - `Moq` для мокінгу репозиторіїв
5. Покрий обов'язково:
   - Успішне виконання (Happy path)
   - Винятки при відсутності сутності (NotFound)
   - Перевірку прав доступу (Forbidden)
   - Валідацію вхідних даних (Validation)
6. Запусти тести командою:
   ```bash
   cd backend/restaurant-backend-app && dotnet test Tests/APIHandler.Tests.csproj
   ```
7. Сформуй звіт про результати виконання тестів.

