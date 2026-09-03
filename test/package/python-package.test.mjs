import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createTemporaryDirectory } from "../helpers/fixtures.mjs";

const execFileAsync = promisify(execFile);

function pythonExecutable() {
  return process.env.PYTHON ?? "python";
}

async function runPython(args, options = {}) {
  return execFileAsync(pythonExecutable(), args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 120_000,
    windowsHide: true,
  });
}

test("python wheel builds and can be installed for import", async (t) => {
  const root = resolve(".");
  const temporaryDirectory = await createTemporaryDirectory(
    t,
    "zvec-grep-python-package-",
  );
  const wheelDirectory = join(temporaryDirectory, "wheel");
  const installDirectory = join(temporaryDirectory, "install");
  await mkdir(wheelDirectory, { recursive: true });
  await mkdir(installDirectory, { recursive: true });

  await runPython(["-m", "pip", "wheel", ".", "--no-deps", "-w", wheelDirectory], {
    cwd: root,
    timeout: 180_000,
  });

  const wheelFile = (await readdir(wheelDirectory)).find((entry) =>
    entry.endsWith(".whl"),
  );
  assert.ok(wheelFile, "expected a built wheel artifact");
  const wheelPath = join(wheelDirectory, wheelFile);

  await runPython(
    [
      "-m",
      "pip",
      "install",
      "--no-deps",
      "--target",
      installDirectory,
      wheelPath,
    ],
    { cwd: root, timeout: 180_000 },
  );

  const imported = await runPython([
    "-c",
    [
      "import sys",
      `sys.path.insert(0, r'''${installDirectory}''')`,
      "from zvec_grep import ZvecGrep, ZGResult, zvec_grep",
      "assert isinstance(zvec_grep, ZvecGrep)",
      "assert ZGResult.__name__ == 'ZGResult'",
    ].join("\n"),
  ]);
  assert.equal(imported.stderr, "");
});

test("python wrapper API builds command arguments and handles failures", async () => {
  const root = resolve(".");
  const script = [
    "from pathlib import Path",
    "import subprocess",
    "from unittest.mock import patch",
    "from zvec_grep import ZvecGrep",
    "",
    "client = ZvecGrep(cwd=Path('.'))",
    "",
    "with patch('shutil.which', return_value='/usr/bin/zg'):",
    "    assert client.is_available()",
    "with patch('shutil.which', return_value=None):",
    "    assert client.is_available() is False",
    "",
    "def fake_run(command, **kwargs):",
    "    assert kwargs['capture_output'] is True",
    "    assert kwargs['text'] is True",
    "    assert kwargs['check'] is False",
    "    return subprocess.CompletedProcess(command, 0, 'ok', '')",
    "",
    "with patch('subprocess.run', side_effect=fake_run):",
    "    result = client.index(root='workspace', embedding='local/potion', extra_args=['--mode', 'direct'])",
    "    assert result.args == ('zg', 'index', '--root', 'workspace', '--embedding', 'local/potion', '--mode', 'direct')",
    "",
    "def fail_run(command, **kwargs):",
    "    return subprocess.CompletedProcess(command, 2, '', 'bad')",
    "",
    "with patch('subprocess.run', side_effect=fail_run):",
    "    raised = False",
    "    try:",
    "        client.query('needle', root='workspace')",
    "    except RuntimeError as exc:",
    "        raised = True",
    "        assert 'exit code 2' in str(exc)",
    "    assert raised",
    "",
    "def pass_run(command, **kwargs):",
    "    return subprocess.CompletedProcess(command, 0, 'ready', '')",
    "",
    "with patch('subprocess.run', side_effect=pass_run):",
    "    status = client.status(root='workspace', check_ready=True)",
    "    assert status.args == ('zg', 'status', '--root', 'workspace', '--check-ready')",
  ].join("\n");

  const result = await runPython(["-c", script], { cwd: root });
  assert.equal(result.stderr, "");
});
