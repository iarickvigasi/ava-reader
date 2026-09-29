import json
import unittest

from ava_pdf_epub.runtime.lease_control import advance_lease


class LeaseControlTests(unittest.TestCase):
    def test_unchanged_control_never_renews_and_confirmed_remaining_time_does(self):
        raw = json.dumps({"sequence": 1, "remaining_ms": 1000}).encode()
        self.assertEqual(advance_lease(raw, -1, 0, 5), (1, 5.75))
        self.assertEqual(advance_lease(raw, 1, 6, 5.5), (1, 6))
        renewed = json.dumps({"sequence": 2, "remaining_ms": 300}).encode()
        self.assertEqual(advance_lease(renewed, 1, 6, 5.5), (2, 5.55))

    def test_late_renewal_never_revives_expired_authority(self):
        raw = json.dumps({"sequence": 2, "remaining_ms": 30000}).encode()
        with self.assertRaisesRegex(ValueError, "Lease expired"):
            advance_lease(raw, 1, 6, 6)

    def test_malformed_stale_and_unbounded_controls_fail_closed(self):
        for value in [
            {"sequence": 0, "remaining_ms": 1000},
            {"sequence": True, "remaining_ms": 1000},
            {"sequence": 2, "remaining_ms": 30001},
            {"sequence": 2, "remaining_ms": 0},
            {"sequence": 2, "remaining_ms": 1, "path": "/etc"},
            [],
        ]:
            with self.assertRaises(ValueError):
                advance_lease(json.dumps(value).encode(), 1, 6, 5)
