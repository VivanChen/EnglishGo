"""Generate the Doodle Brawl sprites with the OpenAI image API.

Every sprite is a transparent PNG from the model, trimmed to its figure and
saved as a square WebP under public/images/doodle-brawl/. Raw PNGs are cached
in tmp/doodle-brawl-art/ so a rerun only pays for missing or changed images.

    python scripts/generateDoodleBrawlArt.py            # missing images only
    python scripts/generateDoodleBrawlArt.py --only sketch,blot
    python scripts/generateDoodleBrawlArt.py --pack-only # reprocess cached PNGs
"""
import argparse
import base64
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public' / 'images' / 'doodle-brawl'
CACHE = ROOT / 'tmp' / 'doodle-brawl-art'

STYLE = ('Cute hand-drawn doodle sticker for a children\'s arcade game. Bold black felt-tip ink outline with '
         'slightly wobbly hand-drawn lines, flat bright marker coloring with a little crayon texture, simple '
         'readable shapes, playful and friendly, one single centered subject, fully visible and not cropped, '
         'no text, no letters, no numbers, no border, no ground shadow, transparent background.')

CHARACTER = 'Front-facing full-body character seen from slightly above, standing, as a top-down game sprite.'
ENEMY = ('Front-facing full-body monster seen from slightly above, as a top-down game sprite. The monster is mischievous '
         'rather than scary, made of ink and pen strokes.')
WEAPON = 'A single object lying horizontally and pointing to the right, seen from the side, as a game weapon icon.'
ITEM = 'A single object, slightly tilted, as a game inventory icon.'

