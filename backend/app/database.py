import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kyc.db")

# Railway Postgres URLs use postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    if _is_sqlite:
        _auto_migrate()


def _auto_migrate():
    """Add columns that may be missing on older SQLite databases."""
    migrations = [
        ("applications", "evidence_annotations", "TEXT"),
        ("applications", "regulatory_flags", "TEXT"),
        ("applications", "regulatory_priority", "VARCHAR(20)"),
        ("applications", "email", "VARCHAR(200)"),
        ("applications", "voice_sample_path", "TEXT"),
        ("applications", "voice_verification", "TEXT"),
        ("applications", "facial_match", "TEXT"),
    ]
    with engine.connect() as conn:
        for table, column, col_type in migrations:
            try:
                conn.execute(text(f"SELECT {column} FROM {table} LIMIT 1"))
            except Exception:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()

        conn.execute(text(
            "UPDATE applications "
            "SET email = LOWER(first_name || '.' || last_name || '@example.com') "
            "WHERE email IS NULL"
        ))
        conn.commit()
