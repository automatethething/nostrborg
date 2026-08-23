#!/usr/bin/env python3
import base64
import hashlib
import hmac
import json
import os
import socket
import time
from urllib.parse import urlparse

from scripts.local_nostr_relay import GUID, read_ws_text


def stream(key, nonce, length):
    out = b""
    counter = 0
    while len(out) < length:
        out += hmac.new(key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest()
        counter += 1
    return out[:length]


def encrypt_manifest(plaintext: bytes, passphrase: str) -> bytes:
    key = hashlib.sha256(passphrase.encode()).digest()
    nonce = os.urandom(16)
    ciphertext = bytes(a ^ b for a, b in zip(plaintext, stream(key, nonce, len(plaintext))))
    tag = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(nonce + tag + ciphertext)


def decrypt_manifest(payload: bytes, passphrase: str) -> bytes:
    raw = base64.urlsafe_b64decode(payload)
    nonce, tag, ciphertext = raw[:16], raw[16:48], raw[48:]
    key = hashlib.sha256(passphrase.encode()).digest()
    expected = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, expected):
        raise ValueError("manifest authentication failed")
    return bytes(a ^ b for a, b in zip(ciphertext, stream(key, nonce, len(ciphertext))))


def event_id(event):
    serialized = json.dumps([
        0,
        event["pubkey"],
        event["created_at"],
        event["kind"],
        event["tags"],
        event["content"],
    ], separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode()).hexdigest()


def send_ws_text(conn, text):
    payload = text.encode()
    mask = os.urandom(4)
    header = bytearray([0x81])
    if len(payload) < 126:
        header.append(0x80 | len(payload))
    elif len(payload) < 65536:
        header.extend([0x80 | 126, *len(payload).to_bytes(2, "big")])
    else:
        header.extend([0x80 | 127, *len(payload).to_bytes(8, "big")])
    masked = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
    conn.sendall(bytes(header) + mask + masked)


def connect(url):
    parsed = urlparse(url)
    conn = socket.create_connection((parsed.hostname, parsed.port), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    conn.sendall((
        f"GET {parsed.path or '/'} HTTP/1.1\r\n"
        f"Host: {parsed.hostname}:{parsed.port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode())
    response = b""
    while b"\r\n\r\n" not in response:
        response += conn.recv(4096)
    if b" 101 " not in response.split(b"\r\n", 1)[0]:
        raise ConnectionError(response.decode(errors="ignore"))
    return conn


def publish(relay_url, encrypted_manifest: bytes, repo_id="synthetic-repo"):
    event = {
        "pubkey": "0" * 64,
        "created_at": int(time.time()),
        "kind": 30078,
        "tags": [["d", repo_id], ["t", "nostrborg-manifest"]],
        "content": encrypted_manifest.decode(),
    }
    event["id"] = event_id(event)
    event["sig"] = "0" * 128
    with connect(relay_url) as conn:
        send_ws_text(conn, json.dumps(["EVENT", event], separators=(",", ":")))
        reply = json.loads(read_ws_text(conn))
    if reply[:3] != ["OK", event["id"], True]:
        raise RuntimeError(reply)
    return event


def query(relay_url, wanted_id):
    with connect(relay_url) as conn:
        send_ws_text(conn, json.dumps(["REQ", "nostrborg", {"ids": [wanted_id]}], separators=(",", ":")))
        while True:
            message = json.loads(read_ws_text(conn))
            if message[0] == "EVENT":
                return message[2]
            if message[0] == "EOSE":
                raise KeyError(wanted_id)
