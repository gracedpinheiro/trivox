#!/usr/bin/env python3
"""Mapeia cada exercicio de data/exercicios.json para um TEMPLATE de ilustracao do js/figuras.js.

Uso:  python3 ferramentas/mapear_figuras.py            (gera data/figuras_mapa.json + embute no js)
      python3 ferramentas/mapear_figuras.py --revisar  (lista id | nome | aparelho -> template/prop/apoio, por categoria)

Saida por exercicio:  {"t": template, "p": implemento na mao (opcional, "-" = nenhum),
                        "a": apoio/cenario trocado (opcional), "v": "lado"|"frente", "m": "espelhar" (opcional)}

Como decide (reprodutivel):
  1. regras ordenadas por NOME (minusculo, sem acento) + categoria  -> template
  2. implemento: campo "aparelho" + pistas no nome/equipamento (kettlebell, halter, elastico, polia...)
  3. apoio: pistas no nome/equipamento (cadeira, bola suica, step, caixa, TRX...) quando o template tem slot de apoio
  4. EXCECOES (dicionario no fim) corrigem, a mao, o que as regras erram — revisadas categoria por categoria.
Os metadados dos templates (vista, apoio, implemento padrao) vem do proprio figuras.js via node.
"""
import json, re, subprocess, sys, unicodedata, collections
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BASE = RAIZ / 'data' / 'exercicios.json'
SAIDA = RAIZ / 'data' / 'figuras_mapa.json'
JS = RAIZ / 'js' / 'figuras.js'


