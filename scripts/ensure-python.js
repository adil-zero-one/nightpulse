const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const windows = process.platform === "win32";
const venvPython = path.join(root, ".venv", windows ? "Scripts/python.exe" : "bin/python");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!fs.existsSync(venvPython)) {
  console.log("Setting up the local API environment...");
  run(process.env.PYTHON || (windows ? "py" : "python3"), [
    ...(windows ? ["-3.12"] : []),
    "-m",
    "venv",
    ".venv",
  ]);
}

const dependencies = spawnSync(venvPython, ["-c", "import flask, pg8000"], {
  cwd: root,
  stdio: "ignore",
});
if (dependencies.status !== 0) {
  console.log("Installing the local API dependencies...");
  run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"]);
}