# (folder, id, size, kind prompt, subject)
ART = [
    ('heroes', 'sketch', 384, CHARACTER, 'Sketch: a small round cream-white marshmallow-shaped doodle hero with big sparkly friendly eyes, a red scarf, short stubby arms and legs, and a tiny yellow pencil tucked behind its head.'),
    ('heroes', 'brick', 384, CHARACTER, 'Brick: a sturdy square pink rubber-eraser creature with thick eyebrows, a determined smile, a bandage on its cheek and strong little arms.'),
    ('heroes', 'zip', 384, CHARACTER, 'Zip: a slim sky-blue lightning-bolt shaped paper creature wearing tiny red sneakers, cheeky grin, a few speed lines beside it.'),
    ('heroes', 'lucky', 384, CHARACTER, 'Lucky: a chubby golden-yellow five-pointed star creature with rosy cheeks, happy closed-eye smile and a green four-leaf clover sprouting on its head.'),

    ('enemies', 'scribble', 320, ENEMY, 'Scribble: a tangled round ball of black ballpoint-pen scribbles with two angry white round eyes and tiny stick feet.'),
    ('enemies', 'blot', 320, ENEMY, 'Blot: a big wobbly blob of dark navy-blue ink with drippy edges and droplets, half-closed grumpy eyes, very round and heavy.'),
    ('enemies', 'dash', 320, ENEMY, 'Dash: a sharp arrow-shaped creature drawn in red marker, leaning forward ready to charge, fierce narrow eyes, speed lines behind it.'),
    ('enemies', 'nib', 320, ENEMY, 'Nib: a little walking fountain-pen nib creature in purple and silver, with tiny legs, its tip dripping purple ink, one big eye.'),
    ('enemies', 'twinblot', 320, ENEMY, 'Twinblot: a bright green ink blob with a zigzag crack down the middle and two small faces, one on each half, about to split in two.'),
    ('enemies', 'grumble', 448, ENEMY, 'Grumble Cloud: a huge dark-grey storm cloud made of crayon scribbles with a grumpy frowning face and drops of ink raining from its bottom.'),
    ('enemies', 'quill', 448, ENEMY, 'Quill Knight: an elite knight made of folded white paper armor with a long teal feather quill plume on its helmet, holding a fountain-pen lance, glowing eyes.'),
    ('enemies', 'king', 512, ENEMY, 'The Ink King: a giant crowned glass ink-bottle monster full of dark blue ink, a golden crown, a cape of spilled ink, glowing yellow eyes, two curling ink tentacle arms.'),

    ('weapons', 'pencil', 256, WEAPON, 'A yellow wooden pencil with a sharp graphite tip and a pink eraser end.'),
    ('weapons', 'crayon', 256, WEAPON, 'A thick orange wax crayon with a paper wrapper and a pointed tip.'),
    ('weapons', 'stapler', 256, WEAPON, 'A red office stapler, closed, side view.'),
    ('weapons', 'plane', 256, WEAPON, 'A folded white paper airplane with a blue stripe, flying to the right.'),
    ('weapons', 'slingshot', 256, WEAPON, 'A wooden Y-shaped slingshot with a stretched green rubber band.'),
    ('weapons', 'ruler', 256, WEAPON, 'A long light-blue plastic ruler with measurement tick marks and no numbers.'),
    ('weapons', 'scissors', 256, WEAPON, 'A pair of scissors with purple handles, blades slightly open, pointing right.'),
    ('weapons', 'eraser', 256, WEAPON, 'A big chunky pink and blue rubber eraser block.'),
    ('weapons', 'highlighter', 256, WEAPON, 'A neon yellow highlighter pen with its cap off, chisel tip pointing right.'),
    ('weapons', 'glue', 256, WEAPON, 'A green hot glue gun with a clear glue stick, nozzle pointing right.'),

    ('items', 'snack', 256, ITEM, 'A small bag of crunchy snack crackers.'),
    ('items', 'sneakers', 256, ITEM, 'A pair of white and red running sneakers.'),
    ('items', 'helmet', 256, ITEM, 'A yellow bicycle safety helmet.'),
    ('items', 'juice', 256, ITEM, 'An orange juice box with a bendy straw.'),
    ('items', 'magnifier', 256, ITEM, 'A round magnifying glass with a wooden handle.'),
    ('items', 'coin', 256, ITEM, 'A shiny gold coin with a four-leaf clover stamped on it.'),
    ('items', 'clock', 256, ITEM, 'A red twin-bell alarm clock.'),
    ('items', 'sticker', 256, ITEM, 'A shiny gold star sticker peeling at one corner.'),
    ('items', 'gum', 256, ITEM, 'A big pink bubble-gum bubble with a wrapped gum piece next to it.'),
    ('items', 'piggy', 256, ITEM, 'A pink piggy bank with a coin slot.'),
    ('items', 'pillow', 256, ITEM, 'A fluffy light-blue pillow with stitched edges.'),
    ('items', 'backpack', 256, ITEM, 'A red school backpack with a front pocket.'),
    ('items', 'raincoat', 256, ITEM, 'A bright yellow hooded raincoat.'),
    ('items', 'magnet', 256, ITEM, 'A red and silver horseshoe magnet.'),
    ('items', 'sauce', 256, ITEM, 'A red hot sauce bottle with a chili pepper label drawing.'),
    ('items', 'lunchbox', 256, ITEM, 'A green lunchbox, open, with a sandwich, an apple and cookies inside.'),
    ('items', 'flashlight', 256, ITEM, 'A blue flashlight shining a small cone of yellow light.'),
    ('items', 'skateboard', 256, ITEM, 'A purple skateboard with orange wheels.'),
    ('items', 'firecracker', 256, ITEM, 'A red firecracker with a lit sparkling fuse.'),
    ('items', 'bandage', 256, ITEM, 'Two crossed beige adhesive bandages.'),
    ('items', 'robot', 256, ITEM, 'A small silver tin wind-up toy robot with a key on its back and a little cannon arm.'),
    ('items', 'trophy', 256, ITEM, 'A shiny golden trophy cup with two handles.'),
    ('items', 'umbrella', 256, ITEM, 'An open red and white striped umbrella.'),
    ('items', 'lollipop', 256, ITEM, 'A big rainbow swirl lollipop.'),
    ('items', 'telescope', 256, ITEM, 'A brass and navy telescope.'),
    ('items', 'clover', 256, ITEM, 'A bright green four-leaf clover with a sparkle.'),
    ('items', 'crown', 256, ITEM, 'A golden crown with red and blue gems.'),
    ('items', 'rocket', 256, ITEM, 'A pair of red sneakers with small rocket boosters and orange flames.'),
    ('items', 'goldpen', 256, ITEM, 'An elegant golden fountain pen with a sparkle.'),
    ('items', 'kite', 256, ITEM, 'A red Chinese dragon kite with a long ribbon tail.'),

    ('pickups', 'cookie', 128, ITEM, 'A round chocolate-chip cookie.'),
    ('pickups', 'crate', 192, ITEM, 'A small wooden treasure crate tied with a red ribbon and a big question mark shape made of stars on the lid, no letters.'),
]

KEY_ART = ('key', 'title', None, None,
           'Wide illustration for a children\'s arcade game title screen, drawn as colorful doodles on a sheet of '
           'blue-lined notebook paper: four cute doodle heroes (a round cream marshmallow hero with a red scarf, '
           'a pink square eraser creature, a blue lightning-bolt creature in red sneakers, a yellow star creature '
           'with a clover) bravely facing a crowd of mischievous black ink-scribble monsters and blue ink blobs, '
           'pencils and paper planes flying, stars sparkling, bold felt-tip ink outlines and bright marker colors, '
           'lots of energy, no text, no letters.')