def meta_templates():
    cod = r"""
const fs=require('fs'),vm=require('vm');const c={console};vm.createContext(c);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.F=Figuras;',c);
const m={};for(const [id,t] of Object.entries(c.F._tpl)) m[id]={v:t.v||'lado',p:t.p||null,apoio:(t.cena||[]).some(e=>Array.isArray(e)&&e[1]&&e[1].id==='apoio')};
process.stdout.write(JSON.stringify({tpl:m,cena:c.F.CENARIOS,props:c.F.PROPS}));"""
    out = subprocess.run(['node', '-e', cod, str(JS)], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def norm(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s)


def tem(n, *ps):
    return any(re.search(p, n) for p in ps)


# ----------------------------------------------------------------------------- 1) template por regras
def template(e):
    n = norm(e['nome']); c = e['categoria']; ap = e['aparelho']; q = norm(e.get('equipamento', ''))

    # --- excluir "flexao" que nao e flexao de bracos
    flexao_braco = 'flexao' in n and not tem(n, r'flexao de punho', r'flexao lateral', r'flexao de pescoco', r'flexao plantar', r'flexao de quadril', r'flexao lateral de pescoco')

    # ===== alongamento / mobilidade (antes, para nao cair em regras de forca)
    if c in ('alongamento', 'mobilidade') or tem(n, r'^alongamento', r'liberacao', r'mobilidade'):
        if tem(n, r'liberacao', r'foam roller') and not 'extensao toracica' in n:
            if tem(n, r'quadriceps', r'iliotibial', r'adutor'): return 'rolo_coxa'
            if tem(n, r'panturrilha', r'isquiotibiais', r'gluteo'): return 'rolo_panturrilha'
            return 'rolo_costas'
        if tem(n, r'gato', r'cat.?cow'): return 'gato_camelo'
        if tem(n, r'child', r'crianca', r'tibial anterior ajoelhado', r'cotovelos no banco'): return 'postura_crianca'
        if tem(n, r'pombo', r'pigeon'): return 'pombo'
        if tem(n, r'piriform'): return 'gluteo_deitado'
        if tem(n, r'pancake'): return 'pancake'
        if tem(n, r'jefferson'): return 'jefferson'
        if tem(n, r'couch'): return 'couch_stretch'
        if tem(n, r'world', r'groiner'): return 'worlds_greatest'
        if tem(n, r'quadriceps'): return 'alongamento_quadriceps_deitado' if 'deitado' in n else 'alongamento_quadriceps'
        if tem(n, r'flexor do quadril', r'hip flexor'): return 'afundo_ajoelhado'
        if tem(n, r'posterior', r'isquiotib', r'hamstring'):
            if 'cadeira' in n: return 'alongamento_posterior_cadeira'
            if tem(n, r'deitado', r'elastico'): return 'alongamento_posterior_deitado'
            if 'sentad' in n: return 'alongamento_posterior_sentado'
            return 'alongamento_posterior'
        if tem(n, r'lombar sentado'): return 'alongamento_posterior_cadeira'
        if tem(n, r'maos atras da cabeca', r'deltoide anterior'): return 'alongamento_peitoral_costas'
        if tem(n, r'peitoral', r'biceps na parede'): return 'alongamento_peitoral'
        if tem(n, r'ombros? cruzado', r'costas medias'): return 'ombro_cruzado'
        if tem(n, r'triceps acima'): return 'triceps_acima'
        if tem(n, r'toalha nas costas'): return 'toalha_costas'
        if tem(n, r'panturrilha'): return 'alongamento_panturrilha_degrau' if 'degrau' in n else 'alongamento_panturrilha'
        if tem(n, r'soleo'): return 'alongamento_panturrilha'
        if tem(n, r'antebraco ajoelhado', r'pulsos'): return 'gato_camelo'
        if tem(n, r'gluteo'): return 'gluteo_sentado' if tem(n, r'cadeira', r'sentado') else 'gluteo_deitado'
        if tem(n, r'joelhos ao peito'): return 'joelhos_peito'
        if tem(n, r'esfinge'): return 'esfinge'
        if tem(n, r'latissimo', r'lateral do tronco', r'lateral sentado', r'lateral de quadril', r'^lateral', r'lat stretch'): return 'inclinacao_lateral'
        if tem(n, r'cervical', r'pescoco'): return 'queixo' if 'queixo' in n else 'pescoco'
        if tem(n, r'adutores', r'borboleta'): return 'borboleta'
        if tem(n, r'sapo', r'frog'): return 'sapo'
        if tem(n, r'coluna em rotacao', r'torcao espinhal', r'spinal'): return 'torcao_deitado'
        if tem(n, r'extensao toracica'):
            if 'cadeira' in n: return 'extensao_toracica_cadeira'
            if 'banco' in n: return 'postura_crianca'
            return 'extensao_toracica'
        if tem(n, r'rotacao toracica', r'abertura toracica', r'open book', r'livro aberto', r'thoracic'):
            if 'parede' in n: return 'rotacao_em_pe'
            if tem(n, r'livro', r'open book', r'abertura'): return 'livro_aberto'
            return 'rotacao_toracica'
        if tem(n, r'ponte toracica'): return 'rotacao_toracica'
        if tem(n, r'ponte completa'): return 'ponte_completa'
        if tem(n, r'rotacao de tronco'): return 'rotacao_sentado' if 'sentado' in n else 'rotacao_em_pe'
        if tem(n, r'dislocat', r'deslocamento de ombro', r'circulos de ombro com bastao'): return 'dislocate'
        if tem(n, r'circulos de bracos'): return 'circulos_bracos'
        if tem(n, r'cars de ombro', r'mobilidade de ombro'): return 'cars_ombro'
        if tem(n, r'skin the cat'): return 'front_lever'
        if tem(n, r'deslizamento na parede', r'wall slide'): return 'wall_slide'
        if tem(n, r'anjo', r'wall angel'): return 'anjo_parede'
        if tem(n, r'quatro apoios', r'4 apoios'): return 'quatro_apoios_circulos'
        if tem(n, r'cars de quadril', r'portao', r'circulos? de quadril em pe'): return 'cars_quadril'
        if tem(n, r'rotacao de quadril', r'mobilidade de quadril', r'hip circle', r'circulos de quadril'): return 'circulo_quadril'
        if tem(n, r'90/90', r'shin box', r'bretzel', r'seiza'): return 'sentado_90_90'
        if tem(n, r'balanco de pernas', r'leg swing'): return 'balanco_perna'
        if tem(n, r'tornozelo'): return 'tornozelo'
        if tem(n, r'deep squat', r'agachamento profundo com rotacao'): return 'agachamento_rotacao' if 'rotacao' in n else 'agachamento_profundo'
        if tem(n, r'agachamento profundo', r'mobilidade de agachamento'): return 'agachamento_profundo'
        if tem(n, r'respiracao'): return 'respiracao'
        if tem(n, r'bascula'): return 'bascula'
        if tem(n, r'queixo', r'chin tuck'): return 'queixo'
        if tem(n, r'joelho ao peito caminhando', r'frankenstein'): return 'marcha'
        if tem(n, r'oito com a raquete'): return 'oito_raquete'

    # ===== skills / calistenia
    if tem(n, r'muscle.?up'): return 'muscle_up'
    if tem(n, r'front lever', r'back lever', r'human flag', r'maltes', r'skin the cat'): return 'front_lever'
    if tem(n, r'planche', r'frog stand', r'corvo', r'crow'): return 'planche' if not 'push' in n else 'flexao'
    if tem(n, r'bananeira', r'handstand', r'parada de mao', r'hspu', r'wall walk', r'escalada na parede'):
        if tem(n, r'wall walk', r'escalada'): return 'wall_walk'
        if tem(n, r'push', r'hspu', r'negativo', r'flexao'): return 'hspu'
        return 'parada_mao'
    if tem(n, r'\bl-?sit') and 'pull' not in n: return 'l_sit'
    if tem(n, r'v-sit', r'v sit'): return 'v_sit'
    if tem(n, r'dragon flag'): return 'dragon_flag'
    if tem(n, r'apoio nos aneis', r'stutzwaage'): return 'mergulho'

    # ===== barra fixa / puxadas
    if tem(n, r'pull-?up', r'chin-?up', r'barra fixa', r'graviton\)?$') and not tem(n, r'burpee', r'elevacao'):
        if tem(n, r'chin', r'supinad'): return 'barra_fixa_supinada'
        if tem(n, r'dead hang', r'isometric', r'escapular', r'scapular'): return 'pendurado'
        return 'barra_fixa'
    if tem(n, r'dead hang', r'suspensao'): return 'pendurado'
    if tem(n, r'pull-?over'): return 'pullover_chao' if 'chao' in n else 'pullover'
    if tem(n, r'face pull'): return 'face_pull'
    if tem(n, r'pulldown', r'puxada') or (('pull' in n) and c in ('costas', 'puxar')):
        if tem(n, r'bracos estendidos', r'braco estendido', r'straight', r'pulldown com corda', r'pulldown no cabo deitado'): return 'pulldown_estendido'
        if tem(n, r'deslizante'): return 'nadador'
        if 'unilateral' in n: return 'puxada_unilateral' if not 'elastico' in n else 'pulldown_ajoelhado'
        if tem(n, r'ajoelhad', r'elastico', r'toalha'): return 'pulldown_ajoelhado'
        if tem(n, r'fechad', r'triangulo', r'neutra', r'supinad', r'corda'): return 'puxada_fechada'
        return 'puxada'

    # ===== pernas: maquinas
    if 'leg press' in n:
        if 'panturrilha' in n: return 'panturrilha_leg_press'
        return 'leg_press'
    if 'panturrilha' in n and 'hack' in n: return 'panturrilha_maquina'
    if tem(n, r'hack squat com barra'): return 'terra'
    if tem(n, r'hack', r'pendulo', r'pendulum'): return 'agachamento' if 'landmine' in n else 'hack'
    if tem(n, r'maquina deitado', r'agachamento reclinado'): return 'agachamento_maquina_deitado'
    if tem(n, r'tke', r'extensao terminal'): return 'tke'
    if tem(n, r'extensora'): return 'extensora'
    if tem(n, r'extensao de joelho'): return 'extensao_joelho_sentado'
    if tem(n, r'flexora', r'leg curl'):
        if tem(n, r'em pe'): return 'flexora_em_pe'
        if 'bola' in n: return 'flexora_bola'
        if tem(n, r'toalha', r'deslizante', r'trx'): return 'flexora_deslizante'
        if tem(n, r'brucos', r'halter'): return 'flexora_brucos'
        if tem(n, r'sentad', r'cadeira flexora'): return 'flexora_cadeira' if 'elastico' in n else 'flexora_sentado'
        if ap == 'mesa_flexora' and 'cadeira' in n: return 'flexora_sentado'
        return 'flexora_deitado'
    if tem(n, r'nordico reverso'): return 'nordico_reverso'
    if tem(n, r'nordic', r'nordico', r'glute ham', r'ghr'): return 'nordico'
    if tem(n, r'abdominal no ghd'): return 'ghd_abdominal'

    # ===== core (antes de "elevacao"/"rotacao"/"extensao")
    if tem(n, r'pallof'): return 'rotacao_cabo' if 'rotacional' in n else 'pallof'
    if tem(n, r'wood ?chop', r'\bchop\b', r'judo flip'): return 'woodchop'
    if tem(n, r'lift diagonal'): return 'lift'
    if tem(n, r'russian twist'): return 'rotacao_cabo' if 'polia' in n else 'russian_twist'
    if tem(n, r'windmill', r'bent press'): return 'windmill'
    if tem(n, r'stir the pot'): return 'stir_pot'
    if tem(n, r'vacuum', r'vacuo'): return 'vacuum'
    if tem(n, r'dead bug'): return 'dead_bug'
    if tem(n, r'hollow'): return 'hollow'
    if tem(n, r'bird dog'): return 'bird_dog'
    if tem(n, r'superman', r'cobra pronada', r'pes presos no sofa', r'decubito ventral'): return 'superman'
    if tem(n, r'nadador', r'swimmer'): return 'nadador'
    if tem(n, r'flutter', r'tesoura', r'scissor'):
        return 'hiper_reversa' if 'pronado' in n else 'flutter'
    if tem(n, r'limpador'): return 'elevacao_pernas_suspenso' if tem(n, r'suspens', r'barra') else 'torcao_deitado'
    if tem(n, r'canivete lateral'): return 'canivete_lateral'
    if tem(n, r'v-up', r'canivete') and 'bola' not in n: return 'v_up'
    if tem(n, r'canivete na bola', r'pike com slider', r'pike no trx'): return 'pike_suspenso' if not 'bola' in n else 'canivete_bola'
    if tem(n, r'mountain climber'): return 'mountain_climber_cruzado' if 'cruzado' in n else 'mountain_climber'
    if tem(n, r'roda abdominal', r'ab wheel', r'rollout', r'fallout', r'body saw'):
        if 'fallout' in n: return 'trx_frente'
        if 'body saw' in n: return 'prancha'
        if 'bola' in n: return 'prancha_bola'
        return 'roda_abdominal'
    if tem(n, r'prancha', r'plank'):
        if 'copenhagen' in n: return 'copenhagen'
        if 'lateral' in n or 'star plank' in n:
            if tem(n, r'abducao', r'star'): return 'prancha_estrela'
            if tem(n, r'joelhos', r'concha', r'clam'): return 'prancha_lateral_joelhos'
            if tem(n, r'elevacao de quadril'): return 'prancha_lateral_quadril'
            return 'prancha_lateral'
        if tem(n, r'urso', r'bear'): return 'urso_toque' if 'toque' in n else 'prancha_urso'
        if tem(n, r'toque no ombro', r'alcance'): return 'prancha_toque'
        if 'reversa' in n: return 'prancha_reversa'
        if tem(n, r'para flexao', r'sobe e desce', r'up-down'): return 'flexao_esfinge'
        if tem(n, r'jack', r'polichinelo'): return 'prancha_alta'
        if tem(n, r'pes elevados', r'pes no trx'): return 'prancha_pes_elevados'
        if tem(n, r'bola', r'bosu'): return 'prancha_bola'
        if tem(n, r'parede'): return 'flexao_parede'
        return 'prancha'
    if tem(n, r'copenhagen'): return 'copenhagen'
    if tem(n, r'elevacao de (pernas|joelhos)', r'leg raise', r'pes a barra', r'toes to bar', r'leg lowering', r'descida de pernas', r'hanging knee'):
        if tem(n, r'paralelas', r'capitao'): return 'elevacao_joelhos_paralelas'
        if tem(n, r'suspens', r'barra', r'hanging'):
            return 'elevacao_joelhos_suspenso' if 'joelho' in n else 'elevacao_pernas_suspenso'
        return 'elevacao_pernas'
    if tem(n, r'abdominal', r'crunch', r'sit-?up'):
        if tem(n, r'polia', r'cabo'): return 'abdominal_infra' if 'reverso' in n else 'crunch_polia'
        if 'maquina' in n: return 'crunch_maquina'
        if tem(n, r'reverso', r'infra'): return 'abdominal_infra' if 'trx' not in n else 'mountain_climber'
        if 'bicicleta' in n: return 'bicicleta_abdominal'
        if tem(n, r'sit-?up', r'3/4', r'janda', r'borboleta', r'frog'): return 'sit_up'
        if tem(n, r'bracos estendidos', r'medicine ball estendida', r'arremesso'): return 'abdominal_bracos'
        if tem(n, r'suitcase', r'tuck', r'grupado', r'torcao'): return 'v_up'
        return 'abdominal'
    if tem(n, r'toque nos calcanhares'): return 'abdominal'
    if tem(n, r'rotacao de tronco na maquina'): return 'rotacao_sentado'
    if tem(n, r'rotacao de tronco', r'rotacao com landmine', r'rotacao toracica com bola', r'passe rotacional'):
        return 'rotacao_cabo' if tem(n, r'cabo', r'polia', r'landmine') else 'rotacao_em_pe'
    if tem(n, r'flexao lateral', r'inclinacao lateral', r'side bend'):
        if 'bola' in n: return 'canivete_lateral'
        if 'banco romano' in n: return 'extensao_lombar'
        if 'pescoco' in n: return 'pescoco'
        return 'flexao_lateral' if ap in ('halteres', 'kettlebell') else 'inclinacao_lateral'
    if tem(n, r'flexao de pescoco'): return 'queixo'

    # ===== posterior / quadril
    if tem(n, r'romeno', r'stiff', r'\brdl\b', r'single leg deadlift', r'terra unilateral'):
        if tem(n, r'unilateral', r'single leg') and 'kickstand' not in n: return 'stiff_unilateral'
        return 'stiff'
    if tem(n, r'bom dia', r'good morning'): return 'bom_dia_sentado' if 'sentado' in n else 'bom_dia'
    if tem(n, r'terra sumo', r'sumo dl'): return 'terra_sumo'
    if tem(n, r'levantamento terra', r'^terra', r'deadlift', r'rack pull', r'hexagonal') and not tem(n, r'farmer', r'burpee'):
        return 'terra'
    if tem(n, r'hip thrust', r'elevacao pelvica'): return 'hip_thrust'
    if tem(n, r'ponte', r'bridge', r'frog pump'):
        if tem(n, r'ombros na bola'): return 'ponte_bola_ombros'
        if tem(n, r'unilateral', r'marcha'):
            if tem(n, r'cadeira', r'degrau'): return 'ponte_pes_elevados'
            return 'ponte_unilateral'
        if tem(n, r'pes na cadeira', r'pes na parede', r'pes no trx', r'calcanhar na cadeira', r'pes elevados'): return 'ponte_pes_elevados'
        return 'ponte'
    if tem(n, r'hiperextensao reversa', r'hiper reversa'): return 'hiper_reversa'
    if tem(n, r'extensao lombar', r'hiperextensao', r'extensao de quadril no banco', r'extensao de quadril unilateral no banco', r'extensao de quadril isometrica no banco', r'back extension'):
        if 'bola' in n: return 'extensao_bola'
        return 'extensao_lombar'
    if tem(n, r'coice', r'kickback', r'donkey', r'gluteo no cabo', r'extensao de quadril'):
        if tem(n, r'triceps'): return 'triceps_coice'
        if tem(n, r'maquina', r'multi-hip'): return 'coice_maquina'
        if tem(n, r'4 apoios', r'quatro apoios', r'donkey', r'dobra do joelho', r'smith'): return 'coice'
        return 'coice_em_pe'
    if tem(n, r'fire hydrant'): return 'fire_hydrant'
    if tem(n, r'clamshell', r'concha'): return 'concha'
    if tem(n, r'abdu', r'abdutora'):
        if ap == 'cadeira_abdutora' or tem(n, r'abdutora', r'abducao de quadril maquina'): return 'cadeira_abdutora'
        if tem(n, r'deitado', r'lateral deitado'): return 'abducao_deitado'
        if 'sentado' in n: return 'abducao_sentado'
        if 'ombro' in n: return 'elevacao_lateral'
        return 'abducao_em_pe'
    if tem(n, r'adu', r'adutora'):
        if ap == 'cadeira_adutora' or 'adutora' in n: return 'cadeira_adutora'
        if tem(n, r'isometrica sentado', r'almofada'): return 'aducao_sentado'
        if tem(n, r'deitado de lado'): return 'aducao_deitado'
        if tem(n, r'ponte'): return 'ponte'
        return 'aducao_em_pe'
    if tem(n, r'hip hike', r'elevacao de quadril no degrau'): return 'elevacao_quadril_degrau'

    # ===== pernas livres
    if tem(n, r'sissy'): return 'sissy'
    if tem(n, r'shrimp', r'camarao', r'patinador \(skater squat\)', r'skater squat'): return 'shrimp'
    if tem(n, r'pistol', r'agachamento unilateral'):
        if tem(n, r'assist', r'apoio', r'caixa', r'trx', r'bola'): return 'pistol_apoio'
        return 'pistol'
    if tem(n, r'bulgaro', r'búlgaro'): return 'bulgaro'
    if tem(n, r'cossack', r'cossaco'): return 'afundo_lateral'
    if tem(n, r'afundo', r'avanco', r'lunge', r'passada', r'fenda', r'split squat', r'split jump') and not tem(n, r'corda naval', r'step', r'remada', r'supino'):
        if tem(n, r'lateral'): return 'afundo_lateral'
        if tem(n, r'cruzado', r'curtsy'): return 'afundo_cruzado'
        if tem(n, r'salto', r'pliometric', r'split jump'): return 'afundo_salto'
        if tem(n, r'caminhando', r'passada', r'walking'): return 'afundo_caminhando'
        if tem(n, r'reverso', r'para tras'): return 'afundo_reverso'
        if tem(n, r'ajoelhado'): return 'afundo_ajoelhado'
        return 'afundo'
    if tem(n, r'step.?up', r'subida no', r'step over', r'treino de escada', r'step aerobico'):
        if 'lateral' in n: return 'step_lateral'
        if tem(n, r'joelho', r'aerobico'): return 'step_up_joelho'
        return 'step_up'
    if tem(n, r'step down', r'descida excentrica'): return 'step_down'
    if tem(n, r'cadeirinha', r'wall sit', r'agachamento na parede', r'wall squat'):
        return 'panturrilha_pe' if 'panturrilha' in n else 'agachamento_parede'
    if tem(n, r'agachamento.*bola', r'unipodal com bola'): return 'agachamento_bola_parede'
    if tem(n, r'panturrilha', r'calf', r'calcanhares com apoio', r'flexao plantar'):
        if tem(n, r'isometria', r'rocking', r'balanco'): return 'panturrilha_chao'
        if tem(n, r'sentad', r'soleo\)?$', r'flexao plantar'): return 'panturrilha_sentado'
        if tem(n, r'maquina', r'donkey'): return 'panturrilha_maquina' if 'casa' not in n else 'panturrilha_pe'
        if tem(n, r'caminhada'): return 'caminhada_carga'
        if tem(n, r'joelho flexionado'): return 'panturrilha_chao'
        return 'panturrilha_pe'
    if tem(n, r'caminhada nos calcanhares'): return 'caminhada_carga'
    if tem(n, r'tibial', r'dorsiflexao', r'ponta de pe'):
        if tem(n, r'parede'): return 'tibial'
        return 'tibial_sentado'
    if tem(n, r'inversao e eversao', r'tornozelo'): return 'tornozelo'
    if tem(n, r'sentar e levantar', r'sentar-levantar'):
        return 'levantar_chao' if 'chao' in n else 'sentar_levantar'
    if tem(n, r'levantar do chao'): return 'levantar_chao'
    if tem(n, r'agachamento', r'squat') and not tem(n, r'thrust', r'jack'):
        if tem(n, r'frontal', r'front', r'zercher', r'rack'): return 'agachamento_frontal'
        if tem(n, r'overhead'): return 'agachamento_overhead'
        if tem(n, r'sumo'): return 'agachamento_sumo'
        if tem(n, r'deslocamento lateral'): return 'deslocamento_lateral'
        if tem(n, r'salto', r'jump', r'giro'): return 'agachamento_salto'
        if tem(n, r'puls', r'socos'): return 'agachamento_pulso'
        if tem(n, r'isometric'): return 'agachamento_isometrico'
        if tem(n, r'profundo', r'deep'): return 'agachamento_profundo'
        if tem(n, r'ate o banco', r'na caixa', r'box squat'): return 'agachamento_banco'
        if tem(n, r'mini agachamento'): return 'agachamento_mini'
        if tem(n, r'toalha na porta'): return 'agachamento_toalha'
        if tem(n, r'ajoelhado'): return 'agachamento_ajoelhado'
        if tem(n, r'remada'): return 'agachamento'
        return 'agachamento'
    if tem(n, r'squat jack', r'agachamento com polichinelo'): return 'squat_jack'

    # ===== peito / empurrar
    if 'supino' in n or 'bench' in n or tem(n, r'pin press', r'board press', r'spoto', r'jm press', r'floor press', r'chest press'):
        if tem(n, r'landmine'): return 'landmine_press'
        if tem(n, r'maquina', r'machine'): return 'supino_maquina'
        if tem(n, r'sentado no cabo'): return 'supino_maquina'
        if tem(n, r'em pe', r'base de afundo', r'base afundada', r'isometrico no cabo', r'com elastico') and 'barra' not in q: return 'supino_em_pe'
        if tem(n, r'no chao', r'floor press'): return 'supino_chao'
        if 'bola' in n: return 'supino_bola'
        if 'inclinad' in n: return 'supino_inclinado'
        if 'declinad' in n: return 'supino_declinado'
        return 'supino'
    if tem(n, r'svend'): return 'svend'
    if tem(n, r'aperto isometrico de palmas'): return 'aperto_palmas'
    if tem(n, r'crucifixo inverso', r'reverse fly', r'passaro', r'extensao lateral curvada', r'pressao isometrica dos cotovelos'):
        if tem(n, r'peck deck', r'maquina'): return 'voador_inverso'
        if tem(n, r'trx'): return 'remada_trx'
        if tem(n, r'banco inclinado', r'peito apoiado', r'deitado', r'brucos', r'bola', r'testa apoiada'): return 'crucifixo_inverso_deitado'
        return 'crucifixo_inverso'
    if tem(n, r'peck deck', r'voador', r'fly na maquina'): return 'peck_deck'
    if tem(n, r'crossover', r'fly de cabo', r'cruz de ferro', r'iron cross', r'fly circular', r'chest fly isometrico', r'crucifixo .*cabo', r'crucifixo .*elastico') and not 'passo cruzado' in n:
        if tem(n, r'baixo', r'de baixo para cima'): return 'crossover_baixo'
        if tem(n, r'banco reto'): return 'crucifixo'
        if tem(n, r'inclinado no cabo'): return 'crucifixo_inclinado'
        if tem(n, r'media', r'altura do peito', r'isometrico', r'em pe com elastico'): return 'crossover_medio'
        return 'crossover'
    if tem(n, r'crucifixo', r'around the world', r'fly\b'):
        if 'trx' in n: return 'trx_frente'
        if tem(n, r'chao'): return 'supino_chao'
        if 'bola' in n: return 'supino_bola'
        if 'inclinad' in n: return 'crucifixo_inclinado'
        if tem(n, r'isometrico em pe'): return 'elevacao_lateral'
        return 'crucifixo'
    if tem(n, r'pull-?over'):
        if 'chao' in n: return 'pullover_chao'
        return 'pullover'
    if tem(n, r'paralela', r'\bdips?\b', r'mergulho'):
        if tem(n, r'banco', r'cadeiras', r'triceps no banco'): return 'mergulho_banco'
        return 'mergulho'
    if flexao_braco or tem(n, r'push-?up', r'dive bomber'):
        if tem(n, r'parede'): return 'flexao_parede'
        if tem(n, r'trx'): return 'trx_frente'
        if tem(n, r'joelho'): return 'flexao_joelhos'
        if tem(n, r'esfinge'): return 'flexao_esfinge'
        if tem(n, r'inclinada', r'bancada', r'maos elevadas', r'maos na bola'): return 'flexao_inclinada'
        if tem(n, r'declinada', r'pes elevados', r'pes na bola'): return 'flexao_declinada'
        if tem(n, r'explosiva', r'palmas', r'pliometrica', r'clap'): return 'flexao_explosiva'
        if tem(n, r'diamante', r'fechada', r'cotovelos colados'): return 'flexao_diamante'
        if tem(n, r'pike', r'hindu', r'dive bomber'): return 'pike_pushup'
        return 'flexao'
    if tem(n, r'pike push'): return 'pike_pushup'

    # ===== ombros
    if tem(n, r'push press', r'push jerk', r'split jerk', r'\bjerk\b') and 'clean' not in n: return 'push_press'
    if tem(n, r'landmine press', r'jammer') or ('landmine' in n and 'desenvolvimento' in n):
        if tem(n, r'ajoelhad'): return 'desenvolvimento_ajoelhado'
        return 'landmine_press'
    if tem(n, r'desenvolvimento', r'arnold', r'militar', r'military', r'bradford', r'z press', r'viking press', r'press com kettlebell', r'pike press', r'press acima', r'press com kettlebell invertido'):
        if 'pike' in n: return 'pike_pushup'
        if 'maquina' in n: return 'desenvolvimento_maquina'
        if tem(n, r'ajoelhad'): return 'desenvolvimento_ajoelhado'
        if tem(n, r'sentad', r'z press', r'smith', r'polia'): return 'desenvolvimento_sentado'
        if tem(n, r'unilateral', r'invertido', r'gangorra'): return 'desenvolvimento_unilateral'
        return 'desenvolvimento'
    if tem(n, r'halo'): return 'halo'
    if tem(n, r'elevacao lateral', r'lateral raise', r'lu raise'):
        if tem(n, r'lu raise', r'ate acima'): return 'elevacao_y'
        if tem(n, r'unilateral', r'deitado de lado') and tem(n, r'cabo', r'polia', r'halter', r'inclinado'): return 'elevacao_lateral_uni'
        if tem(n, r'cabo', r'polia') and not tem(n, r'crossover', r'bilateral', r'entre polias'): return 'elevacao_lateral_uni'
        return 'elevacao_lateral'
    if tem(n, r'elevacao frontal', r'front raise'): return 'elevacao_frontal_alt' if 'alternad' in n else 'elevacao_frontal'
    if tem(n, r'elevacao alternada frente e lado'): return 'elevacao_lateral'
    if tem(n, r'elevacao (em )?y', r'y raise', r'y-t-w', r'w raise', r'scaption', r'full can', r'empty can', r'trapezio inferior', r'pull apart acima'):
        if tem(n, r'y-t-w', r'brucos', r'bola', r'deitado') and not 'banco inclinado' in n: return 'ytw'
        if 'banco inclinado' in n: return 'crucifixo_inverso_deitado'
        return 'elevacao_y'
    if tem(n, r'band pull apart', r'pull apart'): return 'pull_apart'
    if tem(n, r'face pull', r'remada posterior na corda', r'corda ate o rosto'): return 'face_pull'
    if tem(n, r'remada alta', r'upright', r'high pull') and not tem(n, r'maquina', r'ajoelhad'): return 'remada_alta'
    if tem(n, r'cuban'): return 'remada_alta'
    if tem(n, r'encolhimento', r'shrug'):
        if 'latissimo' in n: return 'puxada'
        return 'encolhimento_acima' if 'acima da cabeca' in n else 'encolhimento'
    if tem(n, r'rotacao (externa|interna)', r'manguito'):
        if tem(n, r'prancha'): return 'prancha_lateral'
        if tem(n, r'90', r'saque', r'brucos'): return 'rotacao_externa_90'
        if 'deitado' in n: return 'rotacao_deitado'
        if 'interna' in n and 'externa' not in n: return 'rotacao_interna'
        return 'rotacao_externa'
    if tem(n, r'rotacao interna e externa'): return 'rotacao_externa'
    if tem(n, r'diagonal d[12]'): return 'diagonal'
    if tem(n, r'serratil', r'protracao', r'soco para o teto', r'serratus'):
        if tem(n, r'prancha'): return 'prancha'
        if tem(n, r'urso'): return 'prancha_urso'
        if tem(n, r'deslizamento', r'parede'): return 'wall_slide'
        if tem(n, r'cabo', r'soco a frente'): return 'supino_em_pe'
        if tem(n, r'flexao'): return 'flexao'
        return 'serratil'
    if tem(n, r'deslizamento (na parede|dos antebracos)', r'wall slide'): return 'wall_slide'
    if tem(n, r'anjo', r'wall angel'): return 'anjo_parede'
    if tem(n, r'arremesso 90/90'): return 'arremesso_cima'
    if tem(n, r'drop catch', r'solta e pega'): return 'ytw'
    if tem(n, r'circulos com bola na parede'): return 'wall_slide'
    if tem(n, r'retracao escapular'):
        if 'trx' in n: return 'remada_trx'
        if 'banco inclinado' in n: return 'remada_apoiada'
        return 'remada_em_pe'
    if tem(n, r'depressao escapular'): return 'mergulho_banco'

    # ===== costas
    if 'remada' in n or tem(n, r'\brow\b', r'serrote'):
        if tem(n, r'treno'): return 'treno_puxar'
        if tem(n, r'renegade'): return 'remada_renegade'
        if tem(n, r'invertida', r'australiana', r'sob a mesa', r'aneis'): return 'remada_invertida'
        if tem(n, r'trx'): return 'remada_trx'
        if tem(n, r'apoio no peito', r'peito apoiado', r'seal', r'inclinada com barra', r'remada t deitado', r'deitado'): return 'remada_apoiada'
        if tem(n, r'maquina', r'articulada', r'high row'): return 'remada_maquina'
        if tem(n, r'ajoelhad') and tem(n, r'polia'): return 'pulldown_ajoelhado'
        if tem(n, r'base de afundo', r'com rotacao'): return 'remada_afundo'
        if tem(n, r'sentad', r'baixa', r'cabo', r'isometrica com toalha') and not 'unilateral no cabo' in n:
            if tem(n, r'elastico', r'toalha'): return 'remada_sentada_chao'
            return 'remada_sentada'
        if tem(n, r'unilateral no cabo'): return 'remada_sentada'
        if tem(n, r'elastico', r'toalha na porta', r'em pe') and not 'barra' in n: return 'remada_em_pe'
        if tem(n, r'unilateral', r'serrote', r'kroc'): return 'remada_unilateral' if not 'smith' in n else 'remada_curvada'
        return 'remada_curvada'
    if tem(n, r'superman', r'cobra'): return 'superman'

    # ===== bracos
    if tem(n, r'punho', r'dedos', r'wrist roller', r'rolo de punho', r'pronacao', r'desvio radial', r'tyler twist', r'torcao de toalha'):
        if tem(n, r'atras (das costas|do corpo)'): return 'rosca_punho_pe'
        if tem(n, r'rolo de punho', r'wrist roller', r'tyler', r'torcao de toalha', r'abertura dos dedos', r'extensao de dedos'): return 'pegada'
        return 'rosca_punho'
    if 'rosca' in n or 'curl' in n:
        if tem(n, r'scott', r'preacher') or ('maquina' in n): return 'rosca_scott'
        if 'concentrad' in n: return 'rosca_concentrada'
        if tem(n, r'spider', r'brucos'): return 'rosca_spider'
        if tem(n, r'inclinad') and 'deitado' not in n: return 'rosca_inclinada'
        if tem(n, r'trx', r'corporal no smith'): return 'remada_trx'
        if tem(n, r'alternad', r'zottman', r'pinwheel', r'cruzada'): return 'rosca_alternada'
        return 'rosca'
    if tem(n, r'hand grip', r'aperto de bolinha', r'gripper', r'pegada com hand grip', r'treino de pegada'): return 'pegada'
    if tem(n, r'pinca', r'plate pinch', r'sustentacao'):
        return 'caminhada_carga' if 'caminhada' in n else 'segurar'
    if tem(n, r'triceps', r'pushdown', r'tate press', r'kickback', r'extensao deitado com halteres', r'rolling tricep'):
        if tem(n, r'coice', r'kickback'): return 'triceps_coice'
        if tem(n, r'testa', r'deitado', r'rolling', r'tate'): return 'triceps_testa'
        if tem(n, r'halo'): return 'halo'
        if tem(n, r'frances', r'overhead', r'acima da cabeca'):
            return 'triceps_frances_cabo' if tem(n, r'cabo', r'polia') else 'triceps_frances'
        if tem(n, r'banco'): return 'mergulho_banco'
        if tem(n, r'maquina'): return 'triceps_maquina'
        if tem(n, r'smith', r'trx', r'mesa', r'corpo apoiado'): return 'flexao_esfinge'
        if tem(n, r'landmine'): return 'triceps_frances'
        return 'triceps_pulley'

    # ===== cardio / funcional
    if tem(n, r'pular corda', r'double under', r'corda imaginaria', r'jump rope'): return 'pular_corda'
    if tem(n, r'polichinelo', r'jumping jack', r'seal jack'):
        if tem(n, r'corda naval'): return 'corda_naval'
        if tem(n, r'sem salto', r'baixo impacto'): return 'polichinelo_baixo'
        if tem(n, r'frontal', r'seal'): return 'polichinelo_frontal'
        return 'polichinelo'
    if tem(n, r'salto estrela'): return 'salto_estrela'
    if tem(n, r'burpee', r'sprawl', r'squat thrust', r'man maker', r'devil press'):
        if tem(n, r'cadeira', r'inclinado', r'parede'): return 'burpee_inclinado'
        if tem(n, r'sem salto', r'squat thrust', r'sprawl'): return 'squat_thrust'
        return 'burpee'
    if tem(n, r'swing') and not 'raquete' in n: return 'kb_swing_americano' if 'american' in n else 'kb_swing'
    if tem(n, r'figura 8'): return 'kb_swing'
    if tem(n, r'corda naval', r'battle rope'):
        return 'corda_naval_dupla' if tem(n, r'batida dupla', r'slam', r'circulos') else 'corda_naval'
    if tem(n, r'cabo de guerra'): return 'treno_puxar'
    if tem(n, r'treno', r'prowler'):
        if 'urso' in n: return 'engatinhar_urso'
        if tem(n, r'arrast', r'puxa', r'corda', r'de costas', r'lateral'): return 'treno_puxar'
        return 'treno'
    if tem(n, r'thruster'): return 'thruster'
    if tem(n, r'wall ball'): return 'wall_ball'
    if tem(n, r'snatch', r'arranque\b') and 'arremesso' not in n: return 'snatch'
    if tem(n, r'clean', r'arranque e arremesso', r'atlas', r'pedra', r'saco de areia ao ombro'): return 'clean'
    if tem(n, r'complex', r'kettlebell complex'):
        if 'halteres' in n: return 'thruster'
        if 'kettlebell' in n: return 'kb_swing'
        return 'clean'
    if tem(n, r'marreta', r'pneu'): return 'marreta' if tem(n, r'marreta') else 'virada_pneu'
    if tem(n, r'slam'): return 'burpee' if 'burpee' in n else 'slam'
    if tem(n, r'arremesso', r'chest pass', r'shot put'):
        if tem(n, r'deitado'): return 'abdominal_bracos' if 'acima' in n else 'supino_chao'
        if tem(n, r'peito', r'chest', r'shot put', r'passada'): return 'passe_peito'
        if tem(n, r'rotacional', r'scoop'): return 'arremesso_rotacional'
        if tem(n, r'para tras'): return 'arremesso_tras'
        return 'arremesso_cima'
    if tem(n, r'turkish'): return 'turkish'
    if tem(n, r'saco de pancadas', r'shadow boxing', r'boxe', r'socos'):
        return 'boxe_sentado' if tem(n, r'sentad', r'cadeira') else 'boxe'
    if tem(n, r'chute'): return 'chute'
    if tem(n, r'joelhada', r'joelho ao cotovelo'): return 'joelhada'
    if tem(n, r'caranguejo', r'crab'): return 'caranguejo'
    if tem(n, r'bear crawl', r'engatinhar'): return 'engatinhar_urso'
    if tem(n, r'inchworm', r'lagarta'): return 'inchworm'
    if tem(n, r'pirate', r'navios piratas'): return 'rotacao_em_pe'
    if tem(n, r'farmer', r'carregamento', r'carry', r'caminhada com (carga|mochila|sacolas|kettlebell)', r'rucking', r'suitcase march', r'marcha unilateral com carga', r'caminhada abracando', r'yoke'):
        if tem(n, r'abracando', r'bear hug'): return 'carregamento_abraco'
        if tem(n, r'overhead', r'acima', r'waiter'): return 'caminhada_acima'
        if tem(n, r'tandem', r'em linha'): return 'caminhada_tandem'
        return 'caminhada_carga'
    if tem(n, r'waiter'): return 'caminhada_acima'
    if tem(n, r'bicicleta', r'bike', r'spinning', r'assault'):
        if tem(n, r'em pe', r'subida'): return 'bike_em_pe'
        if tem(n, r'horizontal', r'reclinada'): return 'bike_reclinada'
        return 'bike'
    if tem(n, r'eliptico'): return 'eliptico'
    if tem(n, r'remo'): return 'remo'
    if tem(n, r'escada ergometrica', r'stairmaster'): return 'escada_ergometrica'
    if tem(n, r'escada de agilidade'): return 'escada_agilidade'
    if tem(n, r'esteira'):
        return 'caminhada_esteira' if tem(n, r'caminhada', r'deslocamento lateral') else 'corrida_esteira'
    if tem(n, r'skipping', r'high knees'): return 'skipping'
    if tem(n, r'anfersen', r'calcanhar no gluteo'): return 'anfersen'
    if tem(n, r'split step'): return 'split_step'
    if tem(n, r'golpes de sombra', r'forehand'): return 'forehand'
    if tem(n, r'backhand'): return 'backhand'
    if tem(n, r'smash', r'saque'): return 'smash' if not 'salto' in n else 'salto'
    if tem(n, r'voleio'): return 'voleio'
    if tem(n, r'reacao com bola'): return 'reacao_bola'
    if tem(n, r'salto', r'jump', r'pogo', r'saltitos', r'hops', r'bounding', r'aterrissagem'):
        if tem(n, r'caixa', r'box jump') and 'lateral' not in n: return 'salto_caixa'
        if tem(n, r'grupado', r'tuck'): return 'salto_grupado'
        if tem(n, r'distancia', r'broad', r'sapo', r'bounding'): return 'salto_distancia'
        if tem(n, r'pogo'): return 'pogo'
        if tem(n, r'lateral', r'cones', r'line', r'saltitos', r'hops'): return 'salto_lateral'
        if tem(n, r'unipodal'): return 'salto_unipodal'
        if tem(n, r'patinador', r'skater'): return 'skater'
        return 'salto'
    if tem(n, r'skater', r'patinador'): return 'skater'
    if tem(n, r'carioca', r'passo cruzado', r'grapevine'): return 'passo_cruzado'
    if tem(n, r'shuffle', r'passadas laterais', r'deslocamento lateral', r'monster walk', r'band walk', r'caminhada lateral', r'passo lateral'):
        if tem(n, r'monster', r'band walk', r'mini band', r'caminhada lateral', r'passo lateral') and not 'cone' in n: return 'caminhada_lateral'
        return 'deslocamento_lateral'
    if tem(n, r'fast feet', r'pes rapidos', r'toques rapidos', r'drop step', r'crossover step', r'kitchen', r'giro rapido', r'backpedal', r'frenagem', r'single-cone'): return 'pes_rapidos'
    if tem(n, r'sprint', r'corrida', r'shuttle', r'zigue', r'agilidade', r'pro agility', r't-test', r'spider drill', r'drill em z', r'barreiras', r'wall drill', r'trote'):
        return 'corrida'
    if tem(n, r'circuito'):
        if 'cadeira' in n: return 'sentar_levantar'
        return 'burpee'
    if tem(n, r'amrap', r'tabata'): return 'kb_swing' if 'kettlebell' in n else 'burpee'

    # ===== equilibrio / 50+
    if tem(n, r'marcha sentad'): return 'marcha_sentado'
    if tem(n, r'obstaculos', r'dupla tarefa'): return 'obstaculos'
    if tem(n, r'marcha', r'joelho alto') and not tem(n, r'giros', r're\)', r'para tras'): return 'marcha'
    if tem(n, r'tandem', r'calcanhar-ponta', r'calcanhar ponta'):
        return 'caminhada_tandem' if 'caminhada' in n else 'tandem'
    if tem(n, r'caminhada', r'walk', r'marcha'): return 'caminhada'
    if tem(n, r'aviao', r'airplane'): return 'aviao_quadril'
    if tem(n, r'relogio'): return 'relogio'
    if tem(n, r'alcance funcional'): return 'alcance'
    if tem(n, r'transferencia de peso'): return 'transferencia_peso'
    if tem(n, r'passo de recuperacao', r'anti-queda'): return 'afundo'
    if tem(n, r'equilibrio', r'balance', r'tree pose', r'unipodal'):
        if 'com apoio' in n: return 'equilibrio_apoio'
        if tem(n, r'bosu') and 'agachamento' in n: return 'pistol_apoio'
        return 'equilibrio'

    # ===== ultimo recurso por categoria
    return None


# ----------------------------------------------------------------------------- 2) implemento na mao
AP_PROP = {'halteres': 'halteres', 'barra': 'barra', 'barra_ez': 'barra_ez', 'kettlebell': 'kettlebell', 'elastico': 'elastico',
           'mini_band': 'mini_band', 'polia': 'polia', 'crossover': 'crossover', 'trx': 'trx', 'landmine': 'landmine',
           'medicine_ball': 'medicine_ball', 'anilha': 'anilha', 'mochila': 'mochila', 'toalha': 'toalha', 'saco_areia': 'saco_areia',
           'smith': 'smith', 'corda_naval': 'corda_naval', 'corda_pular': 'corda_pular', 'raquete': 'raquete', 'hand_grip': 'hand_grip'}

# templates em que a maquina/cenario ja e o aparelho (nada na mao)
SEM_PROP = {'leg_press', 'hack', 'agachamento_maquina_deitado', 'extensora', 'flexora_deitado', 'flexora_sentado', 'puxada', 'puxada_fechada',
            'remada_sentada', 'remada_maquina', 'peck_deck', 'voador_inverso', 'supino_maquina', 'desenvolvimento_maquina', 'cadeira_abdutora',
            'cadeira_adutora', 'panturrilha_maquina', 'panturrilha_leg_press', 'coice_maquina', 'crunch_maquina', 'rosca_scott_maq',
            'triceps_maquina', 'bike', 'bike_em_pe', 'bike_reclinada', 'eliptico', 'remo', 'escada_ergometrica', 'corrida_esteira',
            'caminhada_esteira', 'treno', 'treno_puxar', 'virada_pneu', 'marreta', 'barra_fixa', 'barra_fixa_supinada', 'muscle_up',
            'pendurado', 'mergulho', 'elevacao_joelhos_suspenso', 'elevacao_pernas_suspenso', 'elevacao_joelhos_paralelas',
            'roda_abdominal', 'extensao_lombar', 'ghd_abdominal', 'nordico', 'front_lever', 'escada_agilidade', 'pular_corda',
            'corda_naval', 'corda_naval_dupla', 'remada_invertida', 'l_sit', 'dragon_flag', 'parada_mao', 'hspu', 'wall_walk',
            'canivete_bola', 'prancha_bola', 'stir_pot', 'supino_bola' }
# templates de mobilidade/corpo livre em que objetos de mao nao fazem sentido
SO_CORPO = {'prancha', 'prancha_alta', 'prancha_toque', 'prancha_urso', 'urso_toque', 'mountain_climber', 'mountain_climber_cruzado',
            'gato_camelo', 'postura_crianca', 'bird_dog', 'superman', 'nadador', 'cobra', 'esfinge', 'flexao', 'flexao_joelhos',
            'flexao_inclinada', 'flexao_declinada', 'flexao_explosiva', 'flexao_diamante', 'pike_pushup', 'flexao_esfinge',
            'flexao_parede', 'caranguejo', 'engatinhar_urso', 'inchworm', 'pombo', 'sentado_90_90', 'sapo', 'borboleta', 'respiracao',
            'bascula', 'joelhos_peito', 'torcao_deitado', 'gluteo_deitado', 'gluteo_sentado', 'alongamento_quadriceps',
            'alongamento_quadriceps_deitado', 'afundo_ajoelhado', 'couch_stretch', 'worlds_greatest', 'alongamento_peitoral',
            'alongamento_peitoral_costas', 'ombro_cruzado', 'triceps_acima', 'alongamento_panturrilha', 'pescoco', 'queixo',
            'circulos_bracos', 'cars_ombro', 'balanco_perna', 'cars_quadril', 'circulo_quadril', 'quatro_apoios_circulos',
            'livro_aberto', 'rotacao_toracica', 'planche', 'prancha_lateral_joelhos', 'prancha_estrela', 'prancha_lateral_quadril',
            'copenhagen', 'concha', 'skater', 'polichinelo_baixo', 'polichinelo_frontal', 'salto_estrela', 'squat_jack', 'skipping',
            'anfersen', 'caminhada', 'caminhada_tandem', 'marcha', 'tandem', 'transferencia_peso', 'relogio', 'alcance', 'aviao_quadril',
            'levantar_chao', 'squat_thrust', 'burpee_inclinado', 'salto', 'salto_grupado', 'salto_distancia', 'salto_unipodal', 'pogo',
            'salto_lateral', 'pes_rapidos', 'deslocamento_lateral', 'passo_cruzado', 'obstaculos', 'marcha_sentado', 'extensao_toracica',
            'extensao_toracica_cadeira', 'rolo_costas', 'rolo_coxa', 'rolo_panturrilha', 'ponte_completa', 'nordico_reverso',
            'shrimp', 'sissy', 'hollow', 'v_up', 'v_sit', 'canivete_lateral', 'bicicleta_abdominal', 'flutter', 'elevacao_pernas',
            'prancha_reversa', 'prancha_pes_elevados', 'pike_suspenso', 'boxe_sentado', 'chute', 'joelhada', 'agachamento_parede',
            'agachamento_profundo', 'agachamento_rotacao', 'agachamento_pulso', 'equilibrio_apoio', 'agachamento_mini'}


def implemento(e, t):
    n = norm(e['nome']); q = norm(e.get('equipamento', '')); ap = e['aparelho']; txt = n + ' | ' + q
    if t in SEM_PROP: return None
    p = AP_PROP.get(ap)
    # pistas no nome/equipamento (o nome manda)
    pistas = [
        (r'2 kettlebells|dois kettlebells|duas kettlebells|kettlebells', 'kettlebells'),
        (r'kettlebell', 'kettlebell'), (r'medicine ball|bola medicinal|bola de medicina|slam ball|bola de 0|bola leve', 'medicine_ball'),
        (r'mini band', 'mini_band'), (r'elastico|banda de resistencia|\bband\b|superband', 'elastico'),
        (r'crossover|entre polias|polias', 'crossover'), (r'polia|cabo|pulley|cable', 'polia'), (r'smith', 'smith'),
        (r'landmine|barra t\b|t-bar|cavalinho', 'landmine'), (r'\btrx\b|fita de suspensao', 'trx'), (r'mochila|sacolas', 'mochila'),
        (r'saco de areia|sandbag|galoes', 'saco_areia'), (r'anilha', 'anilha'), (r'garrafa', 'halteres'),
        (r'barra w|\bez\b', 'barra_ez'), (r'raquete', 'raquete'), (r'hand grip|gripper|bolinha', 'hand_grip'),
        (r'toalha', 'toalha'),
    ]
    for rx, val in pistas:
        if re.search(rx, n):
            p = val; break
    else:
        if p is None:
            for rx, val in pistas + [(r'\bbarra\b(?! (fixa|vertical|horizontal|baixa))', 'barra'), (r'halter', 'halteres')]:
                if re.search(rx, q) and not q.startswith('peso corporal'):
                    p = val; break
    if p in ('halteres',) and (re.search(r'\bhalter\b', n) or 'unilateral' in n or re.search(r'^halter\b|\bhalter\b', q) and not re.search(r'halteres', q)):
        p = 'halter'
    if p == 'barra' and re.search(r'barra fixa|barra vertical|barra horizontal|barra baixa', txt): p = None
    if t in ('crossover', 'crossover_baixo', 'crossover_medio') and p == 'polia': p = 'crossover'
    if t in SO_CORPO and p not in ('mini_band', 'elastico', 'raquete'): p = None
    if t in SO_CORPO and p == 'elastico' and t not in ('alongamento_posterior_deitado',): p = None
    return p


# ----------------------------------------------------------------------------- 3) apoio (cenario trocado)
def apoio(e, t, meta):
    n = norm(e['nome']); q = norm(e.get('equipamento', ''))
    pistas = [(r'bola suica|bola', 'bola_suica'), (r'\btrx\b', 'trx'), (r'cadeira|sofa|cama|mesa|bancada|pia', 'cadeira'),
              (r'caixa|box', 'caixa'), (r'degrau|step|escada', 'degrau'), (r'bosu', 'bosu'), (r'parede|batente', 'parede'),
              (r'banco inclinado', 'banco_inclinado'), (r'banco', 'banco'), (r'aneis|argolas', 'argolas'), (r'mesa', 'mesa')]
    if not meta['tpl'].get(t, {}).get('apoio'):
        if re.search(r'cones?|mini barreiras', n + ' ' + q) and t in ('corrida', 'pes_rapidos', 'skater', 'caminhada', 'salto', 'salto_unipodal', 'split_step'): return 'cones'
        return None
    for rx, val in pistas:
        if re.search(rx, n):
            return val
    return None


# ----------------------------------------------------------------------------- 4) excecoes manuais (revisadas por categoria)
# id: (template, implemento ou None/'-', apoio ou None)
EXC = {
    # auditoria 12/10/2026: ilustracao mostrava outro movimento
    'cm3_inclinacao_banco_romano': ('flexao_lateral', '-', None),
    'cb3_rosca_mochila': ('rosca', 'saco_areia', None),
    # pernas
    'pe_agach_bul': ('bulgaro', 'halteres', None),
    'pe_pantu': ('panturrilha_maquina', None, None),
    'pe_glute_kick': ('coice_em_pe', 'polia', None),
    'pe_step_up_halteres': ('step_up', 'halteres', 'banco'),
    'pe_wall_sit': ('agachamento_parede', None, None),
    'pe_box_squat': ('agachamento_banco', 'barra', 'caixa'),
    'pe_deficit_dl': ('terra', 'barra', None),
    'pe_calf_donkey': ('panturrilha_maquina', None, None),
    'pe_cable_hip_ext': ('coice_em_pe', 'polia', None),
    'pe_batch3_extra_3': ('agachamento', 'polia', None),
    'pe_batch3_extra_7': ('nordico_reverso', None, None),
    'pe_batch3_extra_8': ('agachamento', 'barra', None),
    'pe_batch3_extra_9': ('nordico', None, None),
    'pe_batch3_extra_11': ('panturrilha_maquina', None, None),
    'pl_hip_flexor_raise': ('marcha', None, None),
    'pl_single_leg_calf': ('panturrilha_pe', None, 'degrau'),
    'lb_af2': ('bulgaro', 'halteres', 'banco'),
    'lb_sq1': ('pistol_apoio', None, None),
    'acad_flexora_em_pe': ('flexora_em_pe', None, None),
    'acad_adutor_cabo': ('aducao_em_pe', 'polia', None),
    'acad_panturrilha_smith': ('panturrilha_pe', 'smith', None),
    'acad_agach_landmine': ('agachamento', 'landmine', None),
    'acad_trx_agach': ('agachamento', 'trx', None),
    'acad_trx_bulgaro': ('bulgaro', None, 'trx'),
    'acad_bosu_agach': ('agachamento', None, None),
    'acad_landmine_afundo': ('afundo_reverso', 'landmine', None),
    'casa_agach_bola_parede': ('agachamento_bola_parede', None, None),
    'casa_agach_frontal_2kb': ('agachamento_frontal', 'kettlebells', None),
    'casa_terra_kb': ('terra', 'kettlebell', None),
    'casa_bulgaro_cadeira_mochila': ('bulgaro', 'mochila', 'cadeira'),
    'rq_panturrilha_excentrica': ('panturrilha_pe', None, 'degrau'),
    'rq_soleo_joelho_flexionado': ('panturrilha_chao', None, None),
    'rq_afundo_lateral_dink': ('afundo_lateral', 'raquete', None),
    'rq_afundo_rotacional': ('afundo', 'medicine_ball', None),
    'rq_agach_espanhol': ('agachamento', 'elastico', None),
    's50_sentar_levantar_halter': ('sentar_levantar', 'halter', None),
    's50_extensao_joelho_sentado': ('extensao_joelho_sentado', None, None),
    's50_panturrilha_apoio': ('panturrilha_chao', None, None),
    's50_subida_escada': ('step_up', None, 'degrau'),
    's50_step_up_halteres_pausa': ('step_up', 'halteres', 'degrau'),
    's50_avanco_apoio': ('afundo', None, None),
    'sr3_agach_halter_banco': ('agachamento_banco', 'halteres', None),
    'sr3_agach_pendulo': ('hack', None, None),
    'sr3_extensora_isometrica': ('extensora', None, None),
    'sr3_terra_cabo': ('terra', 'polia', None),
    'sr3_rdl_kickstand': ('stiff', 'halter', None),
    'sr3_panturrilha_sentado_halter': ('panturrilha_sentado', 'halter', 'cadeira'),
    'sr3_step_up_lateral_halteres': ('step_lateral', 'halteres', 'banco'),
    'gp3_romeno_deficit': ('stiff', 'barra', None),
    'gp3_romeno_kickstand': ('stiff', 'halteres', None),
    'gp3_stiff_polia': ('stiff', 'polia', None),
    'gp3_stiff_unilateral_polia': ('stiff_unilateral', 'polia', None),
    'gp3_stiff_unilateral_parede': ('stiff_unilateral', 'halter', None),
    'gp3_cadeira_flexora_inclinada': ('flexora_sentado', None, None),
    'gp3_flexora_excentrica': ('flexora_deitado', None, None),
    'gp3_flexora_polia_em_pe': ('flexora_em_pe', 'polia', None),
    'gp3_flexora_trx': ('flexora_deslizante', '-', None),
    'gp3_nordico_elastico': ('nordico', None, None),
    'gp3_ghr_natural': ('nordico', None, None),
    'gp3_flexora_bola_unilateral': ('flexora_bola', None, None),
    'gp3_flexora_toalha_unilateral': ('flexora_deslizante', None, None),
    'gp3_aducao_elastico': ('aducao_em_pe', 'elastico', None),
    'gp3_aducao_sentado_squeeze': ('aducao_sentado', None, None),
    'gp3_ponte_squeeze': ('ponte', None, None),
    'gp3_sumo_halter_steps': ('agachamento_sumo', 'halter', None),
    'gp3_cossack_kb': ('afundo_lateral', 'kettlebell', None),
    'gp3_afundo_lateral_trx': ('afundo_lateral', 'trx', None),
    'qp3_hack_barra': ('terra', 'barra', None),
    'qp3_leg_press_smith': ('leg_press', None, None),
    'qp3_extensao_polia': ('extensao_joelho_sentado', None, None),
    'qp3_extensao_halter_banco': ('extensao_joelho_sentado', '-', None),
    'qp3_sissy_banco': ('sissy', None, None),
    'qp3_sissy_anilha': ('sissy', 'anilha', None),
    'qp3_pistol_smith': ('pistol', 'smith', None),
    'qp3_frankenstein': ('agachamento_frontal', 'barra', None),
    'qp3_agach_barra_elasticos': ('agachamento', 'barra', None),
    'qp3_afundo_polia': ('afundo_reverso', 'polia', None),
    'qp3_bulgaro_polia': ('bulgaro', 'polia', None),
    'qp3_landmine_hack': ('agachamento', 'landmine', None),
    'qp3_agach_cyclist': ('agachamento_frontal', 'halteres', None),
    'qp3_kb_pistol': ('pistol', 'kettlebell', None),
    'qp3_kb_rack_unilateral': ('agachamento_frontal', 'kettlebell', None),
    'qp3_pant_rocking': ('panturrilha_chao', 'barra', None),
    'qp3_pant_barra_sentado': ('panturrilha_sentado', 'barra', 'banco'),
    'qp3_pant_soleo_smith': ('panturrilha_sentado', '-', None),
    'qp3_pant_polia': ('panturrilha_pe', 'polia', None),
    'qp3_pant_sobre_halter': ('panturrilha_chao', None, None),
    'qp3_pant_caminhada_ponta': ('caminhada_carga', 'halteres', None),
    'qp3_tibial_kb': ('tibial_sentado', '-', 'banco'),
    'qp3_tibial_polia': ('tibial_sentado', 'polia', None),
    'qp3_tibial_smith': ('tibial', '-', None),
    'qp3_tibial_anilha': ('tibial_sentado', '-', 'banco'),
    'qp3_tibial_calcanhar_halteres': ('caminhada_carga', 'halteres', None),
    'pl_back_squat_highbar': ('agachamento', 'barra', None),
    'pl_back_squat_lowbar': ('agachamento', 'barra', None),
    # costas
    'co_ext_lombar': ('extensao_lombar', None, None),
    'co_remada_cavalinho': ('remada_curvada', 'landmine', None),
    'co_t_bar_row': ('remada_curvada', 'landmine', None),
    'lb_co9': ('remada_curvada', 'landmine', None),
    'co_meadow_row': ('remada_curvada', 'landmine', None),
    'co_rack_pull': ('terra', 'barra', None),
    'co_shrug_bar': ('encolhimento', 'barra', None),
    'co_bent_over_lat': ('crucifixo_inverso', 'halteres', None),
    'co_batch3_2': ('remada_alta', 'kettlebell', None),
    'co_batch3_4': ('remada_curvada', 'barra', None),
    'co_batch3_6': ('pulldown_ajoelhado', 'elastico', None),
    'co_batch3_8': ('face_pull', 'halteres', None),
    'co_batch3_11': ('puxada_unilateral', 'polia', None),
    'co_snatch_high_pull': ('remada_alta', 'barra', None),
    'co_lat_shrug': ('puxada', None, None),
    'casa_remada_mochila': ('remada_curvada', 'mochila', None),
    'casa_remada_toalha_porta': ('remada_em_pe', 'toalha', None),
    'casa_remada_gorila': ('remada_curvada', 'kettlebells', None),
    'cb3_barra_pes_cadeira': ('barra_fixa', None, None),
    'cb3_arrasto_toalhas_chao': ('nadador', None, None),
    'cb3_puxada_isometrica_toalha': ('pulldown_ajoelhado', 'toalha', None),
    'cb3_remada_alta_ajoelhado_polia': ('pulldown_ajoelhado', 'polia', None),
    'cb3_remada_alta_unilateral_ajoelhado': ('pulldown_ajoelhado', 'polia', None),
    'cb3_pulldown_banco_inclinado': ('pulldown_estendido', 'polia', None),
    'cb3_pullover_bola_suica': ('pullover', 'halter', 'bola_suica'),
    'cb3_remada_invertida_smith': ('remada_invertida', None, None),
    'cb3_remada_invertida_mesa': ('remada_invertida', None, 'mesa'),
    'cb3_remada_garrafas': ('remada_curvada', 'halteres', None),
    'cb3_remada_isometrica_toalha': ('remada_sentada_chao', 'toalha', None),
    'cb3_remada_mochila_unilateral': ('remada_unilateral', 'mochila', 'cadeira'),
    'cb3_remada_kettlebell_unilateral': ('remada_unilateral', 'kettlebell', None),
    'cb3_remada_landmine_unilateral_ajoelhado': ('remada_unilateral', 'landmine', None),
    'cb3_remada_smith_unilateral': ('remada_curvada', 'smith', None),
    'cb3_remada_toalha_halter': ('remada_unilateral', 'halter', None),
    'cb3_scap_row_trx': ('remada_trx', None, None),
    'cb3_depressao_escapular_pulley': ('puxada', None, None),
    'cb3_y_elastico_em_pe': ('elevacao_y', 'elastico', None),
    'cb3_good_morning_sentado': ('bom_dia_sentado', 'barra', None),
    'cm3_bom_dia_sentado': ('bom_dia_sentado', 'barra', None),
    'cm3_ext_lombar_chao_sofa': ('superman', None, None),
    'cm3_hiper_reversa_banco': ('hiper_reversa', None, None),
    'cm3_bird_dog_banco': ('bird_dog', None, None),
    'co_prone_cobra': ('superman', None, None),
    'acad_remada_alta_maquina': ('remada_maquina', None, None),
    'acad_remada_baixa_unilateral': ('remada_sentada', None, None),
    'rq_remada_rotacional_trx': ('remada_trx', None, None),
    's50_remada_elastico_sentado': ('remada_sentada_chao', 'elastico', None),
    'sr3_remada_cadeira_halteres': ('remada_curvada', 'halteres', None),
    'sr3_retracao_banco_inclinado': ('remada_apoiada', 'halteres', None),
    'sr3_puxada_ajoelhado_uni': ('pulldown_ajoelhado', 'polia', None),
    'cb3_puxada_crossover_ajoelhado': ('pulldown_ajoelhado', 'crossover', None),
    'cb3_puxada_unilateral_elastico_ajoelhado': ('pulldown_ajoelhado', 'elastico', None),
    'cb3_remada_t_deitado': ('remada_apoiada', 'landmine', None),
    'co_incline_row': ('remada_apoiada', 'barra', None),
    'co_chest_supported_row': ('remada_apoiada', 'halteres', None),
    'co_seal_row': ('remada_apoiada', 'halteres', None),
    'func_barbell_row': ('remada_curvada', 'barra', None),
    'co_ring_row_feet_elevated': ('remada_invertida', None, 'argolas'),
    'cal_ring_row': ('remada_invertida', None, 'argolas'),
    'cal_inverted_row': ('remada_invertida', None, None),
    'cal_australian_row': ('remada_invertida', None, None),
    # peito
    'pe_supino_inc': ('supino_inclinado', 'barra', None),
    'pe_supino_dec': ('supino_declinado', 'barra', None),
    'pe_flexao_aneis': ('flexao', None, None),
    'pe_svend_press': ('svend', 'anilha', None),
    'pe_batch3_3': ('supino_em_pe', 'polia', None),
    'pe_batch3_5': ('flexao_inclinada', None, 'bola_suica'),
    'pe_batch3_8': ('crossover_medio', 'crossover', None),
    'pe_flat_band_press': ('supino', 'barra', None),
    'pe_hs_press_parallel': ('pike_pushup', None, None),
    'pe_chest_dip_rings': ('flexao_declinada', None, None),
    'pe_dumbbell_pullover_ext': ('pullover', 'halter', None),
    'pe_loaded_stretch': ('crucifixo', 'halteres', None),
    'pe_360_fly': ('crossover', 'crossover', None),
    'acad_supino_cabo_pe': ('supino_em_pe', 'polia', None),
    'casa_flexao_inclinada': ('flexao_inclinada', None, 'cadeira'),
    'casa_supino_elastico': ('supino_em_pe', 'elastico', None),
    'casa_crucifixo_elastico': ('crossover_medio', 'elastico', None),
    'sr3_supino_cabo_uni_afundo': ('supino_em_pe', 'polia', None),
    'pt3_supino_cabo_sentado': ('supino_maquina', None, None),
    'pt3_crucifixo_cabo_banco_reto': ('crucifixo', 'polia', None),
    'pt3_supino_inc_cabo': ('supino_inclinado', 'polia', None),
    'pt3_trx_crucifixo': ('trx_frente', None, None),
    'pt3_mergulho_graviton': ('mergulho', None, None),
    'pt3_mergulho_cadeiras': ('mergulho_banco', None, 'cadeira'),
    'pt3_flexao_inclinada_supinada': ('flexao_inclinada', None, 'banco'),
    'pt3_aperto_isometrico_palmas': ('aperto_palmas', None, None),
    'pt3_supino_chao_galoes': ('supino_chao', 'halteres', None),
    'pt3_crucifixo_chao_garrafas': ('crucifixo', 'halteres', 'colchonete'),
    'pt3_crucifixo_elastico_baixo_cima': ('crossover_baixo', 'elastico', None),
    'pt3_crucifixo_elastico_cima_baixo': ('crossover', 'elastico', None),
    'pt3_supino_inc_elastico': ('supino_em_pe', 'elastico', None),
    'pt3_supino_elastico_uni_afundo': ('supino_em_pe', 'elastico', None),
    'pt3_supino_cabo_rotacao': ('supino_em_pe', 'polia', None),
    'pt3_supino_landmine_duas_maos': ('landmine_press', 'landmine', None),
    'pt3_bola_crucifixo': ('crucifixo', 'halteres', 'bola_suica'),
    'pt3_cruz_ferro_cabo': ('crossover', 'crossover', None),
    'pt3_crossover_ajoelhado': ('crossover', 'crossover', None),
    'pt3_supino_maq_descida_lenta': ('supino_maquina', None, None),
    # bracos
    'at_rosca_scott': ('rosca_scott', 'barra_ez', None),
    'at_rosca_banco_incl': ('rosca_inclinada', 'halteres', None),
    'at_chin_up_close': ('barra_fixa_supinada', None, None),
    'at_chin_hang': ('barra_fixa_supinada', None, None),
    'at_chin_eccentric': ('barra_fixa_supinada', None, None),
    'at_band_assisted_chin': ('barra_fixa_supinada', None, None),
    'at_batch3_2': ('rosca', 'polia', None),
    'at_batch3_3': ('rosca_punho', 'halteres', None),
    'at_batch3_4': ('rosca', 'halteres', None),
    'acad_rosca_maquina': ('rosca_scott', '-', None),
    'cb3_rosca_scott_maquina': ('rosca_scott', '-', None),
    'cb3_rosca_maquina_unilateral': ('rosca_scott', '-', None),
    'acad_rosca_scott_unilateral': ('rosca_scott', 'halter', None),
    'cb3_rosca_deitado_cabo': ('rosca', 'polia', None),
    'cb3_rosca_polia_alta_deitado': ('rosca', 'polia', None),
    'cb3_rosca_deitado_banco_reto': ('rosca_inclinada', 'halteres', None),
    'cb3_rosca_toalha_isometrica': ('rosca', 'toalha', None),
    'cb3_rosca_toalha_macaneta': ('rosca', 'toalha', None),
    'cb3_rosca_trx': ('rosca', 'trx', None),
    'cb3_rosca_corporal_smith': ('remada_trx', '-', None),
    'cb3_rosca_landmine': ('rosca', 'landmine', None),
    'cb3_pinca_anilhas': ('segurar', 'anilha', None),
    'cb3_bottoms_up_kettlebell': ('segurar', 'kettlebell', None),
    'cb3_suspensao_unilateral': ('pendurado', None, None),
    'cb3_rolo_punho_caseiro': ('pegada', '-', None),
    'cb3_sustentacao_barra_grossa': ('segurar', 'barra', None),
    'cb3_extensao_dedos_elastico': ('pegada', '-', None),
    'rq_extensao_punho': ('rosca_punho', 'halter', None),
    'rq_pronacao_supinacao': ('rosca_punho', 'halter', None),
    'rq_desvio_radial_ulnar': ('rosca_punho', 'halter', None),
    'sr3_ext_punho_exc_elastico': ('rosca_punho', '-', None),
    'sr3_rosca_martelo_toalha': ('rosca', 'halteres', None),
    'sr3_rosca_punho_costas': ('rosca_punho_pe', 'barra', None),
    'cb3_rosca_punho_atras_costas': ('rosca_punho_pe', 'barra', None),
    'tr_triceps_t': ('triceps_testa', 'barra_ez', None),
    'tr_triceps_frances': ('triceps_frances', 'halter', None),
    'tr_close_bench': ('supino', 'barra', None),
    'tr_jm_press': ('triceps_testa', 'barra', None),
    'tr_board_press': ('supino', 'barra', None),
    'tr_diamond_pushup_slow': ('flexao_diamante', None, None),
    'tr_batch3_1': ('supino_maquina', None, None),
    'tr_batch3_6': ('supino_chao', 'halter', None),
    'tr_dips_weighted': ('mergulho', None, None),
    'acad_mergulho_maquina': ('mergulho', None, None),
    'casa_triceps_toalha': ('triceps_frances', 'toalha', None),
    'pt3_triceps_cruzado_polia': ('triceps_pulley', 'crossover', None),
    'pt3_triceps_cabo_ajoelhado': ('triceps_frances_cabo', 'polia', None),
    'pt3_triceps_cabo_inclinado': ('triceps_testa', 'polia', None),
    'pt3_mergulho_banco_carga': ('mergulho_banco', None, None),
    'pt3_triceps_isometrico_mesa': ('triceps_pulley', '-', None),
    'pt3_extensao_triceps_mesa': ('flexao_esfinge', None, None),
    'pt3_flexao_esfinge': ('flexao_esfinge', None, None),
    'pt3_supino_fechado_smith': ('supino', 'smith', None),
    'pt3_floor_press_barra': ('supino_chao', 'barra', None),
    'pt3_flexao_inclinada_fechada': ('flexao_inclinada', None, 'cadeira'),
    # ombros
    'om_dev_front': ('desenvolvimento', 'halteres', None),
    'om_rem_alt': ('remada_alta', 'barra', None),
    'om_trap_encolher': ('encolhimento', 'halteres', None),
    'om_press_plate': ('desenvolvimento', 'anilha', None),
    'om_behind_neck': ('desenvolvimento', 'barra', None),
    'om_pike_pushup_wall': ('pike_pushup', None, None),
    'om_bottoms_up_kb': ('desenvolvimento_unilateral', 'kettlebell', None),
    'om_batch3_1': ('push_press', 'kettlebell', None),
    'om_batch3_2': ('remada_alta', 'kettlebell', None),
    'om_batch3_4': ('ytw', None, None),
    'om_batch3_5': ('prancha_toque', None, None),
    'om_batch3_6': ('pike_pushup', None, None),
    'om_batch3_8': ('rotacao_deitado', 'halter', None),
    'om_batch3_9': ('rotacao_deitado', 'halter', None),
    'om_band_pull_loop': ('elevacao_y', 'elastico', None),
    'lb_om8': ('rotacao_externa', 'elastico', None),
    'acad_crucifixo_inverso_cabo': ('crucifixo_inverso', 'crossover', None),
    'acad_y_raise_cabo': ('elevacao_y', 'crossover', None),
    'acad_trx_y': ('elevacao_y', 'trx', None),
    'casa_halo_kb': ('halo', 'kettlebell', None),
    'rq_serratil_parede': ('wall_slide', 'mini_band', None),
    'rq_flexao_plus': ('flexao', None, None),
    'sr3_rot_externa_isometrica_parede': ('rotacao_externa', '-', None),
    'sr3_rot_externa_sentado_joelho': ('rotacao_externa_90', 'halter', None),
    'sr3_arremesso_9090_parede': ('arremesso_cima', 'medicine_ball', None),
    'sr3_drop_catch_prono': ('ytw', None, None),
    'sr3_serratil_punch': ('serratil', 'halter', None),
    'sr3_desenv_cabo_sentado': ('desenvolvimento_sentado', 'crossover', None),
    'sr3_elev_lateral_cabo_sentado': ('elevacao_lateral', 'crossover', None),
    'om3_lateral_maquina': ('elevacao_lateral', '-', None),
    'om3_lateral_cabo_sentado': ('elevacao_lateral_uni', 'polia', None),
    'om3_lateral_cabo_atras': ('elevacao_lateral_uni', 'polia', None),
    'om3_lateral_crossover_cruzada': ('elevacao_lateral', 'crossover', None),
    'om3_lateral_inclinado_lado': ('elevacao_lateral_uni', 'halter', None),
    'om3_lateral_peito_apoiado': ('crucifixo_inverso_deitado', 'halteres', None),
    'om3_lateral_landmine': ('elevacao_lateral_uni', '-', None),
    'om3_lateral_trx': ('elevacao_lateral', 'trx', None),
    'om3_abducao_iso_parede': ('elevacao_lateral', '-', None),
    'om3_lateral_mini_band': ('elevacao_lateral', 'mini_band', None),
    'om3_remada_alta_smith_uni': ('remada_alta', 'smith', None),
    'om3_frontal_inclinado': ('elevacao_frontal', 'halteres', None),
    'om3_desenv_polia_sentado': ('desenvolvimento_sentado', 'crossover', None),
    'om3_desenv_mochila': ('desenvolvimento', 'saco_areia', None),  # mochila 'na mao', nao nas costas
    'om3_pike_deficit': ('pike_pushup', None, None),
    'om3_posterior_polia_curvado': ('crucifixo_inverso', 'crossover', None),
    'om3_remada_posterior_barra': ('remada_curvada', 'barra', None),
    'om3_posterior_elastico_ancorado': ('crucifixo_inverso', 'elastico', None),
    'om3_posterior_trx': ('remada_trx', None, None),
    'om3_posterior_iso_parede': ('anjo_parede', None, None),
    'om3_re_iso_batente': ('rotacao_externa', '-', None),
    'om3_kb_bottoms_up_carry': ('caminhada_carga', 'kettlebell', None),
    'om3_prancha_lateral_re': ('prancha_lateral', None, None),
    'om3_bola_parede_circulos': ('wall_slide', None, None),
    'om3_protracao_halteres': ('serratil', 'halteres', None),
    'om3_protracao_smith': ('serratil', '-', None),
    'om3_soco_cabo': ('supino_em_pe', 'polia', None),
    'om3_prancha_protracao': ('prancha', None, None),
    'om3_parede_rolo': ('wall_slide', None, None),
    'om3_urso_protracao': ('prancha_urso', None, None),
    'om3_flexao_plus_trx': ('trx_frente', None, None),
    'om3_encolh_maq_panturrilha': ('encolhimento', '-', None),
    'om3_encolh_inclinado': ('encolhimento', 'halteres', None),
    'om3_y_bola': ('ytw', None, None),
    'om3_retracao_cadeira': ('rotacao_sentado', None, None),
    'om3_depressao_cadeira': ('mergulho_banco', None, 'cadeira'),
    'om3_mergulho_escapular': ('mergulho', None, None),
    'om3_crucifixo_isometrico': ('elevacao_lateral', 'halteres', None),
    'om3_bananeira_toque_ombro': ('parada_mao', None, None),
    'om3_re_bilateral_elastico': ('rotacao_externa', 'elastico', None),
    'om3_re_brucos_90': ('ytw', None, None),
    'om3_re_passo_lateral_cabo': ('rotacao_externa', 'polia', None),
    'om3_d1_elastico': ('forehand', 'elastico', None),
    'sr3_d2_extensao_elastico': ('diagonal', 'elastico', None),
    'sr3_passaro_rot_externa': ('crucifixo_inverso_deitado', 'halteres', None),
    'om_partial_lat_raise': ('elevacao_lateral', 'halteres', None),
    'om_cuban_press': ('remada_alta', 'halteres', None),
    'om_empty_can': ('elevacao_y', 'halteres', None),
    'om_trap_raise': ('elevacao_y', 'halteres', None),
    'om_w_raise': ('elevacao_y', 'halteres', None),
    'om_lateral_lean': ('elevacao_lateral_uni', 'halter', None),
    # core
    'ab_leg_raise': ('elevacao_pernas', None, None),
    'ab_russian_twist': ('russian_twist', None, None),
    'ab_vacuum': ('vacuum', None, None),
    'ab_crunch_polia': ('crunch_polia', 'polia', None),
    'ab_side_bend': ('flexao_lateral', 'halter', None),
    'ab_stability_ball_crunch': ('abdominal', None, None),
    'ab_rollout_barbell': ('roda_abdominal', None, None),
    'ab_suitcase_crunch': ('v_up', None, None),
    'ab_landmine_rotation': ('rotacao_cabo', '-', None),
    'ab_batch3_1': ('mountain_climber', None, None),
    'ab_batch3_2': ('abdominal_infra', None, None),
    'ab_batch3_7': ('landmine_press', 'landmine', None),
    'ab_batch3_8': ('rotacao_em_pe', 'medicine_ball', None),
    'ab_batch3_9': ('copenhagen', None, None),
    'co_rotary_torso': ('rotacao_sentado', None, None),
    'ab_slider_pike': ('pike_suspenso', None, None),
    'lb_cr12': ('roda_abdominal', None, None),
    'acad_abdominal_declinado': ('sit_up', None, None),
    'casa_canivete_bola': ('canivete_bola', None, None),
    'casa_prancha_bola': ('prancha_bola', None, None),
    'casa_dead_bug_bola': ('dead_bug', None, None),
    'casa_toque_calcanhar': ('abdominal', None, None),
    'casa_prancha_lateral_remada': ('prancha_lateral', None, None),
    'hiit_plank_jack': ('prancha_alta', None, None),
    'rq_copenhagen_curto': ('copenhagen', None, None),
    'rq_cabo_lift': ('lift', 'polia', None),
    'rq_thread_needle': ('prancha_lateral', None, None),
    's50_prancha_parede': ('flexao_parede', None, None),
    'sr3_pallof_unipodal': ('pallof', 'elastico', None),
    'sr3_rotacao_cabo_peito': ('rotacao_cabo', 'polia', None),
    'sr3_passe_rotacional_costas': ('rotacao_em_pe', 'medicine_ball', None),
    'sr3_dead_bug_elastico': ('dead_bug', None, None),
    'sr3_chop_elastico_ajoelhado': ('woodchop', 'elastico', None),
    'sr3_rotacao_bola_suica': ('rotacao_em_pe', '-', None),
    'cf3_mountain_toalha': ('mountain_climber', None, None),
    'cf3_mountain_trx': ('mountain_climber', None, None),
    'cf3_mountain_bola': ('mountain_climber', None, None),
    'cm3_crunch_polia_em_pe': ('crunch_polia', 'polia', None),
    'cm3_crunch_polia_sentado': ('crunch_polia', 'polia', None),
    'cm3_crunch_polia_torcao': ('crunch_polia', 'polia', None),
    'cm3_abdominal_reverso_polia': ('abdominal_infra', None, None),
    'cm3_crunch_anilha_peito': ('abdominal', '-', None),
    'cm3_trx_abdominal_reverso': ('pike_suspenso', None, None),
    'cm3_trx_pike': ('pike_suspenso', None, None),
    'cm3_rollout_barra_banco': ('roda_abdominal', None, None),
    'cm3_rollout_bola': ('prancha_bola', None, None),
    'cm3_crunch_mochila': ('abdominal', '-', None),
    'cm3_crunch_medicine_ball': ('abdominal_bracos', 'medicine_ball', None),
    'cm3_dead_bug_kettlebell': ('dead_bug', None, None),
    'cm3_russian_twist_polia': ('rotacao_cabo', 'polia', None),
    'cm3_russian_twist_anilha': ('russian_twist', 'anilha', None),
    'cm3_woodchop_halter': ('woodchop', 'halter', None),
    'cm3_medball_full_twist': ('rotacao_em_pe', 'medicine_ball', None),
    'cm3_inclinacao_polia_alta': ('inclinacao_lateral', '-', None),
    'cm3_inclinacao_barra': ('inclinacao_lateral', '-', None),
    'cm3_inclinacao_elastico': ('inclinacao_lateral', '-', None),
    'cm3_windmill_halter': ('windmill', 'halter', None),
    'cm3_prancha_lateral_trx': ('prancha_lateral', None, None),
    'cm3_arremesso_deitado': ('abdominal_bracos', 'medicine_ball', None),
    'cal_dragon': ('dragon_flag', None, None),
    'cal_stir_pot': ('stir_pot', None, None),
    'cc_ab_rollout_standing': ('roda_abdominal', None, None),
    'cc_planche_lean_adv': ('planche', None, None),
    'cm3_hollow_anilha': ('hollow', None, None),
    'cm3_lsit_grupado_halteres': ('l_sit', None, None),
    'cc_back_lever_tuck': ('front_lever', None, None),
    'cal_planche_pushup': ('flexao', None, None),
    # empurrar / skills
    'cal_pike_elev': ('pike_pushup', None, None),
    'cal_push_batch3_0': ('flexao_explosiva', None, None),
    'cal_push_batch3_3': ('hspu', None, None),
    'cal_push_batch3_4': ('flexao_inclinada', None, 'bola_suica'),
    'casa_flexao_mochila': ('flexao', '-', None),
    'casa_flexao_pes_bola': ('flexao_declinada', None, 'bola_suica'),
    'pt3_flexao_maos_bola': ('flexao_inclinada', None, 'bola_suica'),
    'pt3_flexao_desnivelada': ('flexao', None, None),
    'pt3_flexao_elastico': ('flexao', '-', None),
    'pt3_flexao_toalha_deslizante': ('flexao', None, None),
    'pt3_flexao_plio_kb': ('flexao_explosiva', None, None),
    'cal_ring_pushup': ('flexao_inclinada', None, None),
    'cal_ring_dips': ('mergulho', None, 'argolas'),
    'sk_ring_support': ('mergulho', None, 'argolas'),
    'cal_human_flag': ('front_lever', None, None),
    'cal_flag_negativo': ('front_lever', None, None),
    'sk_flag_tuck': ('front_lever', None, None),
    'cal_skin_cat': ('front_lever', None, None),
    'cal_maltese': ('front_lever', None, None),
    'sk_hs_balance_drill': ('parada_mao', None, None),
    'sk_handstand_wall': ('parada_mao', None, None),
    'cal_wall_hs': ('parada_mao', None, None),
    'cal_free_hs': ('parada_mao', None, None),
    'cal_crow_stand': ('planche', None, None),
    'sk_frog_stand': ('planche', None, None),
    'cal_lsit': ('l_sit', None, None),
    # puxar
    'cal_dead_hang': ('pendurado', None, None),
    'cal_scap_pull': ('pendurado', None, None),
    'pu_towel_pullup': ('barra_fixa', None, None),
    'pu_ring_muscle_up': ('muscle_up', None, None),
    'pu_false_grip': ('barra_fixa', None, None),
    'pu_l_sit_pull': ('barra_fixa', None, None),
    'fn_grip_hang_towel': ('pendurado', None, None),
    'acad_barra_graviton': ('barra_fixa', None, None),
    # pernas calistenia / 50+
    'cal_nordic': ('nordico', None, None),
    'cal_nordic_hold': ('nordico', None, None),
    'cal_standing_hip_circle': ('cars_quadril', None, None),
    'cal_bear_crawl': ('engatinhar_urso', None, None),
    'cal_pistol_box': ('pistol_apoio', None, 'banco'),
    'cal_legs_batch3_0': ('agachamento_isometrico', None, None),
    'cal_legs_batch3_1': ('abducao_deitado', None, None),
    'cal_legs_batch3_2': ('cars_quadril', None, None),
    'cal_legs_batch3_3': ('ponte_unilateral', None, None),
    'cal_legs_batch3_4': ('afundo_lateral', None, None),
    'cal_legs_batch3_5': ('sissy', None, None),
    'cal_legs_batch3_6': ('bulgaro', None, 'banco'),
    'cal_legs_batch3_7': ('pistol_apoio', None, None),
    'cal_squat_180': ('agachamento_salto', None, None),
    'casa_tibial_parede': ('tibial', None, None),
    'casa_skater_squat': ('shrimp', None, None),
    'casa_agach_salto_lateral': ('deslocamento_lateral', None, None),
    'hiit_afundo_joelho': ('afundo_reverso', None, None),
    'hiit_step_joelho': ('step_up_joelho', None, 'degrau'),
    'hiit_salto_sapo': ('salto_distancia', None, None),
    'rq_aterrissagem': ('salto', None, None),
    'rq_salto_smash': ('salto', None, None),
    's50_sentar_levantar_unipodal': ('sentar_levantar', None, None),
    'sr3_afundo_reverso_trx': ('afundo_reverso', 'trx', None),
    'sr3_aducao_bola_joelhos': ('aducao_sentado', None, None),
    'sr3_cossack_trx': ('afundo_lateral', 'trx', None),
    'sr3_flexora_elastico_sentado': ('flexora_cadeira', 'elastico', None),
    'sr3_panturrilha_elastico': ('tibial_sentado', 'elastico', 'cadeira'),  # sentado na cadeira, nao maquina
    'sr3_dorsiflexao_elastico': ('tibial_sentado', 'elastico', None),
    'sr3_inversao_eversao': ('tornozelo', None, None),
    'sr3_flexao_quadril_elastico': ('marcha', None, None),
    'sr3_hop_lateral_unipodal': ('salto_lateral', None, None),
    'sr3_drop_saida_lateral': ('salto', None, None),
    'qp3_agach_elastico': ('agachamento', 'elastico', None),
    'qp3_extensao_joelho_elastico': ('extensao_joelho_sentado', 'elastico', None),
    'qp3_step_up_alto_mochila': ('step_up', 'mochila', 'cadeira'),
    'qp3_petersen_step_up': ('step_up', None, 'degrau'),
    'qp3_agach_unilat_bola': ('agachamento_bola_parede', None, None),
    'qp3_bulgaro_bola': ('bulgaro', None, 'bola_suica'),
    'qp3_wall_sit_unilateral': ('agachamento_parede', None, None),
    'qp3_mini_agach_cadeira': ('agachamento_mini', None, None),
    'qp3_pant_trx': ('panturrilha_chao', None, None),
    'qp3_pant_elastico': ('panturrilha_chao', None, None),
    'qp3_pant_kb_unilateral': ('panturrilha_pe', 'kettlebell', 'degrau'),
    'qp3_pant_mochila': ('panturrilha_pe', 'mochila', 'degrau'),
    'qp3_pant_sentado_mochila': ('panturrilha_sentado', 'mochila', 'cadeira'),
    'qp3_pant_cadeirinha': ('agachamento_parede', None, None),
    'qp3_pant_isometrica_unipodal': ('panturrilha_chao', None, None),
    'qp3_pant_donkey_casa': ('panturrilha_pe', None, 'degrau'),
    'qp3_pogo_unilateral': ('pogo', None, None),
    'qp3_tibial_elastico': ('tibial_sentado', 'elastico', None),
    'qp3_tibial_sentado_mochila': ('tibial_sentado', None, 'cadeira'),
    'qp3_tibial_degrau': ('tibial', None, None),
    'qp3_bosu_afundo': ('afundo', None, None),
    'qp3_agach_toalha_porta': ('agachamento_toalha', 'toalha', None),
    # gluteos
    'lb_gl1': ('hip_thrust', 'barra', None),
    'lb_gl3': ('cadeira_abdutora', None, None),
    'lb_gl4': ('abducao_em_pe', 'mini_band', None),
    'lb_gl5': ('coice_em_pe', 'polia', None),
    'lb_gl6': ('coice_em_pe', 'elastico', None),
    'lb_gl7': ('step_up', 'halteres', 'banco'),
    'lb_gl8': ('caminhada_lateral', 'mini_band', None),
    'lb_gl9': ('concha', 'mini_band', None),
    'lb_gl11': ('hip_thrust', None, None),
    'lb_gl12': ('afundo_lateral', None, None),
    'lb_gl13': ('stiff', 'halteres', None),
    'acad_hack_reverso': ('hack', None, None),
    'acad_smith_hip_thrust': ('hip_thrust', 'smith', None),
    'acad_pull_through': ('kb_swing', 'polia', None),
    'acad_abdutora_inclinada': ('cadeira_abdutora', None, None),
    'casa_hip_thrust_sofa': ('hip_thrust', 'mochila', 'cadeira'),
    'casa_agach_mini_band': ('agachamento', 'mini_band', None),
    'casa_ponte_abducao': ('ponte', 'mini_band', None),
    'casa_frog_pump': ('ponte', None, None),
    'casa_ponte_unilateral_mochila': ('hip_thrust', 'mochila', 'cadeira'),
    'rq_star_plank': ('prancha_estrela', None, None),
    'rq_band_walk_atletica': ('caminhada_lateral', 'mini_band', None),
    's50_extensao_quadril_apoio': ('coice_em_pe', None, 'cadeira'),
    's50_abducao_sentado_elastico': ('abducao_sentado', 'mini_band', None),
    'sr3_elevacao_pelvica_maquina': ('hip_thrust', '-', None),
    'gp3_hip_thrust_maquina': ('hip_thrust', '-', None),
    'gp3_ponte_barra_chao': ('ponte', 'barra', None),
    'gp3_hip_thrust_polia': ('hip_thrust', 'polia', None),
    'gp3_coice_smith': ('coice', None, None),
    'gp3_coice_halter_joelho': ('coice', None, None),
    'gp3_coice_polia_4apoios': ('coice', 'polia', None),
    'gp3_gluteo_multi_hip_extensao': ('coice_maquina', None, None),
    'gp3_hiper_reversa_bola': ('hiper_reversa', None, 'bola_suica'),
    'gp3_flutter_pronado': ('hiper_reversa', None, None),
    'gp3_agach_ajoelhado_barra': ('agachamento_ajoelhado', 'barra', None),
    'gp3_frog_pump_halter': ('ponte', 'halteres', None),
    'gp3_ponte_trx': ('ponte_pes_elevados', None, None),
    'gp3_ponte_smith_chao': ('ponte', 'smith', None),
    'gp3_kickback_polia_diagonal': ('coice_em_pe', 'polia', None),
    'gp3_coice_mini_band': ('coice', 'mini_band', None),
    'gp3_ponte_elastico_quadril': ('ponte', '-', None),
    'gp3_ponte_pes_parede': ('ponte_pes_elevados', None, 'parede'),
    'gp3_ponte_unilateral_degrau': ('ponte_pes_elevados', None, 'degrau'),
    'gp3_ponte_unilateral_cadeira': ('ponte_pes_elevados', None, 'cadeira'),
    'gp3_ponte_halter_quadril': ('ponte', 'halter', None),
    'gp3_hip_thrust_sofa_elastico': ('hip_thrust', '-', 'cadeira'),
    'gp3_extensao_quadril_prona': ('superman', None, None),
    'gp3_pull_through_elastico': ('kb_swing', 'elastico', None),
    'gp3_abducao_multi_hip': ('abducao_em_pe', '-', None),
    'gp3_abducao_elastico_em_pe': ('abducao_em_pe', 'mini_band', None),
    'gp3_abducao_deitado_halter': ('abducao_deitado', None, None),
    'gp3_concha_reversa': ('concha', None, None),
    'gp3_prancha_lateral_joelhos_abducao': ('prancha_lateral_joelhos', None, None),
    'gp3_hip_airplane_assistido': ('aviao_quadril', None, None),
    'gp3_abducao_isometrica_parede': ('abducao_em_pe', '-', None),
    'gp3_prancha_lateral_concha': ('prancha_lateral_joelhos', 'mini_band', None),
    'gp3_circulos_4apoios': ('quatro_apoios_circulos', None, None),
    'gp3_abdutora_3_angulos': ('cadeira_abdutora', None, None),
    'gp3_abducao_bola_suica': ('abducao_em_pe', '-', None),
    'gp3_clam_halter': ('concha', None, None),
    'gp3_hiperext_isometrica': ('extensao_lombar', None, None),
    'gp3_hiperext_45_unilateral': ('extensao_lombar', None, None),
    'acad_hiperextensao_gluteo': ('extensao_lombar', None, None),
    'gp3_hiper_reversa_banco': ('hiper_reversa', None, None),
    'gp3_bulgaro_inclinado': ('bulgaro', 'halteres', 'banco'),
    'gp3_afundo_reverso_inclinado': ('afundo_reverso', 'halteres', None),
    'gp3_leg_press_pes_altos': ('leg_press', None, None),
    # funcional / cardio
    'func_farmers_walk': ('caminhada_carga', 'halteres', None),
    'func_thruster': ('thruster', 'halteres', None),
    'func_turkish_getup': ('turkish', 'kettlebell', None),
    'func_battle_rope': ('corda_naval', None, None),
    'func_sled_push': ('treno', None, None),
    'func_pull_sled': ('treno_puxar', None, None),
    'func_rdl_halter': ('stiff', 'halteres', None),
    'func_agach_goblet': ('agachamento', 'kettlebell', None),
    'func_waiter_carry': ('caminhada_acima', 'kettlebell', None),
    'func_push_press': ('push_press', 'barra', None),
    'func_med_ball_slam': ('slam', 'medicine_ball', None),
    'func_tire_flip': ('virada_pneu', None, None),
    'func_wall_ball': ('wall_ball', 'medicine_ball', None),
    'func_band_pull_apart': ('pull_apart', 'elastico', None),
    'func_single_leg_rdl': ('stiff_unilateral', 'halter', None),
    'func_broad_jump': ('salto_distancia', None, None),
    'func_trap_bar_dl': ('terra', 'barra', None),
    'func_clean_jerk': ('clean', 'barra', None),
    'func_tire_carry': ('carregamento_abraco', 'saco_areia', None),
    'func_sled_row': ('treno_puxar', None, None),
    'func_yoke_carry': ('caminhada_carga', 'barra', None),
    'func_atlas_stone': ('clean', 'saco_areia', None),
    'neck_flexion': ('queixo', None, None),
    'neck_lateral': ('pescoco', None, None),
    'act_glute_activation': ('abducao_em_pe', 'mini_band', None),
    'act_band_walk': ('caminhada_lateral', 'mini_band', None),
    'act_rotator_cuff': ('rotacao_externa', 'elastico', None),
    'comp_muscle_snatch': ('snatch', 'barra', None),
    'comp_zercher_squat': ('agachamento_frontal', 'barra', None),
    'comp_push_jerk': ('push_press', 'barra', None),
    'comp_hang_clean': ('clean', 'barra', None),
    'func_jump_squats_weight': ('agachamento_salto', 'halteres', None),
    'func_kb_press': ('desenvolvimento_unilateral', 'kettlebell', None),
    'func_box_step_over': ('step_up', None, 'caixa'),
    'func_sandbag_carry': ('carregamento_abraco', 'saco_areia', None),
    'func_kb_snatch': ('snatch', 'kettlebell', None),
    'func_hip_hinge': ('stiff', '-', None),
    'func_goblet_squat_pause': ('agachamento', 'kettlebell', None),
    'func_batch3_0': ('clean', 'saco_areia', None),
    'func_batch3_2': ('slam', 'medicine_ball', None),
    'func_batch3_3': ('boxe', None, None),
    'func_batch3_4': ('step_up', 'halteres', 'banco'),
    'func_batch3_6': ('rotacao_cabo', 'polia', None),
    'func_batch3_7': ('push_press', 'barra', None),
    'func_batch3_8': ('remada_alta', 'kettlebell', None),
    'func_batch3_9': ('desenvolvimento', 'barra', None),
    'func_batch3_10': ('treno_puxar', None, None),
    'func_batch3_12': ('pegada', 'hand_grip', None),
    'func_batch3_13': ('pegada', '-', None),
    'func_batch3_14': ('caminhada_carga', 'barra', None),
    'fn_renegade_row': ('remada_renegade', 'halteres', None),
    'fn_single_leg_dl_kb': ('stiff_unilateral', 'kettlebell', None),
    'fn_overhead_squat': ('agachamento_overhead', 'barra', None),
    'fn_jump_rope_complex': ('pular_corda', None, None),
    'fn_cable_chop': ('woodchop', 'polia', None),
    'fn_deadmill_sprint': ('corrida_esteira', None, None),
    'fn_tgu_light': ('turkish', 'kettlebell', None),
    'fn_bear_complex': ('clean', 'barra', None),
    'fn_kb_complex': ('kb_swing', 'kettlebell', None),
    'fn_sprint_resistance': ('corrida', None, None),
    'fn_medball_chest_pass': ('passe_peito', 'medicine_ball', None),
    'fn_overhead_carry': ('caminhada_acima', 'kettlebell', None),
    'fn_box_lateral_jump': ('salto_lateral', None, None),
    'casa_kb_clean_press': ('clean', 'kettlebell', None),
    'casa_snatch_halter': ('snatch', 'halter', None),
    'casa_man_maker': ('burpee', 'halteres', None),
    'casa_devil_press': ('burpee', 'halteres', None),
    'casa_kb_figura8': ('kb_swing', 'kettlebell', None),
    'casa_afundo_passagem_kb': ('afundo', 'kettlebell', None),
    'hiit_complexo_halteres': ('thruster', 'halteres', None),
    'hiit_kb_clean_squat': ('clean', 'kettlebell', None),
    'hiit_amrap_corpo': ('burpee', None, None),
    'hiit_burpee_box_over': ('burpee', None, None),
    'rq_mb_scoop': ('arremesso_rotacional', 'medicine_ball', None),
    'rq_mb_smash': ('arremesso_cima', 'medicine_ball', None),
    'rq_tyler_twist': ('pegada', '-', None),
    'rq_forehand_elastico': ('forehand', 'elastico', None),
    'rq_reacao_bola': ('reacao_bola', 'bola_tenis', None),
    's50_levantar_do_chao': ('levantar_chao', None, None),
    's50_torcao_toalha': ('pegada', '-', None),
    's50_aperto_bolinha': ('pegada', 'hand_grip', None),
    's50_farmer_tandem': ('caminhada_tandem', None, None),
    's50_marcha_mala': ('caminhada_carga', 'kettlebell', None),
    's50_levantar_chao_sem_maos': ('levantar_chao', None, None),
    'sr3_plate_pinch': ('segurar', 'anilha', None),
    'sr3_extensores_dedos': ('pegada', '-', None),
    'sr3_carry_bottoms_up': ('caminhada_carga', 'kettlebell', None),
    'sr3_farmer_sacolas': ('caminhada_carga', 'mochila', None),
    'sr3_shot_put_mb': ('passe_peito', 'medicine_ball', None),
    'sr3_arremesso_ajoelhado': ('arremesso_rotacional', 'medicine_ball', None),
    'sr3_backhand_elastico': ('backhand', 'elastico', None),
    'sr3_passo_arremesso_mb': ('arremesso_rotacional', 'medicine_ball', None),
    'sr3_landmine_rotacional': ('landmine_press', 'landmine', None),
    'cf3_polia_ski': ('pulldown_estendido', 'crossover', None),
    'cf3_corda_naval_sentado': ('corda_naval', None, None),
    'cf3_treno_press': ('treno', None, None),
    'cf3_kb_swing_duplo': ('kb_swing', 'kettlebells', None),
    'cf3_kb_dead_clean': ('clean', 'kettlebell', None),
    'cf3_kb_clean_jerk': ('clean', 'kettlebell', None),
    'cf3_kb_rack_carry': ('caminhada_carga', 'kettlebells', None),
    'cf3_kb_carry_misto': ('caminhada_carga', 'kettlebells', None),
    'cf3_kb_pirate_ships': ('rotacao_em_pe', 'kettlebell', None),
    'om3_navios_piratas_kb': ('rotacao_em_pe', 'kettlebell', None),
    'cf3_kb_dead_stop_swing': ('kb_swing', 'kettlebell', None),
    'cf3_kb_afundo_press': ('afundo_reverso', 'kettlebell', None),
    'cf3_halter_clean': ('clean', 'halteres', None),
    'cf3_halter_burpee_terra': ('burpee', 'halteres', None),
    'cf3_halter_swing': ('kb_swing', 'halter', None),
    'cf3_halter_afundo_rosca_press': ('afundo', 'halteres', None),
    'cf3_halter_step_press': ('step_up', 'halteres', None),
    'cf3_landmine_clean_press': ('landmine_press', 'landmine', None),
    'cf3_burpee_sobre_barra': ('burpee', None, None),
    'cf3_mb_slam_lateral': ('slam', 'medicine_ball', None),
    'cf3_mb_burpee_slam': ('burpee', 'medicine_ball', None),
    'cf3_mb_wall_ball_sentado': ('arremesso_cima', 'medicine_ball', None),
    'cf3_sandbag_clean': ('clean', 'saco_areia', None),
    'cf3_sandbag_ombro': ('clean', 'saco_areia', None),
    'cf3_carry_galoes': ('caminhada_carga', 'saco_areia', None),
    'cf3_carry_anilhas_pinca': ('caminhada_carga', 'anilha', None),
    'cf3_burpee_barra_fixa': ('burpee', None, None),
    'cf3_bear_crawl_lateral': ('engatinhar_urso', None, None),
    'cf3_inchworm_flexao': ('inchworm', None, None),
    'cf3_caranguejo_toque': ('caranguejo', None, None),
    'cf3_wall_drill': ('corrida', None, 'parede'),
    'cf3_shuttle_run': ('corrida', None, 'cones'),
    'cf3_zigue_zague_cones': ('corrida', None, 'cones'),
    'cf3_elastico_thruster': ('thruster', 'elastico', None),
    'cf3_elastico_agach_remada': ('agachamento', 'elastico', None),
    'cf3_trx_agach_salto': ('agachamento_salto', None, None),
    'cf3_bosu_burpee': ('burpee', None, None),
    'cf3_polia_sprint': ('corrida', None, None),
    'cm3_slam_unilateral': ('slam', 'medicine_ball', None),
    'om3_jammer_unilateral': ('landmine_press', 'landmine', None),
    'om3_arremesso_medball_cabeca': ('arremesso_cima', 'medicine_ball', None),
    'pt3_mb_peito_3_apoios': ('passe_peito', 'medicine_ball', None),
    'pt3_mb_arremesso_deitado': ('supino_chao', 'medicine_ball', None),
    'pt3_mb_unilateral_passada': ('passe_peito', 'medicine_ball', None),
    'sr3_passe_peito_deitado': ('supino_chao', 'medicine_ball', None),
    'sr3_arremesso_tras': ('arremesso_tras', 'medicine_ball', None),
    'func_batch3_5': ('arremesso_rotacional', 'medicine_ball', None),
    'cond_clean_complex': ('clean', 'barra', None),
    'cond_farmers_singles': ('caminhada_carga', 'kettlebell', None),
    'cond_sled_sprint': ('treno', None, None),
    'cond_prowler': ('treno', None, None),
    'cond_vertimax': ('salto', None, None),
    'cond_batch3_1': ('boxe', None, None),
    'cond_batch3_3': ('deslocamento_lateral', None, None),
    'cond_batch3_4': ('burpee', None, None),
    'cond_batch3_5': ('kb_swing', 'kettlebell', None),
    'ca_circuit_bodyweight': ('burpee', None, None),
    'ca_lateral_shuffles': ('deslocamento_lateral', None, None),
    'ca_step_aerobics': ('step_up_joelho', None, None),
    'hiit_soco_agach': ('agachamento_pulso', None, None),
    'hiit_joelhada_soco': ('joelhada', None, None),
    'hiit_toques_degrau': ('step_up_joelho', None, None),
    'hiit_patinador_baixo': ('skater', None, None),
    'hiit_marcha_bracos': ('marcha', None, None),
    'hiit_circuito_cadeira': ('sentar_levantar', None, None),
    'rq_split_step_reacao': ('split_step', None, None),
    'rq_shuffle_cones': ('deslocamento_lateral', None, None),
    'rq_crossover_step': ('passo_cruzado', None, None),
    'rq_drop_step': ('pes_rapidos', None, None),
    'rq_estrela_cones': ('deslocamento_lateral', None, None),
    'rq_t_test': ('corrida', None, 'cones'),
    'rq_kitchen_drill': ('pes_rapidos', None, None),
    'rq_frenagem_3_passos': ('corrida', None, 'cones'),
    'rq_pro_agility': ('corrida', None, 'cones'),
    's50_marcha_sentado': ('marcha_sentado', None, None),
    's50_bicicleta_horizontal': ('bike_reclinada', None, None),
    's50_caminhada_ritmada': ('caminhada', None, None),
    'sr3_rucking_mochila': ('caminhada', 'mochila', None),
    'sr3_carioca': ('passo_cruzado', None, None),
    'sr3_backpedal': ('corrida', None, 'cones'),
    'sr3_drill_z': ('corrida', None, 'cones'),
    'sr3_shuffle_resistido': ('deslocamento_lateral', None, None),
    'sr3_barreiras_lateral': ('salto_lateral', None, None),
    'sr3_skipping_rapido': ('skipping', None, None),
    'sr3_cone_unico': ('pes_rapidos', None, None),
    'sr3_reacao_bola_parede': ('reacao_bola', 'bola_tenis', None),
    'sr3_split_step_afundo': ('afundo_lateral', 'raquete', None),
    'cf3_esteira_de_costas': ('caminhada_esteira', None, None),
    'cf3_esteira_lateral_inclinada': ('caminhada_esteira', None, None),
    'cf3_airbike_bracos': ('bike', None, None),
    'cf3_corda_imaginaria': ('pular_corda', '-', None),
    'cf3_socos_halteres': ('boxe', 'halteres', None),
    'cf3_rucking': ('caminhada', 'mochila', None),
    'cf3_burpee_cadeira': ('burpee_inclinado', None, 'cadeira'),
    'cf3_burpee_parede': ('flexao_parede', None, None),
    'cf3_burpee_step': ('burpee', None, None),
    'cf3_mountain_banco': ('mountain_climber', None, None),
    'cf3_joelho_cotovelo_pe': ('joelhada', None, None),
    'cf3_socos_sentado': ('boxe_sentado', None, None),
    'cf3_chute_frontal': ('chute', None, None),
    'cf3_seal_jack': ('polichinelo_frontal', None, None),
    'cf3_miniband_polichinelo': ('polichinelo', 'mini_band', None),
    'cf3_carioca': ('passo_cruzado', None, None),
    'cf3_split_jump': ('afundo_salto', None, None),
    'cf3_burpee_tuck': ('burpee', None, None),
    'cf3_burpee_unilateral': ('burpee', None, None),
    'cardio_sprint_30': ('corrida', None, None),
    'cond_hiit_sprint': ('corrida', None, None),
    'cardio_corrida_est': ('corrida', None, None),
    'aquec_agil_ladder': ('escada_agilidade', None, None),
    # mobilidade / alongamento
    'mobi_dislocate': ('dislocate', 'bastao', None),
    'mobi_shoulder_dislocate': ('dislocate', 'bastao', None),
    'mo_shoulder_cir': ('dislocate', 'bastao', None),
    'mobi_jefferson_curl': ('jefferson', None, None),
    'mobi_deep_squat': ('agachamento_profundo', None, None),
    'mobi_thoracic': ('rotacao_toracica', None, None),
    'mobi_world_greatest': ('worlds_greatest', None, None),
    'mobi_hip_flexor_stretch': ('afundo_ajoelhado', None, None),
    'mobi_90_90': ('sentado_90_90', None, None),
    'mobi_spinal_twist': ('torcao_deitado', None, None),
    'act_thoracic_ext': ('extensao_toracica', None, None),
    'mobi_lat_stretch': ('inclinacao_lateral', None, None),
    'mobi_hamstring_progressive': ('alongamento_posterior', None, None),
    'mobi_wall_ankle': ('tornozelo', None, None),
    'mobi_thoracic_rotation_wall': ('rotacao_em_pe', None, None),
    'mobi_frog_stretch': ('sapo', None, None),
    'mobi_wrist_series': ('gato_camelo', None, None),
    'mobi_thoracic_foam': ('extensao_toracica', None, None),
    'mo_thoracic_opener': ('livro_aberto', None, None),
    'mo_neck_stretch': ('pescoco', None, None),
    'lb_mob3': ('cars_ombro', None, None),
    'sr3_agach_rotacao_toracica': ('agachamento_rotacao', None, None),
    'sr3_mobilidade_punho_raquete': ('oito_raquete', 'raquete', None),
    'cm3_rotacao_barra_sentado': ('rotacao_sentado', None, None),
    'cm3_rotacao_bastao_pe': ('rotacao_em_pe', None, None),
    'cm3_agachamento_kettlebell_mob': ('agachamento_profundo', 'kettlebell', None),
    'cm3_toracica_banco': ('postura_crianca', None, None),
    'cm3_skin_cat_parcial': ('front_lever', None, None),
    'cm3_tornozelo_kettlebell': ('tornozelo', None, None),
    'cm3_tornozelo_elastico': ('tornozelo', None, None),
    'cm3_wall_slide_mini_band': ('wall_slide', 'mini_band', None),
    'cm3_cars_ombro': ('cars_ombro', None, None),
    'cm3_frog_rock': ('sapo', None, None),
    'cm3_mob_flexor_elastico': ('afundo_ajoelhado', None, None),
    'cm3_alongamento_toalha_costas': ('toalha_costas', 'toalha', None),
    'cm3_posterior_elastico': ('alongamento_posterior_deitado', 'elastico', None),
    'cm3_posterior_degrau': ('alongamento_posterior', None, None),
    'cm3_peitoral_bola': ('alongamento_peitoral', None, None),
    'cm3_banda_it_pe': ('inclinacao_lateral', None, None),
    'cm3_lateral_cadeira': ('inclinacao_lateral', None, None),
    'cm3_lombar_cadeira': ('alongamento_posterior_cadeira', None, None),
    'cm3_soleo_aquiles': ('alongamento_panturrilha', None, None),
    'cm3_panturrilha_degrau': ('alongamento_panturrilha_degrau', None, None),
    'cm3_tibial_ajoelhado': ('postura_crianca', None, None),
    'cm3_abdomen_cobra_parcial': ('esfinge', None, None),
    'cm3_deltoide_anterior_sentado': ('alongamento_peitoral_costas', None, None),
    'cm3_gluteo_sentado': ('gluteo_sentado', None, 'colchonete'),
    'lb_al1': ('alongamento_posterior_sentado', None, None),
    'lb_al6': ('gluteo_deitado', None, None),
    'lb_al8': ('inclinacao_lateral', None, None),
    'lb_al10': ('torcao_deitado', None, None),
    'rq_sleeper': ('rotacao_deitado', None, None),
    'rq_open_book': ('livro_aberto', None, None),
    's50_rotacao_tronco_sentado': ('rotacao_sentado', None, None),
    's50_circulos_bracos': ('circulos_bracos', None, None),
    's50_chin_tuck': ('queixo', None, None),
    'sr3_portao_quadril': ('cars_quadril', None, None),
    'mobi_hip_circle': ('circulo_quadril', None, None),
    'lb_mob1': ('circulo_quadril', None, None),
    'mobi_ankle_mob': ('tornozelo', None, None),
    'mobi_ankle_circles': ('tornozelo', None, None),
    # equilibrio
    'lb_eq2': ('stiff_unilateral', 'halter', None),
    'lb_eq3': ('equilibrio', None, None),
    'lb_eq4': ('equilibrio', 'halter', None),
    'lb_eq5': ('abducao_em_pe', None, None),
    'lb_eq6': ('pistol_apoio', None, 'cadeira'),
    'lb_eq7': ('equilibrio', None, None),
    'rq_bosu_lancamento': ('equilibrio', None, None),
    's50_tandem': ('tandem', None, None),
    's50_caminhada_tandem': ('caminhada_tandem', None, None),
    's50_passo_lateral': ('caminhada_lateral', None, None),
    's50_passo_cruzado': ('passo_cruzado', None, None),
    's50_olhos_fechados': ('tandem', None, None),
    's50_alcance_funcional': ('alcance', None, None),
    's50_ponta_calcanhar': ('caminhada', None, None),
    's50_equilibrio_almofada': ('equilibrio', None, None),
    'sr3_marcha_re': ('caminhada', None, None),
    'sr3_passo_reativo': ('afundo', None, None),
    'sr3_marcha_giro_cabeca': ('caminhada', None, None),
    'sr3_olhos_fechados_unipodal': ('equilibrio', None, None),
    'sr3_unipodal_bola_parede': ('equilibrio', None, None),
    'sr3_bosu_unipodal': ('pistol_apoio', None, None),
    'sr3_joelho_peito_caminhando': ('marcha', None, None),
    'sr3_frankenstein': ('marcha', None, None),
    'lb_al2': ('afundo_ajoelhado', None, None),
    'cb3_remada_baixa_pausa': ('remada_sentada', None, None),
    'pt3_limpador_isometrico': ('flexao', None, None),
    'cal_push_batch3_2': ('flexao_declinada', None, None),
    'cb3_rosca_rotacao_externa': ('rosca', 'halteres', None),
    'rq_pogo': ('pogo', None, None),
    'qp3_pant_sobre_halter': ('panturrilha_chao', '-', None),
    'casa_afundo_cruzado': ('afundo_cruzado', '-', None),
    'cm3_recolhimento_sentado_chao': ('v_up', None, None),
    'cm3_recolhimento_sentado_banco': ('v_up', None, None),
}

FALLBACK_CAT = {'pernas': 'agachamento', 'pernas_cal': 'agachamento', 'gluteos': 'ponte', 'costas': 'remada_curvada',
                'puxar': 'barra_fixa', 'peito': 'supino', 'empurrar': 'flexao', 'ombros': 'desenvolvimento', 'biceps': 'rosca',
                'triceps': 'triceps_pulley', 'core': 'prancha', 'core_cal': 'prancha', 'cardio': 'corrida', 'funcional': 'burpee',
                'mobilidade': 'gato_camelo', 'alongamento': 'alongamento_posterior', 'equilibrio': 'equilibrio', 'skills': 'parada_mao'}


def mapear(base, meta):
    out, origem = {}, {}
    for e in base:
        tpls = meta['tpl']
        if e['id'] in EXC:
            t, p, a = EXC[e['id']]
            if p is None: p = implemento(e, t)
            how = 'manual'
        else:
            t = template(e); how = 'regra'
            if not t:
                t = FALLBACK_CAT.get(e['categoria'], 'generico'); how = 'categoria'
            p = implemento(e, t)
            a = apoio(e, t, meta)
        if t not in tpls:
            raise SystemExit(f"template inexistente '{t}' em {e['id']}")
        tp = tpls[t]
        if p and p != '-' and p not in meta['props']: p = None
        if t in SEM_PROP and p != '-':
            p = None                      # maquina/cenario do template ja e o aparelho
        elif p is None and tp['p']:
            p = '-'                       # o padrao do template nao serve: sem implemento
        if p == tp['p']: p = None         # igual ao padrao: nao precisa gravar
        if a and a not in meta['cena']: a = None
        reg = {'t': t, 'v': tp['v']}
        if p: reg['p'] = p
        if a: reg['a'] = a
        out[e['id']] = reg; origem[e['id']] = how
    return out, origem


def embutir(mapa):
    """Embute o mapa no figuras.js em formato compacto: indice do template (base 36) + implemento + apoio."""
    s = JS.read_text(encoding='utf-8')
    tpls = sorted({v['t'] for v in mapa.values()})
    idx = {t: i for i, t in enumerate(tpls)}
    def b36(n):
        d = '0123456789abcdefghijklmnopqrstuvwxyz'; r = ''
        while True:
            n, k = divmod(n, 36); r = d[k] + r
            if not n: return r
    regs = []
    for k, v in mapa.items():
        campos = [b36(idx[v['t']]), v.get('p', ''), v.get('a', ''), v.get('m', '')]
        while campos and not campos[-1]: campos.pop()
        regs.append(f"{k}:{','.join(campos)}")
    linhas = '\n'.join(';'.join(regs[i:i + 8]) for i in range(0, len(regs), 8))
    bloco = ("  // <MAPA-GERADO> (nao edite a mao — rode ferramentas/mapear_figuras.py)\n"
             f"  const MAPA_T = '{' '.join(tpls)}'.split(' ');\n"
             f"  const MAPA_RAW = `{linhas}`;\n"
             "  // </MAPA-GERADO>")
    s2 = re.sub(r'  // <MAPA-GERADO>.*?// </MAPA-GERADO>', lambda m: bloco, s, flags=re.S)
    JS.write_text(s2, encoding='utf-8')


def main():
    base = json.loads(BASE.read_text(encoding='utf-8'))
    meta = meta_templates()
    mapa, origem = mapear(base, meta)
    if '--revisar' in sys.argv:
        cat = sys.argv[sys.argv.index('--revisar') + 1] if len(sys.argv) > sys.argv.index('--revisar') + 1 else None
        for e in base:
            if cat and e['categoria'] != cat: continue
            m = mapa[e['id']]
            print(f"{origem[e['id']][0]} {e['id']:<38} {e['nome'][:52]:<52} {e['aparelho']:<16} -> {m['t']} {m.get('p', '')} {m.get('a', '')}")
        return
    SAIDA.write_text(json.dumps(mapa, ensure_ascii=False, indent=0, separators=(',', ':')).replace('\n', ''), encoding='utf-8')
    embutir(mapa)
    cont = collections.Counter(v['t'] for v in mapa.values())
    print(f'{len(mapa)} exercicios mapeados | templates usados: {len(cont)} | manuais: {sum(1 for v in origem.values() if v == "manual")} | '
          f'por regra: {sum(1 for v in origem.values() if v == "regra")} | fallback de categoria: {sum(1 for v in origem.values() if v == "categoria")} | '
          f'genericos: {cont.get("generico", 0)}')
    for e in base:
        if origem[e['id']] == 'categoria': print('  fallback:', e['id'], e['nome'], '->', mapa[e['id']]['t'])


if __name__ == '__main__':
    main()
