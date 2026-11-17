import importlib.util
import json
import math
from pathlib import Path
import tempfile
import unittest

import numpy as np

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

    @unittest.skipUnless(generator.DEFAULT_RIFE.is_file() and generator.DEFAULT_GIFSICLE.is_file(), 'Local RIFE/gifsicle integration tools required')
    def test_encodes_different_poses_as_a_loop_and_verifies_the_poster_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            sheet = Image.new('RGB', generator.SHEET_SIZE, '#faf7ef')
            draw = ImageDraw.Draw(sheet)
            for i in range(16):
                left, top = (i % 4) * 512, (i // 4) * 512
                # Stationary landmarks distinguish intentional object motion from camera shake.
                for x in range(30, 490, 60):
                    draw.rectangle((left+x, top+25, left+x+12, top+48), fill='#606060')
                    draw.rectangle((left+x, top+450, left+x+12, top+470), fill='#606060')
                x = left + 180 + 35 * math.sin(i * 2 * math.pi / 16)
                y = top + 180 + 12 * math.cos(i * 2 * math.pi / 16)
                draw.ellipse((x, y, x + 100, y + 100), fill='#14815a')
            sheet_path, asset = base / 'poses.png', base / 'word.gif'
            sheet.save(sheet_path)
            metadata = generator.pack_sprite(sheet_path, asset, frame_size=192, duration_ms=40)
            self.assertEqual(metadata['frameCount'], 64)
            self.assertEqual(metadata['keyframeCount'], 16)
            self.assertEqual(metadata['fps'], 25)
            self.assertEqual(metadata['durationMs'], 2560)
            self.assertEqual(metadata['playCount'], 3)
            self.assertEqual(metadata['playbackDurationMs'], 7680)
            with Image.open(asset) as animation:
                self.assertEqual(animation.info['loop'], 2)
                self.assertEqual(animation.size, (192, 192))
                frames = []
                for i in range(animation.n_frames):
                    animation.seek(i)
                    frames.append(animation.convert('RGB').tobytes())
                self.assertEqual(len(set(frames)), 64)
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

    @unittest.skipUnless(generator.DEFAULT_RIFE.is_file(), 'Local RIFE integration tool required')
    def test_motion_compensation_moves_the_subject_instead_of_crossfading_two_copies(self):
        from hereWeGoAnimationEncoding import interpolate_cycle
        first = Image.new('RGB', (128, 128), 'white')
        second = first.copy()
        ImageDraw.Draw(first).rectangle((35, 45, 65, 80), fill='#154a79')
        ImageDraw.Draw(second).rectangle((47, 45, 77, 80), fill='#154a79')
        with tempfile.TemporaryDirectory() as directory:
            frames = interpolate_cycle([np.asarray(first), np.asarray(second)], 4, generator.DEFAULT_RIFE, directory)
        middle = np.asarray(frames[2])
        mask = middle[..., 0] < 100
        ys, xs = np.where(mask)
        self.assertAlmostEqual(float(xs.mean()), 56, delta=2)
        self.assertLessEqual(int(xs.max() - xs.min()), 33)
        self.assertGreater(mask.sum(), 950)

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
