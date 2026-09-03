from __future__ import annotations

import sys

from .client import zvec_grep


def main() -> int:
    result = zvec_grep.run(*sys.argv[1:], check=False)
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
