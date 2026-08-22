import hashlib
import http.client
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

    def request(self, method, path, body=b""):
        conn = http.client.HTTPConnection(self.host, self.port, timeout=5)
        conn.request(method, path, body=body)
        response = conn.getresponse()
        data = response.read()
        conn.close()
        return response.status, data

    def test_put_rejects_body_that_does_not_match_digest(self):
        body = b"not the claimed digest"
        wrong_digest = "0" * 64

        status, _ = self.request("PUT", f"/blobs/{wrong_digest}", body)

        self.assertEqual(status, 400)
        self.assertFalse((Path(self.tmp.name) / "00" / wrong_digest).exists())

    def test_put_then_get_matching_digest(self):
        body = b"hello borg"
        digest = hashlib.sha256(body).hexdigest()

        put_status, _ = self.request("PUT", f"/blobs/{digest}", body)
        get_status, data = self.request("GET", f"/blobs/{digest}")

        self.assertEqual(put_status, 201)
        self.assertEqual(get_status, 200)
        self.assertEqual(data, body)

    def raw_put(self, digest, headers, body=b""):
        conn = http.client.HTTPConnection(self.host, self.port, timeout=5)
        conn.putrequest("PUT", f"/blobs/{digest}")
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
        status = self.raw_put(empty_digest, [("Transfer-Encoding", "chunked")], b"5\r\nhello\r\n0\r\n\r\n")

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
            [("Transfer-Encoding", ""), ("Content-Length", "0")],
        ]

        for headers in cases:
            with self.subTest(headers=headers):
                status = self.raw_put(empty_digest, headers)
                self.assertEqual(status, 400)
                self.assertFalse((Path(self.tmp.name) / empty_digest[:2] / empty_digest).exists())


if __name__ == "__main__":
    unittest.main()
