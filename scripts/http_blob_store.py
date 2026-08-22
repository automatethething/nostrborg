#!/usr/bin/env python3
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class BlobHandler(BaseHTTPRequestHandler):
    root: Path

    def log_message(self, fmt, *args):
        return

    def blob_digest(self):
        prefix = "/blobs/"
        if not self.path.startswith(prefix):
            return None
        digest = self.path[len(prefix):]
        if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            return None
        return digest

    def blob_path(self):
        digest = self.blob_digest()
        if digest is None:
            return None
        return self.root / digest[:2] / digest

    def do_PUT(self):
        path = self.blob_path()
        if path is None:
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
        body = self.rfile.read(length)
        if hashlib.sha256(body).hexdigest() != self.blob_digest():
            self.send_error(400, "body does not match digest")
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        self.send_response(201)
        self.end_headers()

    def do_GET(self):
        path = self.blob_path()
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
