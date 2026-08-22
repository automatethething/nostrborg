import hashlib
import http.client
import socket
import tempfile
import threading
import unittest
from pathlib import Path

from scripts import http_blob_store


class HttpBlobStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        http_blob_store.BlobHandler.root = Path(self.tmp.name)
        self.server = http_blob_store.ThreadingHTTPServer(("127.0.0.1", 0), http_blob_store.BlobHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def request(self, method, path, body=b"", headers=None):
        conn = http.client.HTTPConnection(self.host, self.port, timeout=5)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        data = response.read()
        conn.close()
        return response.status, data

    def test_upload_rejects_body_that_does_not_match_digest(self):
        body = b"not the claimed digest"
        wrong_digest = "0" * 64

        status, _ = self.request("PUT", "/upload", body, {"X-SHA-256": wrong_digest})

        self.assertEqual(status, 409)
        self.assertFalse((Path(self.tmp.name) / "00" / wrong_digest).exists())

    def test_upload_then_get_matching_digest(self):
        body = b"hello borg"
        digest = hashlib.sha256(body).hexdigest()

        put_status, put_body = self.request("PUT", "/upload", body, {"X-SHA-256": digest})
        get_status, data = self.request("GET", f"/{digest}")

        self.assertEqual(put_status, 201)
        self.assertIn(digest.encode(), put_body)
        self.assertEqual(get_status, 200)
        self.assertEqual(data, body)

    def raw_put(self, digest, headers, body=b""):
        conn = http.client.HTTPConnection(self.host, self.port, timeout=5)
        conn.putrequest("PUT", "/upload")
        for name, value in headers:
            conn.putheader(name, value)
        conn.endheaders()
        if body:
            conn.send(body)
        response = conn.getresponse()
        response.read()
        conn.close()
        return response.status

    def test_chunked_put_is_rejected(self):
        empty_digest = hashlib.sha256(b"").hexdigest()
        status = self.raw_put(empty_digest, [("Transfer-Encoding", "chunked"), ("X-SHA-256", empty_digest)], b"5\r\nhello\r\n0\r\n\r\n")

        self.assertEqual(status, 400)
        self.assertFalse((Path(self.tmp.name) / empty_digest[:2] / empty_digest).exists())

    def test_content_length_must_be_single_plain_non_negative_decimal(self):
        empty_digest = hashlib.sha256(b"").hexdigest()
        cases = [
            [],
            [("Content-Length", "-1")],
            [("Content-Length", "+0")],
            [("Content-Length", "abc")],
            [("Content-Length", "0"), ("Content-Length", "0")],
            [("Transfer-Encoding", ""), ("Content-Length", "0"), ("X-SHA-256", empty_digest)],
        ]

        for headers in cases:
            with self.subTest(headers=headers):
                if headers and not any(name.lower() == "x-sha-256" for name, _ in headers):
                    headers = [*headers, ("X-SHA-256", empty_digest)]
                status = self.raw_put(empty_digest, headers)
                self.assertEqual(status, 400)
                self.assertFalse((Path(self.tmp.name) / empty_digest[:2] / empty_digest).exists())

    def test_truncated_body_is_rejected_even_when_digest_matches_partial_body(self):
        partial = b"short"
        digest = hashlib.sha256(partial).hexdigest()
        request = (
            f"PUT /upload HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Content-Length: 10\r\n"
            f"X-SHA-256: {digest}\r\n"
            f"Connection: close\r\n\r\n"
        ).encode() + partial

        with socket.create_connection((self.host, self.port), timeout=5) as sock:
            sock.sendall(request)
            sock.shutdown(socket.SHUT_WR)
            response = sock.recv(4096)

        self.assertIn(b"400", response.splitlines()[0])
        self.assertFalse((Path(self.tmp.name) / digest[:2] / digest).exists())


if __name__ == "__main__":
    unittest.main()
