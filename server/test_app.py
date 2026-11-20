import sqlite3
import tempfile
import unittest
from pathlib import Path

from server.app import create_app


class AuthApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        database_path = Path(cls.temp_dir.name) / "test.sqlite3"

        def connect_test_database():
            connection = sqlite3.connect(database_path, timeout=10)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            return connection

        cls.app = create_app(connect=connect_test_database)
        cls.app.config.update(TESTING=True)
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def test_registration_profile_persistence_login_and_logout(self):
        invalid = self.client.post(
            "/api/auth/register",
            json={"username": "ab", "password": "short"},
        )
        self.assertEqual(invalid.status_code, 400)

        registered = self.client.post(
            "/api/auth/register",
            json={"username": "New_User", "password": "long-password"},
        )
        self.assertEqual(registered.status_code, 201)
        self.assertEqual(registered.json["user"]["username"], "new_user")
        self.assertIsNone(registered.json["profile"])
        self.assertIn("HttpOnly", registered.headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", registered.headers["Set-Cookie"])

        profile = self.client.put(
            "/api/profile",
            json={
                "name": "Night User",
                "ig": "night.user",
                "venueName": "BERGHAIN BERLIN",
            },
        )
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.json["profile"]["venue"]["name"], "BERGHAIN BERLIN")

        duplicate = self.client.post(
            "/api/auth/register",
            json={"username": "new_user", "password": "another-password"},
        )
        self.assertEqual(duplicate.status_code, 409)

        logout = self.client.post("/api/auth/logout")
        self.assertEqual(logout.status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

        login = self.client.post(
            "/api/auth/login",
            json={"username": "NEW_USER", "password": "long-password"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json["profile"]["name"], "Night User")
        self.assertNotIn("password_hash", login.json["user"])

        wrong_password = self.client.post(
            "/api/auth/login",
            json={"username": "new_user", "password": "wrong-password"},
        )
        self.assertEqual(wrong_password.status_code, 401)

    def test_seeded_trial_account(self):
        result = self.client.post(
            "/api/auth/login",
            json={"username": "user", "password": "user123"},
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json["profile"]["name"], "USER")
        self.assertEqual(result.json["profile"]["venue"]["name"], "FABRIC LONDON")


if __name__ == "__main__":
    unittest.main()
