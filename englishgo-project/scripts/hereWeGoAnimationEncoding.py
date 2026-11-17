"""Stabilize a cyclic set of animation poses and render motion-compensated inbetweens.

This module only encodes locally generated artwork; it never calls an API.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image
from pathlib import Path
import subprocess
import tempfile
import threading

RIFE_LOCK = threading.Lock()
cv2.setNumThreads(1)


def stabilize_poses(poses):
    """Remove small camera shifts and freeze paper/paint that does not move."""
    reference = np.asarray(poses[0]).copy()
    reference_gray = cv2.cvtColor(reference, cv2.COLOR_RGB2GRAY)
    aligned = [reference]
    for pose in poses[1:]:
        current = np.asarray(pose).copy()
        transform = np.eye(2, 3, dtype=np.float32)
        try:
            _, transform = cv2.findTransformECC(
                reference_gray, cv2.cvtColor(current, cv2.COLOR_RGB2GRAY),
                transform, cv2.MOTION_TRANSLATION,
                (cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 60, 0.0001), None, 5)
            if np.max(np.abs(transform[:, 2])) <= reference.shape[0] * 0.035:
                current = cv2.warpAffine(current, transform, reference.shape[:2][::-1],
                    flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT_101)
        except cv2.error:
            # Textureless paper can make registration singular; keep its original placement.
            pass
        aligned.append(current)
    blurred = np.stack([cv2.GaussianBlur(frame, (5, 5), 0).astype(np.float32) for frame in aligned])
    variation = np.max(np.max(blurred, axis=0) - np.min(blurred, axis=0), axis=2)
    moving = np.uint8(variation > 22) * 255
    moving = cv2.morphologyEx(moving, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    moving = cv2.dilate(moving, np.ones((7, 7), np.uint8))
    alpha = cv2.GaussianBlur(moving.astype(np.float32) / 255, (9, 9), 0)[..., None]
    return [np.uint8(np.clip(frame * alpha + reference * (1 - alpha), 0, 255)) for frame in aligned]


def interpolate_cycle(poses, steps, rife_cli, work_dir):
    """RIFE handles occlusions; the extra first pose closes the forward-only loop."""
    rife_cli = Path(rife_cli).resolve()
    model = rife_cli.parent / 'rife-v4.6'
    if not rife_cli.is_file() or not (model / 'flownet.bin').is_file():
        raise RuntimeError('Install rife-ncnn-vulkan with its rife-v4.6 model; see the animation guide.')
    with tempfile.TemporaryDirectory(prefix='rife-encode-', dir=work_dir) as directory:
        root = Path(directory)
        source, destination = root / 'input', root / 'frames'
        source.mkdir()
        destination.mkdir()
        for index, pose in enumerate(poses + [poses[0]]):
            Image.fromarray(pose).save(source / f'{index:08}.png')
        # The CLI uses input_count / output_count, NOT (N-1) / (M-1).
        # 17 * 4 gives exact quarter-pose timestamps; discard the final repeated hold.
        output_count = (len(poses) + 1) * steps
        command = [str(rife_cli), '-i', str(source), '-o', str(destination),
                   '-n', str(output_count), '-m', str(model), '-j', '1:1:1', '-z']
        with RIFE_LOCK:
            result = subprocess.run(command, capture_output=True, timeout=600)
        files = sorted(destination.glob('*.png'))
        if result.returncode or len(files) != output_count or b'failed' in result.stderr.lower():
            raise RuntimeError('RIFE did not render every frame; no GIF was published.')
        frames = []
        for index, path in enumerate(files):
            with Image.open(path) as frame:
                frame.load()
                if frame.size != poses[0].shape[:2][::-1]:
                    raise ValueError('RIFE produced a wrongly sized frame.')
                if index < len(poses) * steps:
                    frames.append(frame.convert('RGB'))
        return frames


def frame_metrics(frames):
    arrays = [np.asarray(frame.convert('RGB'), dtype=np.float32) for frame in frames]
    changes = [float(np.mean(np.abs(frame - arrays[(index + 1) % len(arrays)])))
               for index, frame in enumerate(arrays)]
    return {'meanFrameDifference': round(float(np.mean(changes)), 4),
            'maxFrameDifference': round(max(changes), 4),
            'loopSeamDifference': round(changes[-1], 4)}


def render_cycle(poses, steps, rife_cli, work_dir):
    frames = interpolate_cycle(stabilize_poses(poses), steps, rife_cli, work_dir)
    # One 256-color palette for the whole cycle avoids per-frame color flicker.
    sample = Image.new('RGB', (128 * len(poses), 128))
    for index, pose in enumerate(poses):
        sample.paste(pose.resize((128, 128), Image.Resampling.LANCZOS), (index * 128, 0))
    palette = sample.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    return [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
