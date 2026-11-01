"""Testy biblioteki voxel-ascii (bez renderu całego filmu, kilka sekund).

  python3 -m unittest discover -s .claude/skills/voxel-ascii/tests -v
"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voxlib import materials as M  # noqa: E402
from voxlib.look import ascii_pass, build_atlas, edge_glyph, merge  # noqa: E402
from voxlib.render import Camera, ao_corner, primary, shadow  # noqa: E402
from voxlib.world import World  # noqa: E402


class CameraTest(unittest.TestCase):
    def test_project_unproject_roundtrip(self):
        cam = Camera(30, 55, 10, (100, 120, 12), (640, 960))
        rng = np.random.default_rng(1)
        for _ in range(50):
            x, y, z = rng.uniform(0, 200), rng.uniform(0, 200), rng.uniform(0, 40)
            px, py = cam.project(x, y, z)
            ux, uy = cam.unproject(px - 0.5, py - 0.5, z)
            self.assertAlmostEqual(ux, x, places=6)
            self.assertAlmostEqual(uy, y, places=6)

    def test_view_points_to_camera(self):
        cam = Camera(30, 55)
        self.assertTrue((cam.view > 0).all())
        self.assertAlmostEqual(float(np.linalg.norm(cam.view)), 1.0, places=9)


class RayTest(unittest.TestCase):
    def setUp(self):
        self.g = np.zeros((16, 16, 16), np.uint8)
        self.g[:, :, 0] = M.GRASS
        self.g[8, 8, 1:4] = M.STONE  # słupek 1×1, góra na z = 4

    def hit_at(self, point):
        cam = Camera(30, 55, 10, (8, 8, 2), (64, 64))
        px, py = cam.project(*point)
        row = int(py)
        mat, axis, P, C = primary(self.g, cam, rows=(row, row + 1))
        return mat[int(px)], axis[int(px)], P[int(px)], C[int(px)]

    def test_top_face(self):
        mat, axis, P, C = self.hit_at((8.5, 8.5, 4.0))
        self.assertEqual(mat, M.STONE)
        self.assertEqual(axis, 2)
        self.assertAlmostEqual(float(P[2]), 4.0, places=3)

    def test_side_faces_facing_camera(self):
        mat, axis, P, C = self.hit_at((9.0, 8.5, 2.5))   # ściana +x
        self.assertEqual((mat, axis), (M.STONE, 0))
        mat, axis, P, C = self.hit_at((8.5, 9.0, 2.5))   # ściana +y
        self.assertEqual((mat, axis), (M.STONE, 1))

    def test_ground_next_to_column(self):
        mat, axis, P, C = self.hit_at((3.5, 3.5, 1.0))
        self.assertEqual((mat, axis), (M.GRASS, 2))
        self.assertEqual(tuple(C), (3, 3, 0))


class LightTest(unittest.TestCase):
    def test_shadow_under_slab(self):
        occ = np.zeros((16, 16, 16), bool)
        occ[:, :, 0] = True
        occ[6:10, 6:10, 5] = True
        P = np.array([[8.0, 8.0, 1.02], [2.0, 2.0, 1.02]])
        lit = shadow(occ, P, np.array([0.0, 0.0, 1.0]))
        self.assertEqual(lit.tolist(), [0.0, 1.0])

    def test_ao_open_and_corner(self):
        occ = np.zeros((8, 8, 8), bool)
        occ[:, :, 0] = True
        C = np.array([[4, 4, 0]])
        open_ = ao_corner(occ, C, np.array([2]))
        self.assertTrue(all(v[0] == 1.0 for v in open_.values()))
        occ[5, 4, 1] = True  # klocek obok, po stronie +x
        k = ao_corner(occ, C, np.array([2]))
        self.assertLess(k[1, -1][0], 1.0)
        self.assertLess(k[1, 1][0], 1.0)
        self.assertEqual(k[-1, -1][0], 1.0)


class AsciiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas, cls.glyphs, cls.cov = build_atlas(6, 10)

    def test_ramp_grows_with_coverage(self):
        self.assertEqual(len(self.glyphs), 20)
        self.assertTrue(all(b >= a for a, b in zip(self.cov, self.cov[1:])))
        self.assertEqual(self.glyphs[16:], '-/|\\')

    def test_edge_glyph_angles(self):
        got = edge_glyph(np.array([0.0, 45.0, 90.0, 135.0, 179.0]))
        self.assertEqual([self.glyphs[i] for i in got], ['-', '\\', '|', '/', '-'])

    def test_diagonal_line_becomes_slash(self):
        img = np.zeros((300, 300, 3), np.float32) + 0.05
        for k in range(-3, 4):  # jasna linia z lewego dołu w prawą górę
            for i in range(300):
                j = 299 - i + k
                if 0 <= j < 300:
                    img[j, i] = 0.9
        o = dict(cell=(6, 10), bg=0.5, fg=1.5, sat=1.0, edge=0.05, coherence=0.6, dither=0.0)
        _, idx = ascii_pass(img, self.atlas, o)
        edges = idx[idx >= 16]
        self.assertGreater(edges.size, 10)
        self.assertEqual(int(np.bincount(edges).argmax()), self.glyphs.index('/'))


class ConfigAndWorldTest(unittest.TestCase):
    def test_merge_is_deep(self):
        a = dict(look=dict(water=dict(sky=1, glint=2), seconds=20))
        b = dict(look=dict(water=dict(sky=5)))
        m = merge(a, b)
        self.assertEqual(m['look']['water'], dict(sky=5, glint=2))
        self.assertEqual(m['look']['seconds'], 20)
        self.assertEqual(a['look']['water']['sky'], 1)

    def test_objects(self):
        w = World(64, 64, 48, water_level=4, seed=2)
        w.g[:, :, :6] = M.GRASS
        w.H[:] = 6
        w.stone_lantern(20, 20)
        self.assertTrue((w.g == M.PAPER_LIGHT).any())
        self.assertEqual(len(w.lights), 1)
        w.torii(30, 40, 30, 6)
        self.assertTrue((w.g[30:32, 30:32, 6:20] == M.LACQUER).any())
        floor = w.finalize()
        self.assertEqual(floor[5, 5], 6)


if __name__ == '__main__':
    unittest.main()
