import asyncio
import struct

import pytest
import webui
from fastapi import HTTPException


def run_async(coro):
    return asyncio.run(coro)


class FakeSocket:
    def __init__(self, *, error=None):
        self.error = error
        self.sent = []

    async def sendall(self, data):
        if self.error is not None:
            raise self.error
        self.sent.append(data)


@pytest.mark.parametrize(
    ("input_data", "expected"),
    [
        (
            webui.InputData(type="button", id=7, value=1),
            struct.pack("!BBi", ord(b"b"), 7, 1),
        ),
        (
            webui.InputData(type="joystick", id=2, value=0.5),
            struct.pack("!BBi", ord(b"j"), 2, 256),
        ),
        (
            webui.InputData(type="trigger", id=3, value=-0.25),
            struct.pack("!BBi", ord(b"j"), 3, -128),
        ),
    ],
)
def test_input_data_to_bytes(input_data, expected):
    assert input_data.to_bytes() == expected


def test_send_data_sends_serialized_input():
    sock = FakeSocket()
    input_data = webui.InputData(type="button", id=1, value=0)

    run_async(webui.send_data(input_data, sock))

    assert sock.sent == [struct.pack("!BBi", ord(b"b"), 1, 0)]


def test_send_data_turns_socket_errors_into_service_unavailable():
    sock = FakeSocket(error=OSError("unavailable"))
    input_data = webui.InputData(type="button", id=1, value=0)

    with pytest.raises(HTTPException) as exc_info:
        run_async(webui.send_data(input_data, sock))

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "failed_to_send_input"


def test_handle_fallback_returns_sent_detail():
    sock = FakeSocket()
    input_data = webui.InputData(type="joystick", id=1, value=1.0)

    response = run_async(webui.handle_fallback(input_data, sock))

    assert response == {"detail": "sent"}
    assert sock.sent == [struct.pack("!BBi", ord(b"j"), 1, 512)]
