const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const windows = process.platform === "win32";
const python = path.join(root, ".venv", windows ? "Scripts/python.exe" : "bin/python");
const children = [];
let stopping = false;

function start(command, args, env = process.env) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(`Could not start ${command}: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  process.exitCode = code;
}

start(python, [
  "-m", "flask", "--app", "server.app", "run",
  "--host", "127.0.0.1", "--port", "3001", "--no-reload",
]);
start(process.execPath, [
  path.join(root, "node_modules/react-scripts/scripts/start.js"),
]);

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
