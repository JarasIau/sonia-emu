import os
from argparse import Namespace

import run


def test_get_args_uses_expected_defaults(monkeypatch):
    monkeypatch.setattr("sys.argv", ["run.py"])

    args = run.get_args()

    assert args.host == "0.0.0.0"
    assert args.port == 5000
    assert args.socket == "/tmp/sonia-emu.sock"


def test_get_args_parses_overrides(monkeypatch):
    monkeypatch.setattr(
        "sys.argv",
        [
            "run.py",
            "--host",
            "127.0.0.1",
            "--port",
            "8080",
            "--socket",
            "/tmp/test.sock",
        ],
    )

    args = run.get_args()

    assert args.host == "127.0.0.1"
    assert args.port == 8080
    assert args.socket == "/tmp/test.sock"


def test_main_sets_socket_path_and_starts_uvicorn(monkeypatch):
    calls = []
    args = Namespace(host="127.0.0.1", port=8080, socket="/tmp/test.sock")

    def fake_run(app_path, **kwargs):
        calls.append((app_path, kwargs))

    monkeypatch.setattr(run.uvicorn, "run", fake_run)
    monkeypatch.setattr(run.sys, "platform", "linux")

    run.main(args)

    assert os.environ["SOCK_PATH"] == "/tmp/test.sock"
    assert calls == [
        (
            "webui:app",
            {
                "port": 8080,
                "host": "127.0.0.1",
                "loop": "uvloop",
                "http": "httptools",
                "access_log": False,
                "use_colors": False,
            },
        )
    ]
