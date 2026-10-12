#!/usr/bin/env python3
"""Baixa e reduz as fotos do free-exercise-db (domínio público, Unlicense).

Uso:
    python3 ferramentas/baixar_fotos_fedb.py data/mapa_fedb.json [--saida data/imagens/fedb]
           [--largura 600] [--qualidade 78] [--workers 6]

O mapa é um JSON {"<id_trivox>": "<fedb_id>", ...}. Para cada fedb_id distinto
baixa <fedb_id>/0.jpg e 1.jpg e grava <saida>/<fedb_id>_0.jpg e _1.jpg,
reduzidos para no máximo <largura> px. Arquivos já existentes são pulados.
"""
import argparse, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow ausente: pip install --break-system-packages pillow")

BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{}/{}.jpg"


def baixar(url, tentativas=4):
    for i in range(tentativas):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return r.read()
        except Exception as e:  # noqa
            if getattr(e, "code", None) == 404:
                raise
            time.sleep(1.5 * (i + 1))
    raise RuntimeError("falhou: " + url)


def processar(fid, n, saida, largura, qualidade):
    destino = os.path.join(saida, f"{fid}_{n}.jpg")
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return "pulado"
    dados = baixar(BASE.format(fid, n))
    img = Image.open(io.BytesIO(dados)).convert("RGB")
    if img.width > largura:
        img = img.resize((largura, round(img.height * largura / img.width)), Image.LANCZOS)
    tmp = destino + ".tmp"
    img.save(tmp, "JPEG", quality=qualidade, optimize=True, progressive=True)
    os.replace(tmp, destino)
    return "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mapa")
    ap.add_argument("--saida", default=os.path.join(os.path.dirname(__file__), "..", "data", "imagens", "fedb"))
    ap.add_argument("--largura", type=int, default=600)
    ap.add_argument("--qualidade", type=int, default=78)
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    mapa = json.load(open(a.mapa, encoding="utf-8"))
    ids = sorted(set(mapa.values()))
    os.makedirs(a.saida, exist_ok=True)
    tarefas = [(fid, n) for fid in ids for n in (0, 1)]
    cont = {"ok": 0, "pulado": 0, "erro": 0}
    erros = []
    with ThreadPoolExecutor(max_workers=min(a.workers, 6)) as ex:
        futs = {ex.submit(processar, fid, n, a.saida, a.largura, a.qualidade): (fid, n) for fid, n in tarefas}
        for fut, (fid, n) in futs.items():
            try:
                cont[fut.result()] += 1
            except Exception as e:
                cont["erro"] += 1
                erros.append(f"{fid}_{n}: {e}")
    print(f"{len(ids)} exercícios fedb | baixados {cont['ok']} | já existiam {cont['pulado']} | erros {cont['erro']}")
    for e in erros:
        print("  ERRO", e)
    return 1 if erros else 0


if __name__ == "__main__":
    sys.exit(main())
