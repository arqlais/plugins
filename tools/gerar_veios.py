# Gera as texturas de veio da planê.mob (cinza claro, tingidas pela cor do padrão no SketchUp).
# Uso: python3 tools/gerar_veios.py  -> src/marce/texturas/veio_<estilo>_<v|h>.jpg
# Estilos: carvalho (fio reto, fino), catedral (freijó/louro: arcos em "catedral" no meio),
# nogueira (faixas largas e escuras, ondulação suave) e linear (fio bem regular).
import math
import os

import numpy as np
from PIL import Image, ImageFilter

N = 1024
SAIDA = os.path.join(os.path.dirname(__file__), '..', 'src', 'marce', 'texturas')


def suave(seed, cx, cy):
    """ruído suave com células cx × cy px (cy grande = fibras alongadas na vertical)"""
    rng = np.random.default_rng(seed)
    base = rng.random((N // cy + 3, N // cx + 3))
    im = Image.fromarray((base * 255).astype('uint8')).resize((N + 3 * cx, N + 3 * cy), Image.BICUBIC)
    a = np.asarray(im, dtype=float)[cy:cy + N, cx:cx + N] / 255.0
    return a


def norm(a):
    a = a - a.min()
    return a / (a.max() or 1)


def linhas(fase, densidade, finura):
    """linhas escuras finas (veio) a partir de uma fase"""
    s = np.abs(np.sin(fase * math.pi * densidade))
    return s ** finura  # 0 na linha, 1 entre linhas


def veio(estilo, seed):
    y, x = np.mgrid[0:N, 0:N].astype(float)
    largo = suave(seed, 512, 1024)       # deriva bem lenta
    medio = suave(seed + 1, 96, 512)     # ondulação suave
    fibra = suave(seed + 2, 2, 160)      # fibras finas alongadas
    fibra2 = suave(seed + 3, 6, 60)
    if estilo == 'carvalho':
        fase = (x + 40 * (largo - .5) + 10 * (medio - .5)) / N
        fase = fase + .004 * np.sin(fase * 37)
        l = linhas(fase, 70, .35)
        v = .62 + .2 * l + .12 * (fibra - .5) + .05 * (fibra2 - .5)
    elif estilo == 'catedral':
        cx = N * .5 + 60 * (largo - .5)
        d = np.abs(x - cx)
        meio = np.exp(-(d / (N * .2)) ** 2)  # arcos só no centro da peça
        fase = (d + meio * (y * .45 + 60 * np.sin(y / 300.0)) + 25 * (medio - .5)) / N
        l = linhas(fase, 26, .45)
        v = .6 + .22 * l + .1 * (fibra - .5) + .04 * (fibra2 - .5)
    elif estilo == 'nogueira':
        fase = (x + 35 * np.sin(y / 260.0 + largo * 3) + 45 * (largo - .5)) / N
        faixas = .5 + .5 * np.sin(fase * math.pi * 18 + medio * 2)
        l = linhas(fase, 44, .5)
        v = .5 + .18 * faixas + .16 * l + .12 * (fibra - .5)
    else:  # linear
        fase = (x + 4 * (largo - .5)) / N
        l = linhas(fase, 110, .5)
        v = .66 + .14 * l + .08 * (fibra - .5)
    v = norm(v)
    v = 165 + v * 90
    im = Image.fromarray(v.clip(0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(.5))
    # emenda sem corte na vertical (o veio corre no sentido do comprimento)
    a = np.asarray(im, dtype=float)
    k = 128
    t = np.linspace(0, 1, k)[:, None]
    a2 = a[:-k].copy()
    a2[:k] = a[:k] * t + a[-k:] * (1 - t)
    return Image.fromarray(a2.clip(0, 255).astype('uint8')).resize((N, N), Image.BICUBIC).convert('RGB')


if __name__ == '__main__':
    os.makedirs(SAIDA, exist_ok=True)
    for k, estilo in enumerate(['carvalho', 'catedral', 'nogueira', 'linear']):
        im = veio(estilo, 7 + k * 11)
        im.save(os.path.join(SAIDA, 'veio_%s_v.jpg' % estilo), quality=86)
        im.rotate(90, expand=True).save(os.path.join(SAIDA, 'veio_%s_h.jpg' % estilo), quality=86)
        print('ok', estilo)
