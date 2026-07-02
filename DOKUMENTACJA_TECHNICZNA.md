# Dokumentacja techniczna — FriendSync

> Aplikacja webowa do planowania spotkań ze znajomymi, głosowania nad lokalizacjami,
> komunikacji w czasie rzeczywistym oraz rozliczania wspólnych wydatków grupowych.

---

## Spis treści

1. [Opis projektu](#1-opis-projektu)
2. [Stos technologiczny](#2-stos-technologiczny)
3. [Architektura systemu](#3-architektura-systemu)
4. [Struktura repozytorium](#4-struktura-repozytorium)
5. [Model danych](#5-model-danych)
6. [Backend — warstwy i logika](#6-backend--warstwy-i-logika)
7. [API REST — wykaz endpointów](#7-api-rest--wykaz-endpointów)
8. [Komunikacja w czasie rzeczywistym (WebSocket)](#8-komunikacja-w-czasie-rzeczywistym-websocket)
9. [Moduł finansowy — algorytm rozliczeń](#9-moduł-finansowy--algorytm-rozliczeń)
10. [Bezpieczeństwo](#10-bezpieczeństwo)
11. [Frontend](#11-frontend)
12. [Testy](#12-testy)
13. [Wdrożenie (Docker / Caddy)](#13-wdrożenie-docker--caddy)
14. [Uruchomienie lokalne](#14-uruchomienie-lokalne)

---

## 1. Opis projektu

**FriendSync** to pełnostackowa aplikacja webowa wspierająca organizację wspólnych
wyjazdów i spotkań. Użytkownik może:

- zakładać konto i zarządzać profilem (avatar, bio, tagi),
- budować listę znajomych (zaproszenia, akceptacja, wyszukiwanie),
- tworzyć **wydarzenia** (eventy) i zapraszać do nich znajomych,
- planować szczegóły wyjazdu poprzez **podpunkty** (sub-events) z harmonogramem,
- **proponować lokalizacje** na mapie i **głosować** na nie,
- prowadzić **czat** wewnątrz wydarzenia,
- ewidencjonować **wspólne wydatki** i automatycznie rozliczać długi
  (z minimalizacją liczby przelewów),
- otrzymywać **powiadomienia** oraz widzieć **status online** znajomych w czasie rzeczywistym.

---

## 2. Stos technologiczny

### Backend
| Technologia | Zastosowanie |
|---|---|
| **Python 3.12** | język |
| **FastAPI** | framework webowy / REST API + WebSocket |
| **Uvicorn** | serwer ASGI |
| **SQLAlchemy** | ORM |
| **PostgreSQL 16** | baza danych produkcyjna |
| **Pydantic v2 / pydantic-settings** | walidacja danych i konfiguracja |
| **PyJWT** | tokeny JWT |
| **passlib + bcrypt** | hashowanie haseł |
| **python-multipart** | upload plików (avatary) |
| **requests** | integracja z Nominatim (geokodowanie) |

### Frontend
| Technologia | Zastosowanie |
|---|---|
| **React 19** | biblioteka UI |
| **Vite 8** | bundler / dev server |
| **React Router 7** | routing po stronie klienta |
| **Axios** | klient HTTP |
| **Tailwind CSS 4** | stylowanie |
| **Leaflet + react-leaflet** | mapy (OpenStreetMap) |
| **date-fns / react-datepicker** | obsługa dat |
| **lucide-react** | ikony |
| **Vitest + Testing Library** | testy jednostkowe |

### Infrastruktura
- **Docker / Docker Compose** — konteneryzacja
- **Caddy** — reverse proxy z automatycznym HTTPS
- **Nginx** — serwowanie statycznego frontendu w kontenerze

---

## 3. Architektura systemu

Aplikacja ma architekturę **klient–serwer** z wyraźnym rozdzieleniem na trójwarstwowy
backend (API → logika biznesowa → dane) oraz SPA po stronie klienta.

```
                       ┌──────────────────────────────────────────┐
                       │                 CADDY                      │
                       │   (reverse proxy, HTTPS, port 80/443)      │
                       └───────────────┬──────────────┬────────────┘
                                       │              │
                       :80 (HTTPS)     │              │  :8443
                  ┌────────────────────▼───┐   ┌──────▼───────────────────┐
                  │   FRONTEND (Nginx)      │   │   BACKEND (FastAPI)       │
                  │   React SPA (build)     │   │   REST API + WebSocket    │
                  └─────────────────────────┘   └──────────┬───────────────┘
                                                            │
                                                  ┌─────────▼──────────┐
                                                  │  PostgreSQL 16     │
                                                  └────────────────────┘
```

Komunikacja:
- **HTTP/REST** — operacje CRUD (Axios → FastAPI).
- **WebSocket** (`/ws`) — powiadomienia, status online, zdarzenia czasu rzeczywistego.
- **Nominatim (OpenStreetMap)** — zewnętrzne API do zamiany adresu na współrzędne.

---

## 4. Struktura repozytorium

```
FriendSync/
├── docker-compose.yml          # orkiestracja usług (db, backend, frontend, caddy)
├── Caddyfile                   # konfiguracja reverse proxy + HTTPS
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   └── app/
│       ├── main.py             # punkt wejścia, middleware, montaż routerów
│       ├── core/               # konfiguracja, baza, bezpieczeństwo, uploady
│       │   ├── config.py
│       │   ├── database.py
│       │   ├── security.py
│       │   └── uploads.py
│       ├── models/             # modele ORM (SQLAlchemy)
│       ├── schemas/            # schematy Pydantic (walidacja I/O)
│       ├── crud/               # logika dostępu do danych / operacje biznesowe
│       ├── api/                # routery (endpointy REST + WebSocket)
│       │   ├── dependencies.py # m.in. get_current_user
│       │   ├── user_routes.py
│       │   ├── event_routes.py
│       │   ├── friend_routes.py
│       │   ├── location_routes.py
│       │   ├── notification_routes.py
│       │   └── websocket.py
│       ├── services/           # integracje zewnętrzne (geocoding)
│       └── tests/              # testy pytest
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.js
    └── src/
        ├── App.jsx             # routing aplikacji
        ├── pages/              # widoki (AuthPage, Dashboard, EventDetails, ...)
        ├── components/         # komponenty współdzielone + Contexty
        └── services/           # klient API, autoryzacja, preferencje
```

---

## 5. Model danych

System opiera się na relacyjnym modelu danych. Poniżej najważniejsze encje
(katalog `backend/app/models/`).

### Diagram relacji (uproszczony)

```
User ──< Event (creator)
User ──< EventParticipant >── Event
User ──< Friendship >── User           (status: pending / accepted)
User ──< EventInvitation >── Event     (status: pending / accepted / declined)
Event ──< SubEvent >── LocationProposal (opcjonalnie)
Event ──< LocationProposal ──< LocationVote >── User
Event ──< Message >── User (author)
Event ──< Expense (payer=User) ──< ExpenseShare >── User
User ──< Notification
```

### Opis encji

| Encja | Tabela | Kluczowe pola |
|---|---|---|
| **User** | `users` | `username` (unikalne), `email` (unikalne), `password_hash`, `profile_image`, `bio`, `tags`, `last_active` |
| **Event** | `events` | `title`, `description`, `creator_id`, `event_date` |
| **EventParticipant** | `event_participants` | `event_id`, `user_id`, `role` (`admin`/`member`), `joined_at` |
| **EventInvitation** | `event_invitations` | `event_id`, `user_id` (zapraszany), `inviter_id`, `status` |
| **SubEvent** | `sub_events` | `event_id`, `title`, `start_time`, `location_id` (opcjonalne podpięcie punktu na mapie) |
| **LocationProposal** | `location_proposals` | `event_id`, `creator_id`, `name`, `latitude`, `longitude` |
| **LocationVote** | `location_votes` | `location_id`, `user_id`, `vote_value` |
| **Message** | `messages` | `event_id`, `author_id`, `content` |
| **Expense** | `expenses` | `event_id`, `payer_id`, `amount`, `description` |
| **ExpenseShare** | `expense_shares` | `expense_id`, `user_id`, `amount`, `is_settled`, `settled_at` |
| **Friendship** | `friendships` | `user_id`, `friend_id`, `status` |
| **Notification** | `notifications` | `user_id`, `type`, `message`, `is_read` |

**Kaskady i integralność:**
- usunięcie `Event` kaskadowo usuwa uczestników, wydatki, lokalizacje, wiadomości i podpunkty
  (`cascade="all, delete-orphan"`),
- usunięcie `LocationProposal` usuwa powiązane głosy,
- usunięcie `LocationProposal` powiązanej z `SubEvent` ustawia `location_id = NULL`
  (`ON DELETE SET NULL`) — podpunkt nie znika, traci tylko powiązanie z mapą.

**Migracje:** projekt nie używa Alembica. Drobne, idempotentne migracje (`ADD COLUMN IF NOT EXISTS`)
wykonywane są automatycznie przy starcie aplikacji w `main.py` → `_run_lightweight_migrations()`.
Schemat tabel tworzony jest przez `Base.metadata.create_all(bind=engine)`.

---

## 6. Backend — warstwy i logika

Backend stosuje rozdzielenie odpowiedzialności na cztery warstwy:

1. **`api/` (routery)** — definicja endpointów, walidacja wejścia, autoryzacja
   (zależność `get_current_user`), wywoływanie warstwy CRUD, serializacja odpowiedzi.
2. **`schemas/` (Pydantic)** — kontrakty danych wejściowych/wyjściowych, walidacja typów
   i ograniczeń (np. `amount > 0`).
3. **`crud/` (logika biznesowa)** — operacje na bazie, reguły domenowe (np. walidacja sum
   w wydatkach, algorytm rozliczeń).
4. **`models/` (ORM)** — mapowanie obiektowo-relacyjne SQLAlchemy.

Warstwy pomocnicze:
- **`core/config.py`** — konfiguracja przez zmienne środowiskowe (`pydantic-settings`),
  walidacja `SECRET_KEY`,
- **`core/database.py`** — silnik SQLAlchemy, fabryka sesji, zależność `get_db()`,
- **`core/security.py`** — hashowanie haseł, polityka haseł, generowanie tokenów JWT,
- **`core/uploads.py`** — bezpieczny zapis avatarów,
- **`services/geocoding.py`** — geokodowanie adresów przez Nominatim.

---

## 7. API REST — wykaz endpointów

Bazowy URL backendu: ścieżki z prefiksem `/api/...`. Większość endpointów wymaga nagłówka
`Authorization: Bearer <token>`.

### Użytkownicy — `/api/users`
| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/register` | rejestracja (multipart: email, username, password, opcjonalny avatar) |
| POST | `/login` | logowanie (OAuth2 password flow), zwraca token JWT |
| GET | `/me` | dane zalogowanego użytkownika |
| PATCH | `/me` | edycja profilu (zmiana emaila/hasła wymaga obecnego hasła) |
| GET | `/me/finances/summary` | globalne podsumowanie długów i należności |
| DELETE | `/me` | trwałe usunięcie konta wraz z danymi |
| GET | `/{user_id}/online-status` | status online użytkownika |

### Wydarzenia — `/api/events`
| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `` | utworzenie wydarzenia |
| GET | `` | lista wydarzeń użytkownika |
| GET | `/{id}/participants` | uczestnicy |
| POST | `/{id}/invite` | zaproszenie znajomego |
| GET | `/invitations` | otrzymane zaproszenia |
| POST | `/invitations/{id}/accept` / `/decline` | akceptacja/odrzucenie |
| POST/GET | `/{id}/messages` | czat (wysłanie / lista) |
| POST/GET | `/{id}/expenses` | wydatki (dodanie / lista) |
| POST | `/{id}/shares/{share_id}/settle` | spłata pojedynczego udziału |
| POST | `/{id}/creditors/{creditor_id}/settle-all` | zbiorcza spłata wobec wierzyciela |
| GET | `/{id}/finances/summary` | bilans i lista przelewów |
| POST/PUT/DELETE | `/{id}/sub-events`, `/sub-events/{id}` | zarządzanie podpunktami |
| PUT/DELETE | `/{id}` | edycja / usunięcie wydarzenia |
| DELETE | `/{id}/participants/{user_id}` | usunięcie uczestnika |
| PUT | `/{id}/transfer-ownership/{new_owner_id}` | przekazanie własności |

### Znajomi — `/api/friends`
| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/request` | wysłanie zaproszenia |
| POST | `/{id}/accept` | akceptacja |
| GET | `` | lista znajomych |
| GET | `/pending` | oczekujące zaproszenia |
| GET | `/search-users` | wyszukiwanie użytkowników |
| DELETE | `/{friend_id}` | usunięcie znajomego |

### Lokalizacje
| Metoda | Ścieżka | Opis |
|---|---|---|
| GET/POST | `/api/events/{id}/locations` | propozycje lokalizacji |
| DELETE | `/api/locations/{id}` | usunięcie propozycji |
| POST/DELETE | `/api/locations/{id}/votes` | głos / wycofanie głosu |

### Powiadomienia — `/api/notifications`
| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `` | lista powiadomień |
| PUT | `/{id}/read` | oznaczenie jako przeczytane |
| DELETE | `` | wyczyszczenie powiadomień |

> Pełna, interaktywna specyfikacja (OpenAPI/Swagger) dostępna jest automatycznie pod
> `/docs` dzięki FastAPI.

---

## 8. Komunikacja w czasie rzeczywistym (WebSocket)

Endpoint `/ws?token=<JWT>` (`api/websocket.py`) obsługuje połączenia czasu rzeczywistego.

- **Autoryzacja:** token JWT przekazywany w query stringu; brak/nieważny token → zamknięcie
  połączenia kodem `1008`.
- **`ConnectionManager`** utrzymuje mapę `user_id → [WebSocket]` (jeden użytkownik może mieć
  wiele kart/urządzeń).
- **Status online** jest wyznaczany *wyłącznie* na podstawie aktywnego połączenia WebSocket
  (`is_user_online`), a nie pola `last_active` — świadoma decyzja projektowa opisana
  w komentarzach (poprzednie podejście resetowało zegar przy każdym żądaniu).
- Przy połączeniu/rozłączeniu manager powiadamia znajomych o zmianie statusu
  (`notify_friends_status_change`).

**Typy komunikatów** rozsyłanych do klientów:
- `user_status` — zmiana statusu online znajomego,
- `profile_updated` — znajomy zaktualizował profil,
- `friend_removed` — znajomy usunął konto / znajomość,
- a także powiadomienia o zdarzeniach w wydarzeniach (`broadcast_to_event`).

---

## 9. Moduł finansowy — algorytm rozliczeń

Najbardziej złożona część logiki biznesowej (`crud/expense.py`).

### Model wydatku
Każdy wydatek (`Expense`) ma płatnika (`payer_id`) i listę udziałów (`ExpenseShare`) —
kto i ile jest winny. Walidacja przy tworzeniu wymaga m.in.:
- kwoty dodatniej,
- sumy udziałów równej kwocie wydatku (z tolerancją 1 grosza),
- braku duplikatów użytkowników w udziałach,
- przynależności płatnika i dłużników do wydarzenia.

Jeśli płatnik występuje też we własnych udziałach, jego udział jest od razu oznaczany
jako spłacony (`is_settled=True`) — nie płaci samemu sobie.

### Obliczanie bilansu
`_compute_event_balances` liczy saldo per użytkownik z **niespłaconych** udziałów:
płatnik dostaje `+amount`, dłużnik `−amount`. Wpisy audytowe spłat (rozpoznawane po prefiksie
opisu `"Rozliczenie"`) są pomijane, by nie zaburzać salda.

### Minimalizacja liczby przelewów (greedy min-cash-flow)
`calculate_finance_summary` zamienia bilans na **minimalną liczbę przelewów**:
1. dzieli użytkowników na dłużników (saldo ujemne) i wierzycieli (saldo dodatnie),
2. sortuje obie listy malejąco po kwocie,
3. dopasowuje największego dłużnika do największego wierzyciela, generując przelew na
   `min(dług, należność)`, i powtarza aż do wyrównania.

Dzięki temu zamiast „każdy z każdym” powstaje krótka lista konkretnych przelewów.

### Spłaty
- **`settle_share`** — oznacza pojedynczy udział jako spłacony i tworzy **wpis audytowy**
  (oddzielny `Expense` z prefiksem `"Rozliczenie"`) jako ślad w historii.
- **`settle_all_with_creditor`** — zbiorczo zamyka wszystkie otwarte długi użytkownika wobec
  jednego wierzyciela.
- **`calculate_global_finance_summary`** — agreguje długi/należności użytkownika ze wszystkich
  wydarzeń (widok globalny na Dashboardzie).

> Operacje na pieniądzach używają stałej tolerancji `CENT = 0.01` z uwagi na niedokładność
> arytmetyki zmiennoprzecinkowej.

---

## 10. Bezpieczeństwo

Projekt kładzie wyraźny nacisk na bezpieczeństwo:

**Uwierzytelnianie i hasła**
- hasła hashowane **bcrypt** (`passlib`),
- polityka haseł: 10–128 znaków, min. 3 z 4 klas znaków, blokada haseł pospolitych
  (`validate_password_strength`),
- **JWT** (HS256) z polami `exp`, `iat`, `jti`, `type` — krótki czas życia (60 min),
- **ochrona przed user enumeration**: przy logowaniu nieistniejącego konta i tak wykonywany
  jest pełny koszt bcrypt (`dummy_verify`) — wyrównanie czasu odpowiedzi (timing attack),
- zmiana emaila/hasła wymaga potwierdzenia obecnym hasłem (re-auth).

**Konfiguracja**
- w trybie `production` aplikacja **nie wystartuje** bez silnego `SECRET_KEY` (≥ 32 znaki);
  w `development` generowany jest losowy klucz efemeryczny.

**Nagłówki bezpieczeństwa** (`SecurityHeadersMiddleware`)
- `X-Content-Type-Options: nosniff`,
- `X-Frame-Options: DENY`,
- `Referrer-Policy: strict-origin-when-cross-origin`,
- `Permissions-Policy` (ograniczenie geolokalizacji/kamery/mikrofonu),
- `Strict-Transport-Security` (HSTS) — tylko w produkcji.

**CORS** — restrykcyjna allowlista origin (`ALLOWED_ORIGINS`), ograniczone metody i nagłówki.

**Upload plików** — walidacja rozmiaru avatara (limit 5 MB, `MAX_AVATAR_SIZE`).

---

## 11. Frontend

SPA w React 19 z routingiem klienckim (`App.jsx`):

| Ścieżka | Widok | Rola |
|---|---|---|
| `/` | `AuthPage` | logowanie / rejestracja |
| `/dashboard` | `Dashboard` | lista wydarzeń, znajomi, mapa globalna, finanse |
| `/events/:id` | `EventDetails` | szczegóły wydarzenia, czat, mapa, podpunkty |
| `/events/:id/finance` | `EventFinance` | wydatki i rozliczenia |
| `/edit-profile` | `EditProfilePage` | edycja profilu |
| `/settings` | `SettingsPage` | ustawienia (waluta, wygląd) |

**Zarządzanie stanem globalnym** — React Context:
- `WebSocketContext` — pojedyncze, współdzielone połączenie WebSocket,
- `CurrencyContext` — wybrana waluta,
- `DialogContext` — globalne okna dialogowe / potwierdzenia.

**Warstwa usług** (`src/services/`):
- `api.js` — skonfigurowany klient Axios (bazowy URL, dołączanie tokenu),
- `authService.js` — logowanie/wylogowanie, obsługa tokenu,
- `preferences.js` — preferencje wyglądu zapisywane lokalnie.

**Mapy** — Leaflet + react-leaflet (`EventMapComponent`, `GlobalDashboardMap`) na danych
OpenStreetMap; współrzędne propozycji uzyskiwane z geokodowania po stronie backendu.

---

## 12. Testy

### Backend (pytest, katalog `backend/tests/`)
- `conftest.py` — fixtury, izolowana baza testowa,
- `test_api.py` — testy integracyjne endpointów,
- `test_finance.py` — testy algorytmu rozliczeń (bilans, minimalizacja przelewów, spłaty),
- `test_schemas.py` — walidacja schematów Pydantic,
- `test_security.py` — hashowanie haseł, polityka haseł, JWT.

Uruchomienie:
```bash
cd backend
pytest
```

### Frontend (Vitest + Testing Library)
- `authService.test.js`, `preferences.test.js` — testy logiki usług.

Uruchomienie:
```bash
cd frontend
npm run test
```

---

## 13. Wdrożenie (Docker / Caddy)

`docker-compose.yml` definiuje cztery usługi:

| Usługa | Obraz / źródło | Rola |
|---|---|---|
| `db` | `postgres:16` | baza danych (wolumen trwały `postgres_data`) |
| `backend` | build `./backend` | FastAPI + Uvicorn (port 8000) |
| `frontend` | build `./frontend` | React zbudowany i serwowany przez Nginx |
| `caddy` | `caddy:alpine` | reverse proxy + automatyczny HTTPS (porty 80/443/8443) |

**Caddy** (`Caddyfile`) kieruje:
- `friendsync.me` → frontend (Nginx),
- `friendsync.me:8443` → backend (API + WebSocket),
- automatycznie zarządza certyfikatami TLS.

**Backend Dockerfile** — `python:3.12-slim`, instalacja zależności systemowych
(`gcc`, `libpq-dev`) i pythonowych, utworzenie katalogu `static/avatars`.

**Frontend Dockerfile** — wieloetapowy build: `node:22-alpine` buduje aplikację Vite,
następnie artefakty kopiowane są do obrazu `nginx:alpine`.

**Zmienne środowiskowe** (przez `.env`): `DB_PASSWORD`, `SECRET_KEY`, `ALLOWED_ORIGINS`,
`VITE_API_URL`, `DATABASE_URL`.

Uruchomienie całości:
```bash
docker compose up --build
```

---

## 14. Uruchomienie lokalne

### Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```
API dostępne pod `http://localhost:8000`, dokumentacja Swagger pod `http://localhost:8000/docs`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Aplikacja dostępna pod `http://localhost:5173`.

> W trybie deweloperskim, jeśli `SECRET_KEY` nie jest ustawiony, backend generuje losowy klucz
> przy każdym starcie — wymaga to ponownego logowania po restarcie serwera.

---

*Dokument wygenerowany na podstawie analizy kodu źródłowego projektu FriendSync.*
