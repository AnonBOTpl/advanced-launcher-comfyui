# Advanced Launcher for ComfyUI

**Advanced Launcher for ComfyUI** to aplikacja desktopowa (Electron), która ułatwia uruchamianie i zarządzanie ComfyUI.  
Projekt pozwala szybko startować, konfigurować oraz kontrolować środowisko pracy z ComfyUI.

## Funkcje
- Prosty interfejs do uruchamiania ComfyUI
- Konfiguracja parametrów startowych
- Integracja z lokalnym środowiskiem
- Łatwa instalacja i uruchamianie

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
