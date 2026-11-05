#!/usr/bin/env python3
"""Animate Here We Go! Book 1 with the installed ImageGen CLI, then encode GIFs.

The source artwork and API key never enter the browser bundle. Each API edit
produces six poses of the existing illustration, not a pan/zoom of one picture.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import threading

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
CACHE = ROOT / 'output/imagegen/here-we-go-book-1'
DESTINATION = PUBLIC / 'images/vocabulary/here-we-go-book-1-gifs'
CATALOG = ROOT / 'src/data/hanlinHereWeGoBook1Animations.json'
MOTIONS = ROOT / 'scripts/data/hereWeGoBook1Motions.json'
VERSION = 1
COLS, ROWS = 3, 2
SHEET_SIZE = (1536, 1024)


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(value):
    return hashlib.sha256(value).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


@contextmanager
def generation_lock(path):
    # OS locks are released on interruption, so a stopped batch remains resumable.
    with path.open('a+b') as handle:
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise RuntimeError('A Here We Go! animation batch is already running.') from None
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def book_cards():
    course = next(course for course in read_json(ROOT / 'src/data/hanlinHereWeGoCourses.json') if course['book'] == 1)
    words = {card['w'].lower(): card for card in read_json(ROOT / 'src/data/hanlinHereWeGoWords.json')}
    return [words[word.lower()] for word in course['words']]


def slug(word):
    value = re.sub(r'[^a-z0-9]+', '-', word.lower()).strip('-')
    if not value:
        raise ValueError('Word has no safe asset filename')
    return value


def prompt_for(card, motion):
    return f'''Use case: illustration-story. Animation sprite sheet for an English vocabulary card.
Edit target: the supplied image is a 3-column by 2-row template containing SIX copies
of ONE original watercolor-pencil illustration. Keep this exact six-cell layout.
Vocabulary: {card['w']}; intended meaning: {card['m']}.
Original scene: {card['imageAlt']}
Example to preserve: {card['ex']} / {card['ez']}
Animate only this action: {motion}
Produce SIX consecutive keyframes, in reading order: top-left, top-middle,
top-right, bottom-left, bottom-middle, bottom-right. Move from a resting pose
through small, clearly different, natural action poses. These frames will also
play in reverse to form a gentle seamless loop. The subject must visibly move
or change pose; do not substitute camera panning, zooming, or global rotation.
Every cell must show the SAME complete scene, at the SAME scale, with the SAME
fixed camera, background, lighting, watercolor paper texture, colors and characters.
Preserve the original subject identity, facial features, clothing, object count,
anatomy, intended vocabulary meaning, and child-friendly hand-painted style.
No new characters, animals or props. Keep existing text/clock markings unchanged;
add no letters, words, numbers, labels, frame numbers, logos or watermarks.
Exact canvas: 1536 by 1024 pixels. Each cell is exactly 512 by 512 pixels.
No gutters, margins, grid lines, frame borders, collage effects or inset pictures.
Keep every subject fully inside its own cell. No object may cross a cell boundary.
The output is a production animation sheet, not a poster or storyboard.'''


def load_key():
    existing = os.environ.get('OPENAI_API_KEY', '').strip()
    if existing:
        return existing
    for filename in ['.env.local', '.env']:
        path = ROOT / filename
        if not path.exists():
            continue
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if line.lstrip().startswith('#') or '=' not in line:
                continue
            name, value = line.split('=', 1)
            if name.strip().removeprefix('export ') == 'OPENAI_API_KEY':
                value = value.strip().strip('"').strip("'")
                if value:
                    return value
    raise RuntimeError('OPENAI_API_KEY is not configured in the environment or local env file.')


def make_template(source, target):
    with Image.open(source) as image:
        tile = ImageOps.fit(image.convert('RGB'), (512, 512), method=Image.Resampling.LANCZOS)
    sheet = Image.new('RGB', SHEET_SIZE, '#faf7ef')
    for row in range(ROWS):
        for column in range(COLS):
            sheet.paste(tile, (column * 512, row * 512))
    sheet.save(target)


def pack_sprite(sheet_path, output_path, frame_size=320, duration_ms=160):
    with Image.open(sheet_path) as sheet:
        if sheet.size != SHEET_SIZE:
            raise ValueError(f'Expected a {SHEET_SIZE[0]}x{SHEET_SIZE[1]} sheet, received {sheet.size}.')
        rgb = sheet.convert('RGB')
        palette = rgb.resize((384, 256), Image.Resampling.LANCZOS).quantize(colors=128)
        poses = []
        for index in range(COLS * ROWS):
            x, y = (index % COLS) * 512, (index // COLS) * 512
            # Trim the cell edge so a model's faint cell separator is not visible.
            tile = rgb.crop((x + 3, y + 3, x + 509, y + 509)).resize((frame_size, frame_size), Image.Resampling.LANCZOS)
            poses.append(tile.quantize(palette=palette, dither=Image.Dither.NONE))
    if len({digest(frame.tobytes()) for frame in poses}) < 4:
        raise ValueError('The generated sheet contains fewer than four different poses.')
    frames = poses + poses[-2:0:-1]
    temporary = output_path.with_suffix('.gif.tmp')
    frames[0].save(temporary, format='GIF', save_all=True, append_images=frames[1:],
                   duration=duration_ms, loop=0, disposal=1, optimize=False)
    with Image.open(temporary) as animation:
        if animation.n_frames < 4:
            temporary.unlink()
            raise ValueError('The encoded asset is not a multi-frame GIF.')
        metadata = {'frameCount': animation.n_frames, 'width': animation.width, 'height': animation.height,
                    'frameDurationMs': duration_ms, 'durationMs': sum(animation.seek(i) or animation.info.get('duration', 0) for i in range(animation.n_frames))}
    temporary.replace(output_path)
    return {**metadata, 'sha256': digest(output_path.read_bytes()), 'bytes': output_path.stat().st_size}


def failure_reason(output):
    # Never forward raw SDK diagnostics, request bodies, or credentials to stdout.
    value = output.lower()
    if 'insufficient_quota' in value:
        return 'API quota or credits exhausted'
    if '401' in value or 'invalid_api_key' in value:
        return 'API authentication failed'
    if '403' in value or 'verification' in value:
        return 'Image model access or organization verification is required'
    if 'model_not_found' in value or '404' in value:
        return 'The selected image model is unavailable to this project'
    if '429' in value or 'rate_limit' in value:
        return 'Image API rate limit reached; rerun later to resume'
    if 'connection' in value or 'timeout' in value:
        return 'Image API connection failed or timed out'
    return 'Image edit failed; no generated asset was published'


def verify_entry(card, entry):
    if entry.get('poster') != card['img']:
        return False
    source = PUBLIC / card['img'].lstrip('/')
    asset = PUBLIC / entry.get('src', '').lstrip('/')
    if not source.is_file() or not asset.is_file() or entry.get('sourceSha256') != digest(source.read_bytes()):
        return False
    if entry.get('sha256') != digest(asset.read_bytes()):
        return False
    try:
        with Image.open(asset) as image:
            if image.format != 'GIF' or image.n_frames != entry['frameCount'] or image.n_frames < 4 or image.size != (entry['width'], entry['height']):
                return False
            duration = 0
            for index in range(image.n_frames):
                image.seek(index)
                image.load()
                duration += image.info.get('duration', 0)
            return duration == entry['durationMs']
    except (OSError, KeyError):
        return False


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--words', nargs='+', help='Only selected words; quote phrases such as "how old".')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--concurrency', type=int, default=2)
    parser.add_argument('--model', default='gpt-image-2')
    parser.add_argument('--quality', choices=['low', 'medium', 'high'], default='medium')
    parser.add_argument('--frame-size', type=int, default=320)
    parser.add_argument('--frame-duration-ms', type=int, default=160)
    parser.add_argument('--image-cli', type=Path, default=Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')) / 'skills/.system/imagegen/scripts/image_gen.py')
    parser.add_argument('--dry-run', action='store_true', help='List work without loading credentials, writing files or calling the API.')
    parser.add_argument('--verify', action='store_true', help='Validate every selected GIF without making API calls.')
    parser.add_argument('--pack-only', action='store_true', help='Rebuild GIFs from cached AI sprite sheets without making API calls.')
    parser.add_argument('--force', action='store_true', help='Regenerate selected AI sheets, including already completed words.')
    args = parser.parse_args(argv)
    if not 1 <= args.concurrency <= 4 or not 128 <= args.frame_size <= 512 or not 20 <= args.frame_duration_ms <= 2000 or args.frame_duration_ms % 10:
        parser.error('Use concurrency 1–4, frame size 128–512, and a frame duration of 20–2000 ms divisible by 10.')
    if args.limit is not None and args.limit < 1:
        parser.error('--limit must be positive')
    cards = book_cards()
    if args.words:
        requested = {word.lower() for word in args.words}
        unknown = requested - {card['w'].lower() for card in cards}
        if unknown:
            parser.error('Not in Here We Go! Book 1: ' + ', '.join(sorted(unknown)))
        cards = [card for card in cards if card['w'].lower() in requested]
    if args.limit:
        cards = cards[:args.limit]
    motions = read_json(MOTIONS)
    catalog = read_json(CATALOG) if CATALOG.exists() else {'version': VERSION, 'book': 1, 'animations': {}}
    if args.verify:
        invalid = [card['w'] for card in cards if not verify_entry(card, catalog['animations'].get(card['w'].lower(), {}))]
        print(json.dumps({'checked': len(cards), 'valid': len(cards) - len(invalid), 'missingOrInvalid': invalid}))
        return int(bool(invalid))
    if args.dry_run:
        print(json.dumps({'book': 1, 'words': len(cards), 'model': args.model, 'apiEditsAtMost': len(cards),
                          'output': str(DESTINATION), 'selected': [card['w'] for card in cards]}, indent=2))
        return 0
    key = None if args.pack_only else load_key()
    if not args.pack_only and not args.image_cli.is_file():
        raise RuntimeError('Installed ImageGen CLI not found; provide --image-cli with its path.')
    CACHE.mkdir(parents=True, exist_ok=True)
    DESTINATION.mkdir(parents=True, exist_ok=True)
    cancelled = threading.Event()
    environment = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
    if key:
        environment['OPENAI_API_KEY'] = key

    def generate(card):
        if cancelled.is_set():
            return None
        word, name = card['w'].lower(), slug(card['w'])
        source = PUBLIC / card['img'].lstrip('/')
        prompt = prompt_for(card, motions[word])
        fingerprint = digest(json.dumps({'version': VERSION, 'source': digest(source.read_bytes()),
            'prompt': prompt, 'model': args.model, 'quality': args.quality,
            'frameSize': args.frame_size, 'duration': args.frame_duration_ms}, sort_keys=True).encode())
        previous = catalog['animations'].get(word, {})
        if not args.force and previous.get('fingerprint') == fingerprint and verify_entry(card, previous):
            print(f'[{word}] cached', flush=True)
            return word, previous
        sheet = CACHE / f'{name}-frames.png'
        metadata = CACHE / f'{name}-generation.json'
        sheet_fingerprint = digest(json.dumps({'source': digest(source.read_bytes()), 'prompt': prompt,
            'model': args.model, 'quality': args.quality}, sort_keys=True).encode())
        reusable = sheet.is_file() and metadata.is_file() and read_json(metadata).get('fingerprint') == sheet_fingerprint
        if args.force or not reusable:
            if args.pack_only:
                raise RuntimeError(f'[{word}] matching AI sheet is not cached')
            template = CACHE / f'{name}-template.png'
            prompt_path = CACHE / f'{name}-prompt.txt'
            make_template(source, template)
            prompt_path.write_text(prompt, encoding='utf-8')
            print(f'[{word}] generating six motion poses', flush=True)
            command = [sys.executable, str(args.image_cli), 'edit', '--image', str(template),
                       '--model', args.model, '--quality', args.quality, '--size', '1536x1024',
                       '--output-format', 'png', '--prompt-file', str(prompt_path),
                       '--out', str(sheet), '--no-augment', '--force']
            result = subprocess.run(command, env=environment, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
            if result.returncode:
                cancelled.set()
                raise RuntimeError(f'[{word}] {failure_reason(result.stderr + result.stdout)}')
            write_json(metadata, {'fingerprint': sheet_fingerprint, 'model': args.model, 'source': card['img'], 'prompt': prompt})
        output = DESTINATION / f'{name}.gif'
        info = pack_sprite(sheet, output, args.frame_size, args.frame_duration_ms)
        entry = {**info, 'src': '/' + output.relative_to(PUBLIC).as_posix(), 'poster': card['img'],
                 'sourceSha256': digest(source.read_bytes()), 'fingerprint': fingerprint,
                 'model': args.model, 'motion': motions[word]}
        print(f'[{word}] ready: {info["frameCount"]} frames, {info["bytes"]:,} bytes', flush=True)
        return word, entry

    failures = []
    with generation_lock(CACHE / '.generation.lock'), ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        catalog = read_json(CATALOG) if CATALOG.exists() else {'version': VERSION, 'book': 1, 'animations': {}}
        futures = {executor.submit(generate, card): card['w'] for card in cards}
        for future in as_completed(futures):
            try:
                result = future.result()
                if result:
                    word, entry = result
                    if catalog['animations'].get(word) != entry:
                        catalog['animations'][word] = entry
                        catalog['animations'] = dict(sorted(catalog['animations'].items()))
                        write_json(CATALOG, catalog)
            except Exception as error:
                cancelled.set()
                message = str(error)
                if key:
                    message = message.replace(key, '[redacted]')
                failures.append({'word': futures[future], 'reason': message})
                print(message, file=sys.stderr, flush=True)
    print(json.dumps({'ready': len(catalog['animations']), 'totalBookWords': len(book_cards()), 'failures': failures}))
    return int(bool(failures))


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
