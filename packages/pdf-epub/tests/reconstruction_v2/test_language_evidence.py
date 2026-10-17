"""Independently authored script/language cases; no provider or book-quality claim."""

import unittest

from ava_pdf_epub.reconstruction_v2.language_evidence import ukrainian_evidence

UK = (
    "Коли вона повернулася після подорожі, її зустріли друзі. Ця історія про те, "
    "що людина може змінити своє життя. Якщо ми більше слухаємо одне одного, "
    "то між нами вже є довіра. Перед вечерею вони обговорили нові книжки."
)
RU = (
    "Когда она вернулась после путешествия, её встретили друзья. Эта история о том, "
    "что человек может изменить свою жизнь. Если мы больше слушаем друг друга, "
    "то между нами уже есть доверие. Перед ужином они обсудили новые книги."
)


class UkrainianRoutingEvidence(unittest.TestCase):
    def test_authored_ukrainian_has_multiple_independent_hints(self) -> None:
        result = ukrainian_evidence(UK)
        self.assertEqual("uk", result.language)
        self.assertGreaterEqual(result.distinct_letter_kinds, 2)
        self.assertGreaterEqual(result.hint_kinds, 3)

    def test_cyrillic_alone_does_not_identify_ukrainian(self) -> None:
        for text in [RU, "абвгд жзклмн опрсту фхцчш " * 20]:
            with self.subTest(text=text[:20]):
                self.assertIsNone(ukrainian_evidence(text).language)

    def test_short_heading_stays_unknown(self) -> None:
        self.assertIsNone(ukrainian_evidence("Її життя після подорожі").language)

    def test_conflicting_script_and_mixed_prose_require_review(self) -> None:
        for text in [UK + " Это русский текст.", UK + "English prose. " * 30]:
            with self.subTest(text=text[-30:]):
                self.assertIsNone(ukrainian_evidence(text).language)

    def test_case_and_apostrophe_variants_preserve_evidence(self) -> None:
        for apostrophe in ["'", "’", "ʼ"]:
            text = UK.upper() + " ПАМ" + apostrophe + "ЯТЬ"
            self.assertEqual("uk", ukrainian_evidence(text).language)
            self.assertIn(apostrophe, text)

    def test_english_and_latin_lookalikes_do_not_certify_ukrainian(self) -> None:
        english = "The reader opened the book and followed the chapter into another story. " * 10
        self.assertIsNone(ukrainian_evidence(english).language)
        # Replacing the distinctive Cyrillic characters with visual Latin lookalikes must
        # not silently restore Ukrainian identity or mutate those source characters.
        confusable = UK.translate(str.maketrans({"і": "i", "ї": "ï", "є": "e", "ґ": "g"}))
        self.assertIsNone(ukrainian_evidence(confusable).language)

    def test_hints_in_word_fragments_are_not_counted(self) -> None:
        text = "іє " * 60 + "щобто якщось післямова"
        self.assertEqual(0, ukrainian_evidence(text).hint_kinds)
        self.assertIsNone(ukrainian_evidence(text).language)
