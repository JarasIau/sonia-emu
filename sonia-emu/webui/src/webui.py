import logging
import os
import struct
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated, ClassVar, Literal, cast

import orjson
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import HTMLResponse, ORJSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from utils.socket import Socket

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.sock = Socket(os.getenv("SOCK_PATH", "/tmp/sonia-emu.sock"))
    await app.state.sock.connect()
    if app.state.sock.writer is None:
        logger.warning("Starting WebUI anyway...")
    try:
        yield
    finally:
        if app.state.sock is not None:
            await app.state.sock.close()


app = FastAPI(
    lifespan=lifespan,
    json_loads=orjson.loads,
    default_response_class=ORJSONResponse,
    debug=False,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


class InputData(BaseModel):
    AXIS_RANGE: ClassVar[int] = 512
    PREFIX_MAP: ClassVar[dict[str, bytes]] = {
        "button": ord(b"b"),
        "joystick": ord(b"j"),
        "trigger": ord(b"j"),
    }

    type: Literal["button", "joystick", "trigger"]
    id: int
    value: float

    def to_bytes(self) -> bytes:
        if self.type != "button":
            val = int(self.value * self.AXIS_RANGE)
        else:
            val = int(self.value)
        return struct.pack("!BBi", self.PREFIX_MAP[self.type], self.id, val)


async def get_sock(request: Request) -> Socket:
    return cast(Socket, request.app.state.sock)


SocketDep = Annotated[Socket, Depends(get_sock)]


async def send_data(input_data: InputData, sock: Socket) -> None:
    packet = input_data.to_bytes()
    try:
        await sock.sendall(packet)
    except OSError as e:
        logger.error(e)
        raise HTTPException(status_code=503, detail="failed_to_send_input")


@app.post("/fallback", status_code=200)
async def handle_fallback(input_data: InputData, sock: SocketDep) -> dict[str, str]:
    await send_data(input_data, sock)
    return {"detail": "sent"}


@app.websocket("/ws")
async def handle_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    sock: Socket = websocket.app.state.sock
    try:
        while True:
            data = await websocket.receive_bytes()
            await sock.sendall(data)
    except WebSocketDisconnect:
        logger.warning("Websocket disconnected, running on fallback")
    except OSError as e:
        logger.error(e)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/advanced", response_class=HTMLResponse)
async def advanced(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request=request, name="advanced.html")
