import os
import pathlib

# Musi być przed importami z `app` – nadpisuje URL z PostgreSQL na SQLite
os.environ["DATABASE_URL"] = "sqlite:///./test_friendsync.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"

# StaticFiles w main.py wymaga istnienia katalogu static
pathlib.Path("static/avatars").mkdir(parents=True, exist_ok=True)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite:///./test_friendsync.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        os.remove("test_friendsync.db")
    except (FileNotFoundError, PermissionError):
        pass


@pytest.fixture
def db(create_test_tables):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
    # Czyścimy wszystkie tabele po każdym teście
    with engine.connect() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        conn.commit()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
