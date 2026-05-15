import pytest


class TestHealthEndpoints:
    def test_root_returns_welcome_message(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert "FriendSync" in response.json()["message"]

    def test_ping_returns_ok_status(self, client):
        response = client.get("/api/ping")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestUserRegistration:
    def test_register_new_user_returns_201(self, client):
        response = client.post("/api/users/register", data={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "password123"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert "id" in data

    def test_response_does_not_expose_password(self, client):
        response = client.post("/api/users/register", data={
            "email": "safe@example.com",
            "username": "safeuser",
            "password": "password123"
        })
        data = response.json()
        assert "password" not in data
        assert "password_hash" not in data

    def test_register_duplicate_email_returns_400(self, client):
        client.post("/api/users/register", data={
            "email": "dup@example.com",
            "username": "firstuser",
            "password": "password123"
        })
        response = client.post("/api/users/register", data={
            "email": "dup@example.com",
            "username": "seconduser",
            "password": "password123"
        })
        assert response.status_code == 400
        assert "Email" in response.json()["detail"]

    def test_register_duplicate_username_returns_400(self, client):
        client.post("/api/users/register", data={
            "email": "first@example.com",
            "username": "takenname",
            "password": "password123"
        })
        response = client.post("/api/users/register", data={
            "email": "second@example.com",
            "username": "takenname",
            "password": "password123"
        })
        assert response.status_code == 400
        assert "użytkownika" in response.json()["detail"]

    def test_register_missing_required_fields_returns_422(self, client):
        response = client.post("/api/users/register", data={
            "email": "incomplete@example.com"
            # brak username i password
        })
        assert response.status_code == 422


class TestUserLogin:
    def _register(self, client, email="user@example.com", username="testuser", password="pass12345"):
        client.post("/api/users/register", data={
            "email": email, "username": username, "password": password
        })

    def test_login_with_username_returns_token(self, client):
        self._register(client, "login@example.com", "loginuser", "mypassword123")
        response = client.post("/api/users/login", data={
            "username": "loginuser",
            "password": "mypassword123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_with_email_returns_token(self, client):
        self._register(client, "emaillogin@example.com", "emailuser", "mypassword123")
        response = client.post("/api/users/login", data={
            "username": "emaillogin@example.com",
            "password": "mypassword123"
        })
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_login_wrong_password_returns_401(self, client):
        self._register(client, "wrongpass@example.com", "wrongpassuser", "correctpass")
        response = client.post("/api/users/login", data={
            "username": "wrongpassuser",
            "password": "incorrectpass"
        })
        assert response.status_code == 401

    def test_login_nonexistent_user_returns_401(self, client):
        response = client.post("/api/users/login", data={
            "username": "ghost",
            "password": "anypassword"
        })
        assert response.status_code == 401

    def test_login_response_contains_bearer_type(self, client):
        self._register(client, "bearer@example.com", "beareruser", "pass12345")
        response = client.post("/api/users/login", data={
            "username": "beareruser",
            "password": "pass12345"
        })
        assert response.json()["token_type"] == "bearer"


class TestCurrentUser:
    def _get_token(self, client, email, username, password="pass12345"):
        client.post("/api/users/register", data={
            "email": email, "username": username, "password": password
        })
        resp = client.post("/api/users/login", data={
            "username": username, "password": password
        })
        return resp.json()["access_token"]

    def test_get_me_without_token_returns_401(self, client):
        response = client.get("/api/users/me")
        assert response.status_code == 401

    def test_get_me_with_valid_token_returns_user_data(self, client):
        token = self._get_token(client, "me@example.com", "meuser")
        response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "meuser"
        assert data["email"] == "me@example.com"

    def test_get_me_with_invalid_token_returns_401(self, client):
        response = client.get("/api/users/me", headers={"Authorization": "Bearer bad.token.here"})
        assert response.status_code == 401

    def test_get_me_with_malformed_auth_header_returns_401(self, client):
        response = client.get("/api/users/me", headers={"Authorization": "NotBearer abc"})
        assert response.status_code == 401

    def test_register_and_login_token_works_for_me(self, client):
        """Pełny flow: rejestracja → logowanie → /me."""
        token = self._get_token(client, "fullflow@example.com", "fullflowuser")
        resp = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["username"] == "fullflowuser"

    def test_global_finance_summary_requires_auth(self, client):
        response = client.get("/api/users/me/finances/summary")
        assert response.status_code == 401

    def test_global_finance_summary_returns_zeros_for_new_user(self, client):
        token = self._get_token(client, "finance@example.com", "financeuser")
        response = client.get(
            "/api/users/me/finances/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_to_pay"] == 0.0
        assert data["total_to_receive"] == 0.0
