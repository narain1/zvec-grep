from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
import subprocess
from typing import Iterable


@dataclass(frozen=True)
class ZGResult:
    """Subprocess result for a `zg` command."""

    args: tuple[str, ...]
    returncode: int
    stdout: str
    stderr: str


class ZvecGrep:
    """Small Python wrapper around the `zg` CLI."""

    def __init__(self, executable: str = "zg", cwd: str | Path | None = None) -> None:
        self.executable = executable
        self.cwd = Path(cwd).resolve() if cwd is not None else None

    def is_available(self) -> bool:
        return shutil.which(self.executable) is not None

    def run(
        self,
        *args: str,
        check: bool = True,
        cwd: str | Path | None = None,
    ) -> ZGResult:
        command = [self.executable, *args]
        effective_cwd = Path(cwd).resolve() if cwd is not None else self.cwd
        completed = subprocess.run(
            command,
            cwd=str(effective_cwd) if effective_cwd is not None else None,
            capture_output=True,
            text=True,
            check=False,
        )
        result = ZGResult(
            args=tuple(command),
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )
        if check and result.returncode != 0:
            raise RuntimeError(
                f"`{' '.join(result.args)}` failed with exit code {result.returncode}\n"
                f"stdout:\n{result.stdout}\n"
                f"stderr:\n{result.stderr}"
            )
        return result

    def index(
        self,
        root: str | Path | None = None,
        *,
        embedding: str | None = None,
        extra_args: Iterable[str] = (),
        check: bool = True,
    ) -> ZGResult:
        args: list[str] = ["index"]
        if root is not None:
            args.extend(["--root", str(root)])
        if embedding is not None:
            args.extend(["--embedding", embedding])
        args.extend(extra_args)
        return self.run(*args, check=check)

    def query(
        self,
        query: str,
        *,
        root: str | Path | None = None,
        limit: int | None = None,
        human: bool = False,
        extra_args: Iterable[str] = (),
        check: bool = True,
    ) -> ZGResult:
        args: list[str] = ["query"]
        if root is not None:
            args.extend(["--root", str(root)])
        if human:
            args.append("--human")
        if limit is not None:
            args.extend(["--limit", str(limit)])
        args.extend(extra_args)
        args.append(query)
        return self.run(*args, check=check)

    def status(
        self,
        *,
        root: str | Path | None = None,
        check_ready: bool = False,
        check: bool = True,
    ) -> ZGResult:
        args: list[str] = ["status"]
        if root is not None:
            args.extend(["--root", str(root)])
        if check_ready:
            args.append("--check-ready")
        return self.run(*args, check=check)


zvec_grep = ZvecGrep()
