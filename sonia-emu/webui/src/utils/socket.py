import asyncio
from asyncio import StreamWriter, StreamReader
import logging
from tenacity import (
    AsyncRetrying,
    wait_fixed,
    stop_after_attempt,
    RetryCallState,
    retry_if_not_exception_type,
)

logger = logging.getLogger(__name__)


class Socket:
    """asynchronous socket with built-in reconnections"""

    def __init__(self, sock_path: str):
        self.sock_path = sock_path

        self.writer: StreamWriter | None = None
        self.reader: StreamReader | None = None

    async def _sleep(self, seconds: float) -> None:
        timeout = int(seconds)
        for i in range(timeout, 0, -1):
            print(f"Reconnecting in {i}s", end="\r", flush=True)
            await asyncio.sleep(1)
        logger.info(f"Trying to reconnect to {self.sock_path}")

    async def _before_sleep(self, rcs: RetryCallState) -> None:
        e = rcs.outcome.exception() if rcs.outcome else None
        if e:
            logger.error(
                f"Connection attempt {rcs.attempt_number} to {self.sock_path} failed: {e}"
            )
        await self.close()

    async def _on_giveup(self, rcs: RetryCallState) -> None:
        e = rcs.outcome.exception() if rcs.outcome else None
        if e:
            logger.error(f"Giving up on attempt {rcs.attempt_number}: {e}")
        await self.close()

    async def close(self) -> None:
        if self.writer is not None:
            try:
                self.writer.close()
                await asyncio.wait_for(self.writer.wait_closed(), timeout=2.0)
            except Exception as e:
                logger.error(f"Error closing socket due to: {e}")
            finally:
                self.writer = None
                self.reader = None

    async def connect(self) -> None:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(5),
            wait=wait_fixed(5),
            sleep=self._sleep,
            before_sleep=self._before_sleep,
            retry_error_callback=self._on_giveup,
            retry=retry_if_not_exception_type(
                (KeyboardInterrupt, asyncio.exceptions.CancelledError)
            ),
        ):
            with attempt:
                self.reader, self.writer = await asyncio.open_unix_connection(
                    self.sock_path
                )
                logger.info(f"Connected to {self.sock_path}")

    async def sendall(self, data: bytes) -> None:
        if self.writer is None:
            await self.connect()

        if self.writer is None:
            raise ConnectionError("Socket not connected")

        try:
            self.writer.write(data)
            await self.writer.drain()
        except Exception as e:
            logger.error(f"Write failed, reconnecting due to: {e}")
            await self.close()
            raise
