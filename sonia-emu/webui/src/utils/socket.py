import asyncio
import logging
from asyncio import StreamReader, StreamWriter

logger = logging.getLogger(__name__)


class Socket:
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

    async def close(self) -> None:
        if self.writer is not None:
            try:
                self.writer.close()
                await asyncio.wait_for(self.writer.wait_closed(), timeout=2.0)
            except (OSError, TimeoutError) as e:
                logger.error(f"Error closing socket due to: {e}")
            finally:
                self.writer = None
                self.reader = None

    async def connect(self) -> None:
        for attempt in range(1, 6):
            try:
                self.reader, self.writer = await asyncio.open_unix_connection(
                    self.sock_path
                )
                logger.info(f"Connected to {self.sock_path}")
                return
            except (KeyboardInterrupt, asyncio.exceptions.CancelledError):
                raise
            except OSError as e:
                logger.error(
                    f"Connection attempt {attempt} to {self.sock_path} failed: {e}"
                )
                await self.close()
                if attempt == 5:
                    logger.error(f"Giving up on attempt {attempt}: {e}")
                    return
                await self._sleep(5)

    async def sendall(self, data: bytes) -> None:
        if self.writer is None:
            await self.connect()

        if self.writer is None:
            raise ConnectionError("Socket not connected")

        try:
            self.writer.write(data)
            await self.writer.drain()
        except OSError as e:
            logger.error(f"Write failed, reconnecting due to: {e}")
            await self.close()
            raise
