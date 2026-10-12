"""Grava o campo `imagens` de cada exercicio a partir de data/mapa_fedb.json (exercicios antigos)
e do campo `fedb_id` (exercicios novos). So aponta pra fotos que existem em data/imagens/fedb/.
Rodar depois de enriquecer_exercicios.py e baixar_fotos_fedb.py."""
import json, os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
arq = os.path.join(RAIZ, 'data', 'exercicios.json')
mapa = json.load(open(os.path.join(RAIZ, 'data', 'mapa_fedb.json'), encoding='utf-8'))
ex = json.load(open(arq, encoding='utf-8'))
com = 0
for e in ex:
    fid = mapa.get(e['id']) or e.get('fedb_id')
    fotos = []
    if fid:
        for i in (0, 1):
            rel = f'data/imagens/fedb/{fid}_{i}.jpg'
            if os.path.exists(os.path.join(RAIZ, rel)):
                fotos.append(rel)
    if fotos:
        e['imagens'] = fotos; com += 1
    else:
        e.pop('imagens', None)
json.dump(ex, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'{com} de {len(ex)} exercicios com foto real')
