"""Metadata assertions preserve source claims without granting body text book authority."""


def assert_supplemental_metadata(test, book):
    accepted = {(m.field, m.value) for m in book.metadata if m.status == "accepted"}
    for field, value in [
        ("title", "Atlas Supplements"),
        ("contributor", "F. Sample"),
        ("contributor", "E. Example"),
    ]:
        test.assertIn((field, value), accepted)
    # These labelled claims occur inside body chapter 2, not a copyright page.
    for value in ["fixture edition 1", "2026-09-28", "9780000000002"]:
        test.assertTrue(any(m.value == value and m.status == "candidate" for m in book.metadata))
    test.assertTrue(
        any(m.value == "9780000000019" and m.status == "candidate" for m in book.metadata)
    )


def assert_qualification_metadata(test, book, oracle):
    accepted = {(m.field, m.value) for m in book.metadata if m.status == "accepted"}
    for field, key in [
        ("subtitle", "subtitle"),
        ("rights", "rights_statement"),
        ("language", "language"),
    ]:
        test.assertIn((field, oracle["metadata"][key]), accepted)
