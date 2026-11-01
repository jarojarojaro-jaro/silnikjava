#!/usr/bin/env python3
"""Film wokselowy w ASCII: scena → świat → render 3D → animacja → filtr ASCII → MP4.

  python3 run.py lighthouse --preview 8            # podgląd jednej klatki (surowy 3D + ASCII)
  python3 run.py lighthouse --sheet                # arkusz 6 klatek z całego filmu
  python3 run.py lighthouse --video                # pełny film (MP4, 1080×1920)
  python3 run.py lighthouse --variant noc --video  # wariant sceny (nadpisuje konfigurację)
  python3 run.py shrine --video --seconds 8        # krótszy film testowy

Wyniki: out/voxel-ascii/<scena>[-wariant]/ (względem bieżącego katalogu, chyba że --out).
Świat i render statyczny są w cache: zmiana samego wyglądu (look) nie liczy cieni od nowa;
zmiana świata albo oświetlenia (light, camera) liczy je od nowa, --force wymusza wszystko.
"""
import argparse
import ast
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from voxlib.look import Look, merge  # noqa: E402
from voxlib.render import render_static  # noqa: E402

_LOOK = None


def _frame(i):
    return _LOOK.frame(i)


def load_scene(name):
    path = name if name.endswith('.py') else os.path.join(HERE, 'scenes', f'{name}.py')
    spec = importlib.util.spec_from_file_location('scene', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod, os.path.splitext(os.path.basename(path))[0]


def digest(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True, default=list).encode()).hexdigest()[:12]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('scene')
    ap.add_argument('--variant')
    ap.add_argument('--preview', type=float, nargs='*')
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--video', action='store_true')
    ap.add_argument('--seconds', type=float)
    ap.add_argument('--out')
    ap.add_argument('--jobs', type=int, default=min(4, os.cpu_count() or 1))
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()

    scene, name = load_scene(a.scene)
    cfg = merge(scene.CONFIG, getattr(scene, 'VARIANTS', {}).get(a.variant, {})) if a.variant else dict(scene.CONFIG)
    if a.variant and a.variant not in getattr(scene, 'VARIANTS', {}):
        sys.exit(f'nieznany wariant {a.variant!r}; dostępne: {list(getattr(scene, "VARIANTS", {}))}')
    if a.seconds:
        cfg['look'] = merge(cfg.get('look', {}), {'seconds': a.seconds})
    tag = name + (f'-{a.variant}' if a.variant else '')
    out = a.out or os.path.join('out', 'voxel-ascii', tag)
    os.makedirs(out, exist_ok=True)
    wdir = os.path.join(os.path.dirname(out), name + '-cache')
    os.makedirs(wdir, exist_ok=True)

    t0 = time.time()
    # 1. świat (zależy tylko od sceny)
    world_path = os.path.join(wdir, 'world.npz')
    # klucz cache: plik sceny + kod, od którego zależy świat; render dokłada render.py
    def src_hash(*paths):
        h = hashlib.sha1()
        for p in paths:
            h.update(open(p, 'rb').read())
        return h.hexdigest()[:12]
    lib = os.path.join(HERE, 'voxlib')
    # świat zależy od kodu sceny bez CONFIG/VARIANTS: zmiana wyglądu wariantu nie przelicza świata
    tree = ast.parse(open(scene.__file__).read())
    tree.body = [n for n in tree.body if not (isinstance(n, ast.Assign) and
                                              any(getattr(t, 'id', '') in ('CONFIG', 'VARIANTS') for t in n.targets))]
    scene_code = hashlib.sha1(ast.unparse(tree).encode()).hexdigest()
    src_key = hashlib.sha1((scene_code + src_hash(os.path.join(lib, 'world.py'), os.path.join(lib, 'materials.py'))).encode()).hexdigest()[:12]
    render_key = src_hash(os.path.join(lib, 'render.py'))
    key_file = os.path.join(wdir, 'world.key')
    old_key = open(key_file).read() if os.path.exists(key_file) else None
    if a.force or not os.path.exists(world_path) or old_key != src_key:
        print(f'[{tag}] buduję świat…', flush=True)
        w = scene.build()
        w.save(world_path)
        open(key_file, 'w').write(src_key)
    # 2. render statyczny (świat + kamera + światło)
    skey = digest({'world': src_key, 'render': render_key, 'camera': cfg['camera'], 'light': cfg['light']})
    static_path = os.path.join(wdir, f'static-{skey}.npz')
    if a.force or not os.path.exists(static_path):
        print(f'[{tag}] render 3D (promienie, cienie, okluzja)…', flush=True)
        render_static(world_path, cfg, static_path, log=lambda m: print(f'[{tag}]{m}', flush=True))
    global _LOOK
    _LOOK = Look(static_path, cfg)
    L = _LOOK
    fps, secs = L.o['fps'], L.o['seconds']

    if a.preview is not None:
        for t in (a.preview or [secs * 0.4]):
            fr, raw = L.frame(int(t * fps), raw=True)
            Image.fromarray((raw * 255).astype(np.uint8)).save(os.path.join(out, f'raw_{t:05.1f}.png'))
            Image.fromarray(fr).save(os.path.join(out, f'ascii_{t:05.1f}.png'))
            print(f'[{tag}] podgląd t={t}s → {out}', flush=True)
    if a.sheet:
        ts = [secs * k / 6 for k in range(6)]
        frames = [Image.fromarray(L.frame(int(t * fps))).resize((360, 640), Image.LANCZOS) for t in ts]
        sheet = Image.new('RGB', (360 * 6, 640))
        for k, f in enumerate(frames):
            sheet.paste(f, (360 * k, 0))
        sheet.save(os.path.join(out, 'sheet.png'))
        print(f'[{tag}] arkusz → {out}/sheet.png', flush=True)
    if a.video:
        from multiprocessing import Pool
        n = int(fps * secs)
        W, H = L.o['out']
        mp4 = os.path.join(out, f'{tag}.mp4')
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                               '-r', str(fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16',
                               '-preset', 'slow', '-movflags', '+faststart', mp4], stdin=subprocess.PIPE)
        t1 = time.time()
        with Pool(a.jobs) as pool:
            for k, fr in enumerate(pool.imap(_frame, range(n), chunksize=2)):
                ff.stdin.write(fr.tobytes())
                if k % 60 == 0:
                    print(f'[{tag}]  klatka {k}/{n}  {time.time() - t1:.0f}s', flush=True)
        ff.stdin.close()
        ff.wait()
        print(f'[{tag}] film → {mp4}', flush=True)
    print(f'[{tag}] razem {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
