import hashlib
import os
import re
import secrets
try:
    import sqlite3
except ImportError:  # Wasmer's Python has no sqlite3; stand-ins keep isinstance/except checks valid
    import types

    class _NoSqlite(Exception):
        pass

    sqlite3 = types.SimpleNamespace(
        Connection=_NoSqlite, Row=_NoSqlite, IntegrityError=_NoSqlite
    )
import ssl
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

import pg8000.dbapi
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

SESSION_COOKIE = "nightpulse_session"
SESSION_SECONDS = 14 * 24 * 60 * 60
BUILD_DIR = Path(__file__).resolve().parents[1] / "build"
USERNAME_PATTERN = re.compile(r"^[a-z0-9._-]{3,24}$")
INSTAGRAM_PATTERN = re.compile(r"^[a-z0-9._]{1,30}$", re.IGNORECASE)


def connect_database():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        parsed = urlparse(database_url)
        config = {
            "host": parsed.hostname,
            "port": parsed.port or 5432,
            "database": unquote(parsed.path.lstrip("/")),
            "user": unquote(parsed.username or ""),
            "password": unquote(parsed.password or ""),
        }
    elif any(os.environ.get(key) for key in ("DB_HOST", "DB_NAME", "DB_USERNAME", "DB_PASSWORD")):
        required = ("DB_HOST", "DB_NAME", "DB_USERNAME", "DB_PASSWORD")
        missing = [key for key in required if not os.environ.get(key)]
        if missing:
            raise RuntimeError(
                "Database configuration missing. Set DATABASE_URL or Wasmer DB_* variables."
            )
        config = {
            "host": os.environ["DB_HOST"],
            "port": int(os.environ.get("DB_PORT", "5432")),
            "database": os.environ["DB_NAME"],
            "user": os.environ["DB_USERNAME"],
            "password": os.environ["DB_PASSWORD"],
        }
    elif os.environ.get("NODE_ENV") != "production":
        data_dir = Path(__file__).resolve().parents[1] / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(data_dir / "nightpulse.sqlite3", timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection
    else:
        raise RuntimeError(
            "Database configuration missing. Set DATABASE_URL or Wasmer DB_* variables."
        )

    if os.environ.get("NODE_ENV") == "production":
        config["ssl_context"] = ssl._create_unverified_context()
    return pg8000.dbapi.connect(**config)


@contextmanager
def database_connection(connect):
    connection = connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database(connect):
    with database_connection(connect) as connection:
        cursor = connection.cursor()
        sqlite = isinstance(connection, sqlite3.Connection)
        id_type = "INTEGER PRIMARY KEY AUTOINCREMENT" if sqlite else "BIGSERIAL PRIMARY KEY"
        timestamp_type = "TEXT" if sqlite else "TIMESTAMPTZ"
        statements = [
            f"""
            CREATE TABLE IF NOT EXISTS users (
                id {id_type},
                username VARCHAR(24) NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at {timestamp_type} NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS profiles (
                user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                display_name VARCHAR(40) NOT NULL,
                instagram_handle VARCHAR(30) NOT NULL,
                venue_name VARCHAR(80) NOT NULL
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash CHAR(64) PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at {timestamp_type} NOT NULL
            )
            """,
            "CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)",
        ]
        for statement in statements:
            execute(cursor, statement)

        execute(cursor, "SELECT id FROM users WHERE username = %s", ("user",))
        demo_user = cursor.fetchone()
        if demo_user is None:
            execute(
                cursor,
                """
                INSERT INTO users (username, password_hash)
                VALUES (%s, %s)
                ON CONFLICT (username) DO NOTHING
                RETURNING id
                """,
                ("user", generate_password_hash("user123")),
            )
            demo_user = cursor.fetchone()
            if demo_user is None:
                execute(cursor, "SELECT id FROM users WHERE username = %s", ("user",))
                demo_user = cursor.fetchone()

        execute(
            cursor,
            """
            INSERT INTO profiles (user_id, display_name, instagram_handle, venue_name)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id) DO NOTHING
            """,
            (demo_user[0], "USER", "user", "FABRIC LONDON"),
        )
        execute(cursor, "DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP")
        cursor.close()


def execute(cursor, statement, params=()):
    if isinstance(cursor.connection, sqlite3.Connection):
        statement = statement.replace("%s", "?")
    return cursor.execute(statement, params)


def row_as_dict(cursor, row):
    if row is None:
        return None
    if isinstance(row, sqlite3.Row):
        return dict(row)
    return {column[0]: value for column, value in zip(cursor.description, row)}


def public_user(row):
    return {"id": row["id"], "username": row["username"]}


def public_profile(row):
    if not row or not row.get("display_name"):
        return None
    return {
        "name": row["display_name"],
        "ig": row["instagram_handle"],
        "venue": {"name": row["venue_name"]},
    }


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_app(connect=connect_database):
    app = Flask(__name__)
    app.config["DB_CONNECT"] = connect
    app.config["DB_READY"] = False
    app.config["DB_LOCK"] = threading.Lock()
    production = os.environ.get("NODE_ENV") == "production"

    @app.before_request
    def prepare_database():
        if app.config["DB_READY"]:
            return
        with app.config["DB_LOCK"]:
            if not app.config["DB_READY"]:
                initialize_database(app.config["DB_CONNECT"])
                app.config["DB_READY"] = True

    def session_user():
        token = request.cookies.get(SESSION_COOKIE)
        if not token:
            return None
        with database_connection(app.config["DB_CONNECT"]) as connection:
            cursor = connection.cursor()
            execute(
                cursor,
                """
                SELECT users.id, users.username, profiles.display_name,
                       profiles.instagram_handle, profiles.venue_name
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                LEFT JOIN profiles ON profiles.user_id = users.id
                WHERE sessions.token_hash = %s
                  AND sessions.expires_at > CURRENT_TIMESTAMP
                """,
                (token_hash(token),),
            )
            row = row_as_dict(cursor, cursor.fetchone())
            cursor.close()
        return row

    def issue_session(connection, user_id):
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
        stored_expires_at = expires_at
        if isinstance(connection, sqlite3.Connection):
            stored_expires_at = expires_at.strftime("%Y-%m-%d %H:%M:%S")
        cursor = connection.cursor()
        execute(
            cursor,
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (token_hash(token), user_id, stored_expires_at),
        )
        cursor.close()
        return token, expires_at

    def session_response(payload, token, expires_at, status=200):
        response = jsonify(payload)
        response.status_code = status
        response.set_cookie(
            SESSION_COOKIE,
            token,
            httponly=True,
            secure=production,
            samesite="Lax",
            path="/",
            expires=expires_at,
        )
        return response

    @app.get("/api/healthz")
    def health():
        with database_connection(app.config["DB_CONNECT"]) as connection:
            cursor = connection.cursor()
            execute(cursor, "SELECT 1")
            cursor.close()
        return jsonify({"status": "ok"})

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Enter a valid username and password."}), 400
        username = data.get("username", "")
        password = data.get("password", "")
        username = username.strip().lower() if isinstance(username, str) else ""
        password = password if isinstance(password, str) else ""

        if not USERNAME_PATTERN.fullmatch(username):
            return jsonify({
                "error": "Username must be 3–24 characters (letters, numbers, ., _ or -)."
            }), 400
        if not 8 <= len(password) <= 128:
            return jsonify({"error": "Password must be 8–128 characters."}), 400

        try:
            with database_connection(app.config["DB_CONNECT"]) as connection:
                cursor = connection.cursor()
                execute(
                    cursor,
                    """
                    INSERT INTO users (username, password_hash)
                    VALUES (%s, %s)
                    RETURNING id, username
                    """,
                    (username, generate_password_hash(password)),
                )
                user = row_as_dict(cursor, cursor.fetchone())
                token, expires_at = issue_session(connection, user["id"])
                cursor.close()
        except (pg8000.exceptions.DatabaseError, sqlite3.IntegrityError) as error:
            details = error.args[0] if error.args else {}
            if (
                isinstance(details, dict) and details.get("C") == "23505"
            ) or (
                isinstance(error, sqlite3.IntegrityError)
                and "UNIQUE constraint failed" in str(error)
            ):
                return jsonify({"error": "That username is already registered."}), 409
            raise
        return session_response(
            {"user": public_user(user), "profile": None},
            token,
            expires_at,
            201,
        )

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Enter a valid username and password."}), 400
        username = data.get("username", "")
        password = data.get("password", "")
        username = username.strip().lower() if isinstance(username, str) else ""
        password = password if isinstance(password, str) else ""
        if not USERNAME_PATTERN.fullmatch(username) or len(password) > 128:
            return jsonify({"error": "Enter a valid username and password."}), 400

        with database_connection(app.config["DB_CONNECT"]) as connection:
            cursor = connection.cursor()
            execute(
                cursor,
                """
                SELECT users.id, users.username, users.password_hash,
                       profiles.display_name, profiles.instagram_handle, profiles.venue_name
                FROM users LEFT JOIN profiles ON profiles.user_id = users.id
                WHERE users.username = %s
                """,
                (username,),
            )
            row = row_as_dict(cursor, cursor.fetchone())
            if not row or not check_password_hash(row["password_hash"], password):
                cursor.close()
                return jsonify({"error": "Incorrect username or password."}), 401
            token, expires_at = issue_session(connection, row["id"])
            cursor.close()

        return session_response(
            {"user": public_user(row), "profile": public_profile(row)},
            token,
            expires_at,
        )

    @app.post("/api/auth/logout")
    def logout():
        token = request.cookies.get(SESSION_COOKIE)
        if token:
            with database_connection(app.config["DB_CONNECT"]) as connection:
                cursor = connection.cursor()
                execute(
                    cursor,
                    "DELETE FROM sessions WHERE token_hash = %s",
                    (token_hash(token),),
                )
                cursor.close()
        response = jsonify({})
        response.status_code = 204
        response.set_cookie(
            SESSION_COOKIE,
            "",
            expires=0,
            httponly=True,
            secure=production,
            samesite="Lax",
            path="/",
        )
        return response

    @app.get("/api/auth/me")
    def current_user():
        row = session_user()
        if not row:
            return jsonify({"error": "Please sign in to continue."}), 401
        return jsonify({"user": public_user(row), "profile": public_profile(row)})

    @app.put("/api/profile")
    def update_profile():
        row = session_user()
        if not row:
            return jsonify({"error": "Please sign in to continue."}), 401

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Enter valid profile details."}), 400
        name = data.get("name", "")
        ig = data.get("ig", "")
        venue_name = data.get("venueName", "")
        name = name.strip() if isinstance(name, str) else ""
        ig = ig.strip().removeprefix("@") if isinstance(ig, str) else ""
        venue_name = venue_name.strip() if isinstance(venue_name, str) else ""
        if not 1 <= len(name) <= 40:
            return jsonify({"error": "Display name must be 1–40 characters."}), 400
        if not INSTAGRAM_PATTERN.fullmatch(ig):
            return jsonify({"error": "Enter a valid Instagram handle."}), 400
        if not 1 <= len(venue_name) <= 80:
            return jsonify({"error": "Choose a valid venue."}), 400

        with database_connection(app.config["DB_CONNECT"]) as connection:
            cursor = connection.cursor()
            execute(
                cursor,
                """
                INSERT INTO profiles (user_id, display_name, instagram_handle, venue_name)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    instagram_handle = EXCLUDED.instagram_handle,
                    venue_name = EXCLUDED.venue_name
                RETURNING display_name, instagram_handle, venue_name
                """,
                (row["id"], name, ig, venue_name),
            )
            profile = public_profile(row_as_dict(cursor, cursor.fetchone()))
            cursor.close()
        return jsonify({"profile": profile})

    @app.route("/api/<path:unused>", methods=["GET", "POST", "PUT", "DELETE"])
    @app.route("/api", methods=["GET", "POST", "PUT", "DELETE"])
    def api_not_found(unused=None):
        return jsonify({"error": "API route not found."}), 404

    @app.get("/")
    def index():
        return send_from_directory(BUILD_DIR, "index.html")

    @app.get("/<path:asset>")
    def frontend_asset(asset):
        asset_path = BUILD_DIR / asset
        if asset_path.is_file():
            return send_from_directory(BUILD_DIR, asset)
        return send_from_directory(BUILD_DIR, "index.html")

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": error.description}), error.code
        return error

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("Request failed", exc_info=error)
        return jsonify({"error": "Something went wrong. Please try again."}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "3001")),
        threaded=True,
    )
