#!/usr/bin/env python3
import os
import logging
import sys
import uvicorn
from argparse import ArgumentParser, Namespace

logger = logging.getLogger(__name__)
logging.basicConfig(format="%(levelname)s: %(message)s")
logger.setLevel(logging.INFO)


def get_args() -> Namespace:
    parser = ArgumentParser(
        description="SoniaEmu WebUI",
        epilog="This software is licensed under MIT license",
        add_help=False,
    )
    parser.add_argument(
        "-p", "--port", type=int, default=5000, help="port on which webui is hosted"
    )
    parser.add_argument(
        "-h", "--host", type=str, default="0.0.0.0", help="address to host on"
    )
    parser.add_argument(
        "-s",
        "--socket",
        type=str,
        default="/tmp/sonia-emu.sock",
        help="path to a Unix Socket",
    )
    parser.add_argument("--help", action="help", help="show this help message and exit")
    return parser.parse_args()


def main(args: Namespace) -> None:
    if sys.platform != "linux":
        logger.warning(
            f"This program was written specifically for Linux.\n"
            f"Input events won't work on {sys.platform}."
        )
    os.environ["SOCK_PATH"] = args.socket
    uvicorn.run(
        "webui:app",
        port=args.port,
        host=args.host,
        loop="uvloop",
        http="httptools",
        access_log=False,
        use_colors=False,
    )


if __name__ == "__main__":
    args = get_args()
    main(args)
