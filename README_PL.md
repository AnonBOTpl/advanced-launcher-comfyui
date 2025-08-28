# Advanced Launcher for ComfyUI

**Advanced Launcher for ComfyUI** to aplikacja desktopowa (Electron), która ułatwia konfigurację i uruchamianie środowiska ComfyUI. 
Projekt pozwala szybko startować, konfigurować oraz kontrolować środowisko pracy z ComfyUI.

## Funkcje
- **Konfiguracja**:
  - zapisywanie i wczytywanie ustawień,
  - wybór oraz walidacja ścieżki do ComfyUI.
- **Uruchamianie ComfyUI**:
  - start i stop procesu ComfyUI,
  - instalacja zależności,
  - monitorowanie, czy proces działa.
- **Monitorowanie procesów**:
  - podgląd logów na żywo z ComfyUI,
  - informacje o uruchomieniu i zakończeniu procesu.
- **Interfejs użytkownika**:
  - proste GUI do zarządzania konfiguracją,
  - przyciski do uruchamiania, zatrzymywania i instalowania zależności,
  - wyświetlanie logów oraz komunikatów błędów/informacji.
- **Wbudowana Przeglądarka!
  - Automatyczne otwieranie przeglądarki przy starcie
  - Personalizacja rozmiaru okna (szerokość i wysokość).
  - Zapamiętywanie ostatniej pozycji okna.
  - Opcja "Zawsze na wierzchu".
  - Ręczne przyciski do otwierania i zamykania przeglądarki.


## Instalacja
1. Sklonuj repozytorium:
   ```bash
   git clone https://github.com/twoja-nazwa/advanced-launcher-comfyui.git
   cd advanced-launcher-comfyui
   ```
2. Zainstaluj zależności:
   ```bash
   npm install
   ```
3. Uruchom aplikację:
   ```bash
   npm start
   ```

## Struktura projektu
```
index.html   - interfejs aplikacji
main.js      - główny proces Electron
preload.js   - skrypt preload dla renderera
package.json - konfiguracja projektu i zależności
```

## Budowanie aplikacji
Aby zbudować aplikację na system docelowy:
```bash
npm run build
```

## Licencja
MIT License
