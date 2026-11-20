# Night Pulse

Night Pulse is a React demo with a Flask API and a small SQLite database for local use. Accounts and profiles are saved; venue activity, matches, messages, and payments remain simulated.

## Run it

After installing the project dependencies with `npm install`, start everything with:

```sh
npm start
```

This starts the API and React app together. The first run automatically creates a Python environment, installs the small API dependencies, and creates `data/nightpulse.sqlite3`. No Docker or manual database setup is needed. Open [http://localhost:3000](http://localhost:3000).

## Trial login

- Username: `user`
- Password: `user123`

## Wasmer Edge

Wasmer's [app.yaml](./app.yaml) and [wasmer.toml](./wasmer.toml) configure its Python runtime and managed PostgreSQL database. Before deploying, replace `replace-with-your-wasmer-username` in both files and change the app name if it is already taken. Build the React assets and install the Python packages into the mapped environment:

```sh
npm run build
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Then run `wasmer deploy` from this directory. Wasmer supplies the `DB_*` connection variables; the local SQLite database is not used in production.

## Tests

After `npm start` has set up the Python environment:

```sh
npm test
npm run test:api
npm run build
```
