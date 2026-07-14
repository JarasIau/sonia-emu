import asyncio

import pytest

from utils.socket import Socket


def run_async(coro):
    return asyncio.run(coro)


class FakeWriter:
    def __init__(self, *, drain_error=None, wait_closed_error=None):
        self.data = []
        self.closed = False
        self.drain_error = drain_error
        self.wait_closed_error = wait_closed_error
        self.drain_calls = 0

    def write(self, data):
        self.data.append(data)

    async def drain(self):
        self.drain_calls += 1
        if self.drain_error is not None:
            raise self.drain_error

    def close(self):
        self.closed = True

    async def wait_closed(self):
        if self.wait_closed_error is not None:
            raise self.wait_closed_error


def test_sendall_writes_and_drains_existing_connection():
    sock = Socket("/tmp/sonia.sock")
    writer = FakeWriter()
    sock.writer = writer

    run_async(sock.sendall(b"packet"))

    assert writer.data == [b"packet"]
    assert writer.drain_calls == 1


def test_sendall_connects_when_writer_is_missing(monkeypatch):
    sock = Socket("/tmp/sonia.sock")
    writer = FakeWriter()

    async def fake_connect():
        sock.writer = writer

    monkeypatch.setattr(sock, "connect", fake_connect)

    run_async(sock.sendall(b"packet"))

    assert writer.data == [b"packet"]


def test_sendall_raises_when_connect_does_not_set_writer(monkeypatch):
    sock = Socket("/tmp/sonia.sock")

    async def fake_connect():
        return None

    monkeypatch.setattr(sock, "connect", fake_connect)

    with pytest.raises(ConnectionError, match="Socket not connected"):
        run_async(sock.sendall(b"packet"))


def test_sendall_closes_and_reraises_on_write_failure():
    sock = Socket("/tmp/sonia.sock")
    writer = FakeWriter(drain_error=OSError("boom"))
    sock.writer = writer
    sock.reader = object()

    with pytest.raises(OSError, match="boom"):
        run_async(sock.sendall(b"packet"))

    assert writer.closed is True
    assert sock.writer is None
    assert sock.reader is None


def test_close_clears_reader_and_writer():
    sock = Socket("/tmp/sonia.sock")
    writer = FakeWriter()
    sock.writer = writer
    sock.reader = object()

    run_async(sock.close())

    assert writer.closed is True
    assert sock.writer is None
    assert sock.reader is None
