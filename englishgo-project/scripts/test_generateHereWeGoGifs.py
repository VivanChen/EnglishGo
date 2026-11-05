import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('gif_generator', Path(__file__).with_name('generateHereWeGoGifs.py'))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class AnimationEncodingTests(unittest.TestCase):
    def test_prevents_overlapping_batches_and_releases_the_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'generation.lock'
            with generator.generation_lock(path):
                with self.assertRaises(RuntimeError):
                    with generator.generation_lock(path):
                        self.fail('A second writer acquired the catalog lock')
            with generator.generation_lock(path):
                pass
    def test_every_book_one_word_has_a_motion_matching_the_original_scene(self):
        cards = generator.book_cards()
        motions = generator.read_json(generator.MOTIONS)
        self.assertEqual(len(cards), 102)
        self.assertEqual(set(motions), {card['w'].lower() for card in cards})
        self.assertEqual(len({generator.slug(card['w']) for card in cards}), 102)
        for card in cards:
            prompt = generator.prompt_for(card, motions[card['w'].lower()])
            self.assertIn(card['ex'], prompt)
            self.assertIn(card['ez'], prompt)

    def test_encodes_different_poses_as_a_loop_and_verifies_the_poster_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            sheet = Image.new('RGB', generator.SHEET_SIZE, '#faf7ef')
            draw = ImageDraw.Draw(sheet)
            for i in range(6):
                x, y = (i % 3) * 512 + 40 + 35 * i, (i // 3) * 512 + 80
                draw.ellipse((x, y, x + 150, y + 150), fill='#14815a')
            sheet_path, asset = base / 'poses.png', base / 'word.gif'
            sheet.save(sheet_path)
            metadata = generator.pack_sprite(sheet_path, asset, frame_size=192, duration_ms=160)
            self.assertEqual(metadata['frameCount'], 10)
            self.assertEqual(metadata['durationMs'], 1600)
            with Image.open(asset) as animation:
                self.assertEqual(animation.info['loop'], 0)
                self.assertEqual(animation.size, (192, 192))
                frames = []
                for i in range(animation.n_frames):
                    animation.seek(i)
                    frames.append(animation.convert('RGB').tobytes())
                self.assertGreaterEqual(len(set(frames)), 6)
            original_public = generator.PUBLIC
            generator.PUBLIC = base
            try:
                poster = base / 'word.webp'
                Image.new('RGB', (32, 32), 'green').save(poster)
                entry = {**metadata, 'src': '/word.gif', 'poster': '/word.webp', 'sourceSha256': generator.digest(poster.read_bytes())}
                self.assertTrue(generator.verify_entry({'img': '/word.webp'}, entry))
                Image.new('RGB', (32, 32), 'red').save(poster)
                self.assertFalse(generator.verify_entry({'img': '/word.webp'}, entry))
            finally:
                generator.PUBLIC = original_public

    def test_rejects_a_static_or_wrongly_sized_sheet_without_publishing(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            sheet, output = base / 'sheet.png', base / 'bad.gif'
            for size in [(500, 500), generator.SHEET_SIZE]:
                Image.new('RGB', size, 'white').save(sheet)
                with self.assertRaises(ValueError):
                    generator.pack_sprite(sheet, output)
                self.assertFalse(output.exists())

    def test_error_classification_does_not_echo_provider_diagnostics(self):
        secret = 'private-key-and-request-details'
        for diagnostic in ['401 invalid_api_key', '403 verification', '429 insufficient_quota', 'network connection', 'unexpected']:
            self.assertNotIn(secret, generator.failure_reason(diagnostic + secret))


if __name__ == '__main__':
    unittest.main()
