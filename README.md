# FriendSync 
Aplikacja webowa do planowania spotkań i zarządzania wydatkami grupowymi.

## Jak zacząć pracę nad projektem (Setup środowiska)

### Wymagania wstępne:
1. Zainstalowany [Python 3.10+](https://www.python.org/downloads/)
2. Zainstalowany [Node.js](https://nodejs.org/) (zawiera npm)
3. Zainstalowany Git

### Krok 1: Pobranie repozytorium
Otwórz terminal i sklonuj projekt:
\`\`\`
git clone https://github.com/Kacperskiba/FriendSync.git 
cd FriendSync
\`\`\`

### Krok 2: Uruchomienie Backendu (FastAPI)
Otwórz nowy terminal, wejdź do folderu backendu i skonfiguruj środowisko:
\`\`\`
cd backend \t
python -m venv venv
\`\`\`
Aktywuj środowisko:
* **Windows:** `venv\Scripts\activate`
* **Mac/Linux:** `source venv/bin/activate`

Zainstaluj wymagane biblioteki:
\`\`\`
pip install -r requirements.txt
\`\`\`

### Krok 3: Uruchomienie Frontendu (React)
Otwórz drugi terminal (nie zamykając pierwszego), wejdź do folderu frontendu i zainstaluj paczki:
\`\`\`
cd frontend
npm install
\`\`\`