def api_key():
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    if key:
        return key
    for name in ('.env.local', '.env'):
        path = ROOT / name
        if path.is_file():
            for line in path.read_text(encoding='utf-8').splitlines():
                if '=' in line:
                    k, v = line.split('=', 1)
                    if k.strip().removeprefix('export ') == 'OPENAI_API_KEY':
                        return v.strip().strip('"\'')
    raise RuntimeError('OPENAI_API_KEY is not configured in the environment or .env.local.')


def prompt_for(entry):
    folder, _, _, kind, subject = entry
    if folder == 'key':
        return subject
    return f'{subject} {kind} {STYLE}'


def generate(entry, key, model, quality):
    folder, name = entry[0], entry[1]
    prompt = prompt_for(entry)
    fingerprint = hashlib.sha256(json.dumps([prompt, model, quality]).encode()).hexdigest()[:16]
    raw = CACHE / f'{folder}-{name}.png'
    meta = CACHE / f'{folder}-{name}.json'
    if raw.is_file() and meta.is_file() and json.loads(meta.read_text()).get('fingerprint') == fingerprint:
        return entry, 'cached'
    body = {'model': model, 'prompt': prompt, 'n': 1, 'quality': quality, 'output_format': 'png'}
    if folder == 'key':
        body.update(size='1536x1024', background='opaque')
    else:
        body.update(size='1024x1024', background='transparent')
    request = urllib.request.Request('https://api.openai.com/v1/images/generations', data=json.dumps(body).encode(),
                                     headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                data = json.loads(response.read())
            break
        except urllib.error.HTTPError as error:
            detail = error.read().decode('utf-8', 'replace')[:400]
            if error.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(8 * (attempt + 1))
                continue
            raise RuntimeError(f'{folder}/{name}: HTTP {error.code} {detail}') from None
    raw.write_bytes(base64.b64decode(data['data'][0]['b64_json']))
    meta.write_text(json.dumps({'fingerprint': fingerprint, 'model': model, 'quality': quality, 'prompt': prompt}, indent=1))
    return entry, 'generated'


def pack(entry):
    folder, name, size = entry[0], entry[1], entry[2]
    raw = CACHE / f'{folder}-{name}.png'
    image = Image.open(raw).convert('RGBA')
    PUBLIC.mkdir(parents=True, exist_ok=True)
    if folder == 'key':
        out = PUBLIC / 'title.webp'
        image.convert('RGB').resize((1200, 800), Image.Resampling.LANCZOS).save(out, 'WEBP', quality=80, method=6)
        return out
    # Drop near-invisible fringe pixels, then trim to the figure and centre it
    # in a square with a small margin so every sprite has the same footprint.
    alpha = image.getchannel('A').point(lambda a: 0 if a < 12 else a)
    image.putalpha(alpha)
    box = alpha.getbbox() or (0, 0, *image.size)
    figure = image.crop(box)
    side = int(max(figure.size) * 1.06)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(figure, ((side - figure.width) // 2, (side - figure.height) // 2))
    canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    target = PUBLIC / folder
    target.mkdir(parents=True, exist_ok=True)
    out = target / f'{name}.webp'
    canvas.save(out, 'WEBP', quality=86, method=6)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='gpt-image-1.5')
    parser.add_argument('--quality', choices=['low', 'medium', 'high'], default='medium')
    parser.add_argument('--only', default='')
    parser.add_argument('--concurrency', type=int, default=4)
    parser.add_argument('--pack-only', action='store_true')
    args = parser.parse_args()
    entries = ART + [KEY_ART]
    if args.only:
        wanted = {item.strip() for item in args.only.split(',') if item.strip()}
        entries = [entry for entry in entries if entry[1] in wanted]
    CACHE.mkdir(parents=True, exist_ok=True)
    failures = []
    if not args.pack_only:
        key = api_key()
        with ThreadPoolExecutor(max_workers=max(1, min(args.concurrency, 6))) as pool:
            jobs = [pool.submit(generate, entry, key, args.model, args.quality) for entry in entries]
            for job in as_completed(jobs):
                try:
                    entry, status = job.result()
                    print(f'[{entry[0]}/{entry[1]}] {status}', flush=True)
                except Exception as error:  # keep going; report at the end
                    failures.append(str(error))
                    print(f'FAILED {error}', flush=True)
    for entry in entries:
        if (CACHE / f'{entry[0]}-{entry[1]}.png').is_file():
            out = pack(entry)
            print(f'packed {out.relative_to(ROOT)} {out.stat().st_size // 1024} KB', flush=True)
    if failures:
        print(f'{len(failures)} failed', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
