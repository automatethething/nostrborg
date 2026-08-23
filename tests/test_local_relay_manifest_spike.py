import json
import socket
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

from scripts.local_nostr_relay import LocalRelay
from scripts.relay_manifest_proof import decrypt_manifest, encrypt_manifest, event_id, publish, query


class RelayManifestProofTests(unittest.TestCase):
    def test_encrypt_decrypt_manifest_round_trips(self):
        plaintext = b"digest\tpath\n"
        encrypted = encrypt_manifest(plaintext, "secret")

        self.assertNotIn(plaintext, encrypted)
        self.assertEqual(decrypt_manifest(encrypted, "secret"), plaintext)

    def test_event_id_is_deterministic_nip01_shape(self):
        event = {
            "pubkey": "0" * 64,
            "created_at": 1,
            "kind": 30078,
            "tags": [["d", "repo"]],
            "content": "payload",
        }

        self.assertEqual(event_id(event), event_id(event))
        self.assertEqual(len(event_id(event)), 64)

    def test_publish_and_fetch_encrypted_manifest_from_local_relay(self):
        with tempfile.TemporaryDirectory() as tmp:
            relay = LocalRelay(Path(tmp), host="127.0.0.1", port=0)
            relay.start()
            try:
                manifest = b"abc123\tconfig\n"
                encrypted = encrypt_manifest(manifest, "manifest-key")
                event = publish(relay.url, encrypted, repo_id="synthetic-repo")
                fetched = query(relay.url, event["id"])
            finally:
                relay.stop()

        self.assertEqual(fetched["id"], event["id"])
        self.assertEqual(fetched["content"], encrypted.decode())
        self.assertEqual(decrypt_manifest(fetched["content"].encode(), "manifest-key"), manifest)


if __name__ == "__main__":
    unittest.main()
