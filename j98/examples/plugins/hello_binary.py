"""Example binary plugin for opsflow.

Binary plugins receive JSON on stdin with:
  {"args": {...}, "context": {...}}

They should write result to stdout and exit 0 on success, non-zero on failure.
"""
import json
import sys


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        print("Error: Invalid JSON input", file=sys.stderr)
        sys.exit(1)

    args = payload.get("args", {})
    action = args.get("action", "log")

    if action == "log":
        message = args.get("message", "Hello from binary plugin!")
        level = args.get("level", "INFO")
        print(f"[{level}] {message}")
    elif action == "version":
        print("binary-plugin v0.1.0")
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
