#!/usr/bin/env python3
import base64
import hashlib
import json
import socket
import threading
from pathlib import Path

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def recv_exact(conn, n):
    data = b""
    while len(data) < n:
        chunk = conn.recv(n - len(data))
        if not chunk:
            raise ConnectionError("connection closed")
        data += chunk
    return data


def read_ws_text(conn):
    b1, b2 = recv_exact(conn, 2)
    opcode = b1 & 0x0F
    if opcode == 8:
        return None
    if opcode != 1:
        raise ValueError("only text frames supported")
    masked = b2 & 0x80
    length = b2 & 0x7F
    if length == 126:
        length = int.from_bytes(recv_exact(conn, 2), "big")
    elif length == 127:
        length = int.from_bytes(recv_exact(conn, 8), "big")
    mask = recv_exact(conn, 4) if masked else b"\0\0\0\0"
    payload = recv_exact(conn, length)
    if masked:
        payload = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
    return payload.decode()


def send_ws_text(conn, text):
    payload = text.encode()
    header = bytearray([0x81])
    if len(payload) < 126:
        header.append(len(payload))
    elif len(payload) < 65536:
        header.extend([126, *len(payload).to_bytes(2, "big")])
    else:
        header.extend([127, *len(payload).to_bytes(8, "big")])
    conn.sendall(bytes(header) + payload)


class LocalRelay:
    def __init__(self, root: Path, host="127.0.0.1", port=0):
        self.root = Path(root)
        self.host = host
        self.port = port
        self.sock = None
        self.thread = None
        self.events = {}
        self._stop = threading.Event()

    @property
    def url(self):
        return f"ws://{self.host}:{self.port}"

    def start(self):
        self.root.mkdir(parents=True, exist_ok=True)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((self.host, self.port))
        self.port = self.sock.getsockname()[1]
        self.sock.listen()
        self.thread = threading.Thread(target=self._serve, daemon=True)
        self.thread.start()

    def stop(self):
        self._stop.set()
        if self.sock:
            try:
                self.sock.close()
            except OSError:
                pass
        if self.thread:
            self.thread.join(timeout=2)

    def _serve(self):
        while not self._stop.is_set():
            try:
                conn, _ = self.sock.accept()
            except OSError:
                break
            threading.Thread(target=self._handle, args=(conn,), daemon=True).start()

    def _handle(self, conn):
        with conn:
            self._handshake(conn)
            while True:
                try:
                    text = read_ws_text(conn)
                except Exception:
                    return
                if text is None:
                    return
                self._handle_message(conn, text)

    def _handshake(self, conn):
        request = b""
        while b"\r\n\r\n" not in request:
            request += conn.recv(4096)
        headers = {}
        for line in request.decode(errors="ignore").split("\r\n")[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.lower()] = value.strip()
        accept = base64.b64encode(hashlib.sha1((headers["sec-websocket-key"] + GUID).encode()).digest()).decode()
        conn.sendall((
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
        ).encode())

    def _handle_message(self, conn, text):
        message = json.loads(text)
        if message[0] == "EVENT":
            event = message[1]
            self.events[event["id"]] = event
            (self.root / f"{event['id']}.json").write_text(json.dumps(event, sort_keys=True))
            send_ws_text(conn, json.dumps(["OK", event["id"], True, ""]))
        elif message[0] == "REQ":
            subid = message[1]
            filters = message[2:]
            ids = set()
            for filt in filters:
                ids.update(filt.get("ids", []))
            for event_id in ids:
                if event_id in self.events:
                    send_ws_text(conn, json.dumps(["EVENT", subid, self.events[event_id]]))
            send_ws_text(conn, json.dumps(["EOSE", subid]))
        elif message[0] == "CLOSE":
            send_ws_text(conn, json.dumps(["CLOSED", message[1], ""]))
