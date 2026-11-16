# Run from the repo root: python3 tools/paper.py
# Makes the site's paper: two seamless tiles to multiply over any paper colour.
#   paper-grain.png  the tooth: fine fibre relief lit from the upper left, with a few loose fibres
#   paper-cloud.png  the slow unevenness of a sheet's thickness, at a much larger scale
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
rng = np.random.default_rng(2611)

def spectral(n, shape):
    """Tileable noise whose spectrum is given by shape(radial frequency, angle)."""
    f = np.fft.fft2(rng.standard_normal((n, n)))
    fy, fx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing="ij")
    r = np.hypot(fx, fy); r[0, 0] = 1e-9
    out = np.real(np.fft.ifft2(f * shape(r, np.arctan2(fy, fx))))
    return (out - out.mean()) / out.std()

def blur_wrap(a, sigma):
    n = a.shape[0]
    fy, fx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing="ij")
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2 * (np.pi * sigma) ** 2 * (fx**2 + fy**2))))

N = 640  # shown at 320 css px, so it is sharp on a retina screen
# the height of the sheet: pulp fibres mostly lying one way (the grain direction), over felt-mark tooth
tooth = spectral(N, lambda r, a: np.exp(-((r - 0.17) / 0.11) ** 2))
fibre = spectral(N, lambda r, a: np.exp(-((r - 0.07) / 0.06) ** 2) * (0.6 + 0.4 * np.abs(np.cos(a - 0.35)) ** 4))
lumps = spectral(N, lambda r, a: 1 / (r + 0.004) ** 1.6 * (r < 0.03))
height = 0.8 * tooth + 0.45 * fibre + 0.5 * lumps
# light from the upper left: the slope of the surface toward the light
lit = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) * 0.65 + (np.roll(height, 1, 1) - np.roll(height, -1, 1)) * 0.75
lit = lit / lit.std()
# hollows hold a little shade of their own
hollow = np.minimum(0, height - blur_wrap(height, 6)); hollow /= abs(hollow).max()

# loose fibres caught in the sheet: short hairs, some darker, some pale
S = 3
im = Image.new("F", (N * S, N * S), 0.0); d = ImageDraw.Draw(im)
for i in range(95):
    x, y = rng.uniform(0, N * S, 2); ang = rng.uniform(0, np.pi); ln = rng.uniform(10, 46) * S
    curl = rng.uniform(-0.012, 0.012) / S; tone = rng.choice([-1, -1, 1]) * rng.uniform(0.35, 1)
    pts = []
    for k in range(18):
        pts.append((x, y)); x += np.cos(ang) * ln / 18; y += np.sin(ang) * ln / 18; ang += curl * ln / 18 + rng.normal(0, 0.05)
    for dx in (-N * S, 0, N * S):
        for dy in (-N * S, 0, N * S):
            d.line([(px + dx, py + dy) for px, py in pts], fill=float(tone), width=int(rng.choice([2, 2, 3])))
hairs = blur_wrap(np.asarray(im.resize((N, N), Image.BOX)), 0.45)
# flecks: the odd speck of darker pulp
flecks = np.zeros((N, N))
for i in range(70):
    flecks[rng.integers(0, N), rng.integers(0, N)] = rng.uniform(0.4, 1)
flecks = blur_wrap(flecks, 0.9); flecks /= flecks.max()

v = 0.978 + 0.0115 * np.clip(lit, -3, 3) + 0.010 * hollow - 0.045 * np.clip(-hairs, 0, 1) + 0.014 * np.clip(hairs, 0, 1) - 0.06 * flecks
print("grain mean/min/max", v.mean(), v.min(), v.max())
Image.fromarray((np.clip(v, 0, 1) * 255).round().astype(np.uint8), "L").save("public/paper/grain.png", optimize=True)

M = 512  # stretched over 1400 css px: only slow change, so softness doesn't show
cloud = spectral(M, lambda r, a: 1 / (r + 0.002) ** 2.2 * (r < 0.02))
c = 0.982 + 0.011 * np.clip(cloud, -2.5, 2.5)
Image.fromarray((np.clip(c, 0, 1) * 255).round().astype(np.uint8), "L").save("public/paper/cloud.png", optimize=True)
