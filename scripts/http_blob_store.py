#!/usr/bin/env python3
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class BlobHandler(BaseHTTPRequestHandler):
    root: Path

    def log_message(self, fmt, *args):
        return

    def valid_digest(self, digest):
        return len(digest) == 64 and all(c in "0123456789abcdef" for c in digest)

    def blob_path(self, digest):
        if not self.valid_digest(digest):
            return None
        return self.root / digest[:2] / digest

    def do_PUT(self):
        if self.path != "/upload":
            self.send_error(404)
            return
        if self.headers.get_all("Transfer-Encoding") is not None:
            self.send_error(400, "transfer encoding unsupported")
            return
        content_lengths = self.headers.get_all("Content-Length") or []
        if len(content_lengths) != 1:
            self.send_error(400, "single content length required")
            return
        raw_length = content_lengths[0]
        if not raw_length.isdecimal() or (raw_length.startswith("0") and raw_length != "0"):
            self.send_error(400, "valid content length required")
            return
        length = int(raw_length)
        claimed_digest = self.headers.get("X-SHA-256", "")
        if not self.valid_digest(claimed_digest):
            self.send_error(400, "valid X-SHA-256 required")
            return
        body = self.rfile.read(length)
        if len(body) != length:
            self.send_error(400, "body shorter than content length")
            return
        actual_digest = hashlib.sha256(body).hexdigest()
        if actual_digest != claimed_digest:
            self.send_error(409, "body does not match digest")
            return
        path = self.blob_path(actual_digest)
        path.parent.mkdir(parents=True, exist_ok=True)
        status = 200 if path.exists() else 201
        path.write_bytes(body)
        descriptor = f'{{"sha256":"{actual_digest}","size":{len(body)}}}'.encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(descriptor)))
        self.end_headers()
        self.wfile.write(descriptor)

    def do_GET(self):
        digest = self.path.lstrip("/")
        path = self.blob_path(digest)
        if path is None or not path.is_file():
            self.send_error(404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--port-file", required=True)
    args = parser.parse_args()

    BlobHandler.root = Path(args.root)
    server = ThreadingHTTPServer(("127.0.0.1", 0), BlobHandler)
    Path(args.port_file).write_text(str(server.server_port))
    server.serve_forever()


if __name__ == "__main__":
    main()
