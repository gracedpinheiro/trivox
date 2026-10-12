#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRIVOX — enriquecimento da base de exercícios (data/exercicios.json)

Reprodutível: lê o arquivo, aplica correções + classificação + exercícios novos
e regrava data/exercicios.json. Rodar a partir de qualquer pasta:

    python3 ferramentas/enriquecer_exercicios.py

Idempotente: exercícios de origem "trivox_v2" são descartados e recriados a
partir de ferramentas/novos_exercicios/*.txt; os campos de classificação dos
antigos são recalculados a cada execução (ids antigos e demais campos preservados).

Novos campos em TODOS os exercícios:
  local      : ["academia"] | ["casa"] | ["academia","casa"]
  objetivos  : subconjunto de condicionamento, perda_peso, hipertrofia, 50mais, raquete
  impacto    : baixo | medio | alto   (choque/aterrissagem/balístico — não é "dificuldade")
  aparelho   : chave normalizada do equipamento principal (lista fechada APARELHOS)
  fedb_id    : (só exercícios novos, quando há equivalente exato no free-exercise-db)
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, OrderedDict

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ARQ = os.path.join(RAIZ, "data", "exercicios.json")
DIR_NOVOS = os.path.join(AQUI, "novos_exercicios")
ARQ_CORRECOES = os.path.join(AQUI, "novos_exercicios", "_correcoes_existentes.txt")
FEDB = "/home/claude/ext/fedb.json"
RELATORIO = os.path.join(AQUI, "relatorio_exercicios.md")
MARCA_INI, MARCA_FIM = "<!-- TABELAS:INICIO -->", "<!-- TABELAS:FIM -->"

NIVEIS = ["iniciante", "intermediario", "avancado", "elite"]
LOCAIS = ["academia", "casa"]
OBJETIVOS = ["condicionamento", "perda_peso", "hipertrofia", "50mais", "raquete"]
IMPACTOS = ["baixo", "medio", "alto"]
WEEK = {"iniciante": 1, "intermediario": 5, "avancado": 9, "elite": 13}

APARELHOS_BASE = """peso_corporal colchonete parede cadeira degrau_step caixa_pliometrica halteres barra
barra_ez anilha kettlebell elastico mini_band bola_suica medicine_ball banco banco_inclinado barra_fixa
paralelas argolas trx roda_abdominal corda_pular corda_naval polia crossover puxador_pulley remada_baixa
smith leg_press hack cadeira_extensora mesa_flexora cadeira_abdutora cadeira_adutora panturrilha_maquina
supino_maquina voador_peck_deck remada_maquina desenvolvimento_maquina gluteo_maquina banco_romano esteira
bicicleta eliptico remo_ergometro escada_agilidade cones raquete treno landmine bosu foam_roller toalha
mochila""".split()
# Chaves novas (máx. 5) — faltavam na lista fechada
APARELHOS_NOVOS = {
    "maquina_abdominal": "Máquinas de abdominal / rotação de tronco",
    "maquina_bracos": "Máquinas de rosca / tríceps / mergulho",
    "pneu": "Pneu (virada, marreta)",
    "saco_areia": "Sandbag / atlas stone / objeto pesado / saco de pancadas",
    "hand_grip": "Hand grip, bolinha de apertar, wrist roller",
}
APARELHOS = set(APARELHOS_BASE) | set(APARELHOS_NOVOS)

# Aparelhos que, por padrão, permitem treinar em casa (equipamento doméstico barato)
APARELHO_CASA = set("""peso_corporal colchonete parede cadeira degrau_step halteres kettlebell elastico
mini_band bola_suica toalha mochila corda_pular barra_fixa foam_roller roda_abdominal cones
escada_agilidade hand_grip""".split())

# ---------------------------------------------------------------------------
# 1) APARELHO dos 563 exercícios antigos (revisado um a um)
# ---------------------------------------------------------------------------
APARELHO_EXISTENTES = {
 "barra": """pe_agachu pe_stiff pe_hip_thrust pe_terra_rom co_terra co_remada_c co_bom_dia pe_supino_r
   pe_supino_dec at_rosca_d om_rem_alt func_clean func_push_press at_rosca_21 tr_close_bench co_rack_pull
   co_shrug_bar pe_split_squat_bar pe_safety_squat pe_box_squat pe_pause_squat pe_romanian_dl pe_deficit_dl
   om_behind_neck at_reverse_curl at_drag_curl tr_jm_press func_sumo_dl func_trap_bar_dl func_barbell_row
   func_clean_jerk func_yoke_carry cal_inverted_row cal_australian_row cond_clean_complex func_snat
   func_paused_deadlift comp_muscle_snatch comp_zercher_squat comp_front_squat comp_push_jerk comp_hang_clean
   pe_bench_with_pause co_incline_row tr_board_press func_power_clean_from_hang ab_rollout_barbell pe_batch3_9
   co_batch3_4 pe_batch3_extra_1 pe_batch3_extra_8 om_batch3_0 at_batch3_5 func_batch3_7 func_batch3_14
   fn_overhead_squat pe_flat_band_press pl_back_squat_highbar pl_back_squat_lowbar fn_bear_complex
   co_snatch_high_pull lb_hp1 lb_co8 lb_br1""",
 "banco_inclinado": "pe_supino_inc",
 "leg_press": "pe_leg_press pe_leg_press_wide func_single_leg_press pe_batch3_extra_10",
 "hack": "pe_hack_squat lb_hk1",
 "cadeira_extensora": "pe_cadeira_ext pe_leg_ext_uni pl_quad_extension_drop",
 "mesa_flexora": "pe_mesa_flex pe_lying_curl pe_seated_leg_curl lb_cf1",
 "panturrilha_maquina": "pe_pantu pe_pantu_sent pe_calf_donkey func_seated_calf pe_batch3_extra_11 lb_pa2",
 "cadeira_adutora": "pe_adut_maq",
 "cadeira_abdutora": "pe_abd_maq lb_gl3",
 "polia": """pe_glute_kick co_face_pull at_rosca_cabo tr_triceps_p tr_triceps_cabo_corda tr_overhead_cabo
   om_lateral_cabo ab_crunch_polia ab_pallof_press pe_cable_hip_ext om_face_pull_rope om_upright_cable
   at_cable_curl tr_reverse_pushdown tr_cable_overhead ab_cable_crunch ab_cable_woodchop at_bayesian_curl
   tr_triceps_pushdown_v pe_batch3_3 co_batch3_3 co_batch3_11 pe_batch3_extra_3 om_batch3_7 at_batch3_6
   tr_batch3_2 tr_batch3_4 func_batch3_6 fn_cable_chop pl_hip_flexor_raise lb_gl5""",
 "crossover": "pe_crossover pe_cable_fly_high pe_cable_fly_low pe_incline_cable_fly pe_360_fly pe_batch3_7 pe_batch3_8 at_batch3_2",
 "puxador_pulley": "co_puxada_f co_puxada_supinada co_pull_lat_maq co_lat_pulldown_close co_batch3_1 co_lat_shrug lb_co11",
 "remada_baixa": "co_remada_h co_cable_row_wide",
 "remada_maquina": "co_remada_maq",
 "banco_romano": "co_ext_lombar pe_batch3_extra_9 ab_batch3_6",
 "landmine": "co_remada_cavalinho om_land_mine_press co_t_bar_row co_meadow_row ab_landmine_rotation ab_batch3_7 func_batch3_9 lb_co9",
 "supino_maquina": "pe_machine_chest_press pe_batch3_4 tr_batch3_1",
 "voador_peck_deck": "pe_peck_deck pe_batch3_1",
 "smith": "pe_smith_squat pe_batch3_6 co_batch3_9",
 "maquina_bracos": "tr_triceps_maq",
 "maquina_abdominal": "ab_abdominal_maq co_rotary_torso",
 "barra_ez": "at_rosca_scott tr_triceps_t at_batch3_1",
 "anilha": "om_press_plate pe_svend_press",
 "paralelas": "pe_mergulho pe_dips_bar tr_dips_weighted cal_lsit pe_hs_press_parallel",
 "argolas": """pe_flexao_aneis cal_ring_dips cal_ring_row cal_back_lever cal_ring_pushup cal_maltese pe_chest_dip_rings
   co_ring_row_feet_elevated cal_skin_cat cc_back_lever_tuck pu_ring_muscle_up pu_false_grip sk_ring_support""",
 "trx": "cal_legs_batch3_7",
 "barra_fixa": """cal_dead_hang cal_scap_pull cal_pull_neg cal_chin_up cal_pull_up cal_pull_neutro cal_pull_com_peso
   cal_archer_pull cal_muscle_up cal_one_arm_pull cal_front_lev cal_tuck_fl cal_human_flag at_chin_up_close
   at_chin_hang ab_hanging_knee ab_toes_to_bar cal_commando_pull cal_wide_pull at_chin_eccentric
   at_band_assisted_chin cal_flag_negativo pu_close_neutral pu_l_sit_pull pu_typewriter pu_neg_archer
   pu_explosive_pull pu_band_pull pu_gironda_sternum pu_mixed_grip sk_flag_tuck sk_front_lever_adv
   fn_grip_hang_towel pu_towel_pullup""",
 "halteres": """pe_agach_bul pe_agach_sum co_remada_hal co_pull_over pe_supino_hal pe_crucifixo pe_crucifixo_inc
   at_rosca_m at_rosca_concentrada at_rosca_inclinada tr_triceps_frances tr_kickback om_elev_lat om_dev_front
   om_dev_arnold om_elev_front om_bird_row om_trap_encolher func_farmers_walk func_thruster mobi_jefferson_curl
   func_rdl_halter func_single_leg_rdl at_rosca_zottman at_rosca_banco_incl pe_supino_hal_inc pe_step_up_halteres
   pe_fenda_hal co_serrote pe_floor_press co_seal_row co_bent_over_lat om_lateral_lean om_w_raise om_cuban_press
   at_spider_curl tr_single_arm_overhead ab_side_bend pe_low_incline pe_dumbbell_pullover_ext
   co_chest_supported_row om_trap_raise om_empty_can om_seated_db_press om_db_lateral_seated tr_rolling_ext
   func_jump_squats_weight pe_batch3_0 co_batch3_0 co_batch3_7 co_batch3_8 co_batch3_10 pe_batch3_extra_2
   om_batch3_3 om_batch3_8 om_batch3_9 at_batch3_0 at_batch3_3 at_batch3_4 tr_batch3_0 tr_batch3_5 tr_batch3_6
   func_batch3_4 fn_renegade_row pe_loaded_stretch bi_prone_incline_curl bi_pinwheel_curl om_partial_lat_raise
   tr_lying_db_extension lb_gl1 lb_gl13 lb_co5 lb_om1 lb_om4 lb_om5 lb_om7 lb_br2 lb_br8 lb_eq2 lb_eq4""",
 "kettlebell": """func_kettlebell_swing func_turkish_getup func_agach_goblet func_waiter_carry ab_windmill om_bottoms_up_kb
   func_kb_press func_kb_snatch cond_farmers_singles func_goblet_squat_pause co_batch3_2 pe_batch3_extra_0
   om_batch3_1 om_batch3_2 func_batch3_8 cond_batch3_5 fn_single_leg_dl_kb fn_tgu_light fn_kb_complex
   fn_overhead_carry""",
 "medicine_ball": "func_med_ball_slam func_wall_ball ab_batch3_8 func_batch3_2 func_batch3_5 fn_medball_chest_pass",
 "bola_suica": "ab_stability_ball_crunch act_thoracic_ext co_back_extension_ball cal_stir_pot pe_batch3_5 co_batch3_5 om_batch3_6 cal_push_batch3_4",
 "roda_abdominal": "ab_wheel cc_ab_rollout_standing co_ab_wheel_knees lb_cr12",
 "elastico": """mobi_dislocate func_band_pull_apart act_rotator_cuff mobi_shoulder_dislocate at_band_curl co_batch3_6
   pe_batch3_extra_6 tr_batch3_3 mo_shoulder_cir om_band_pull_loop fn_sprint_resistance tr_band_pushdown
   lb_gl6 lb_co10 lb_om8""",
 "mini_band": "act_glute_activation act_band_walk lb_gl4 lb_gl8 lb_gl9",
 "corda_pular": "aquec_pular_corda cond_jump_rope_du cond_batch3_7 fn_jump_rope_complex",
 "corda_naval": "func_battle_rope func_batch3_10",
 "escada_agilidade": "aquec_agil_ladder",
 "cones": "cond_batch3_3",
 "treno": "func_sled_push func_pull_sled cond_sled_sprint func_sled_row cond_prowler",
 "esteira": "fn_deadmill_sprint",
 "bicicleta": "cond_assault_bike cond_batch3_0 ca_air_bike_intervals",
 "remo_ergometro": "cond_rowing_machine cond_batch3_6",
 "degrau_step": "cal_step_up pl_single_leg_calf ca_step_aerobics lb_gl7 lb_eq3",
 "caixa_pliometrica": "func_box_jump cal_step_up_jump func_box_step_over cal_push_batch3_0 fn_box_lateral_jump",
 "banco": "tr_mergulho_banco ab_leg_raise cal_flex_elevada cal_pike_elev cal_dragon cal_pistol_box pe_batch3_2 ab_batch3_2 ab_batch3_9 cal_legs_batch3_6 lb_af2 lb_gl11 lb_br7",
 "parede": """cal_hspu_neg cal_hspu cal_wall_hs pe_wall_sit mobi_pec_stretch mobi_wall_ankle mobi_thoracic_rotation_wall
   om_pike_pushup_wall mobi_couch_stretch pe_batch3_extra_4 cal_push_batch3_3 sk_handstand_wall sk_hs_pushup_wall
   sk_hs_balance_drill lb_wb1 lb_al3 lb_al5""",
 "cadeira": "lb_eq6",
 "foam_roller": "mobi_thoracic_foam",
 "toalha": "ab_slider_pike",
 "pneu": "func_tire_flip func_batch3_11",
 "saco_areia": "func_tire_carry func_atlas_stone func_sandbag_carry func_batch3_0 func_batch3_3",
 "hand_grip": "func_batch3_12 func_batch3_13",
 "colchonete": """ab_prancha ab_crunch ab_crunch_obliquo ab_russian_twist ab_prancha_lat ab_dead_bug cal_flex_j cal_nordic
   cal_glute_bridge cal_hollow cal_hollow_rock ab_plank_to_pushup co_superman co_bird_dog pe_glute_bridge_single
   cal_crow_stand mobi_thoracic mobi_cat_cow mobi_hip_flexor_stretch mobi_pigeon_pose mobi_90_90 mobi_spinal_twist
   cal_v_sit mobi_hamstring_progressive cal_nordic_hold cal_reverse_plank mobi_frog_stretch ab_suitcase_crunch
   pe_batch3_extra_7 om_batch3_4 om_batch3_5 ab_batch3_0 ab_batch3_3 ab_batch3_4 ab_batch3_5 cal_legs_batch3_1
   cal_legs_batch3_3 sk_frog_stand mo_bretzel mo_shinbox mo_thoracic_opener co_flutter_kicks co_scissor_kicks
   co_prone_cobra lb_gl2 lb_gl10 lb_cr1 lb_cr6 lb_cr8 lb_cr10 lb_cr11 lb_mob6 lb_mob7 lb_al1 lb_al2 lb_al6 lb_al7
   lb_al10""",
 "peso_corporal": """pe_agach_salto ab_vacuum cal_flex cal_flex_diamante cal_flex_larga cal_pike cal_archer_pu cal_one_arm
   cal_agach_corp cal_agach_split cal_fenda cal_shrimp_sq cal_pistol cal_free_hs cal_tuck_planche cal_planche_neg
   func_burpee func_mountain_climb mobi_hip_circle mobi_ankle_mob mobi_deep_squat cardio_corrida_est
   cardio_jumping_jack cardio_sprint_30 func_broad_jump pe_sissy_squat cal_pseudo_planche cal_spiderman_push
   cal_clap_pushup cal_advanced_tuck mobi_world_greatest mobi_leg_swings cal_cossack_squat cal_squat_180
   cal_plyometric_lunge cal_planche_pushup neck_flexion neck_lateral mobi_lat_stretch mobi_quad_stretch
   tr_diamond_pushup_slow cal_standing_hip_circle cal_bear_crawl cond_hiit_sprint cond_vertimax mobi_wrist_series
   mobi_ankle_circles func_hip_hinge pe_batch3_extra_5 ab_batch3_1 cal_push_batch3_1 cal_push_batch3_2
   cal_push_batch3_5 cal_push_batch3_6 cal_push_batch3_7 cond_batch3_1 cond_batch3_4 cal_legs_batch3_0
   cal_legs_batch3_2 cal_legs_batch3_4 cal_legs_batch3_5 sk_straddle_planche sk_full_planche cc_planche_lean_adv
   mo_neck_stretch ca_circuit_bodyweight ca_lateral_shuffles lb_af1 lb_ps1 lb_sq1 lb_gl12 lb_mob1 lb_mob3 lb_al4
   lb_al8 lb_al9 lb_eq1 lb_eq5 lb_eq7 lb_eq8""",
}

# Ajustes de LOCAL para os antigos (além da regra pelo aparelho)
CASA_EXTRA = set("""tr_mergulho_banco lb_br7 ab_leg_raise cal_flex_elevada cal_pike_elev cal_pistol_box pe_batch3_2
  ab_batch3_2 ab_batch3_9 cal_legs_batch3_6 lb_af2 lb_gl11 cal_inverted_row cal_australian_row cal_lsit
  cal_legs_batch3_7""".split())          # banco→cadeira/sofá, mesa, chão, TRX de porta
SEM_CASA = set("""pe_supino_hal pe_supino_hal_inc pe_crucifixo pe_crucifixo_inc pe_low_incline pe_batch3_0
  at_rosca_inclinada at_rosca_banco_incl co_seal_row co_chest_supported_row bi_prone_incline_curl at_spider_curl
  tr_batch3_0 pe_loaded_stretch pe_dumbbell_pullover_ext co_pull_over lb_co5 tr_rolling_ext tr_batch3_5
  cal_muscle_up cal_human_flag cal_flag_negativo sk_flag_tuck pu_explosive_pull cal_pull_com_peso ab_toes_to_bar
  pu_typewriter""".split())               # precisam de banco firme / barra robusta

# ---------------------------------------------------------------------------
# 2) IMPACTO dos antigos (padrão = baixo)
# ---------------------------------------------------------------------------
IMPACTO_ALTO = set("""pe_agach_salto func_box_jump func_burpee cardio_sprint_30 func_broad_jump cal_plyometric_lunge
  cal_step_up_jump cond_hiit_sprint cond_vertimax func_jump_squats_weight pe_batch3_extra_5 cal_legs_batch3_6
  cond_batch3_4 fn_box_lateral_jump cond_jump_rope_du cal_squat_180 fn_sprint_resistance cal_clap_pushup
  cal_push_batch3_0""".split())
IMPACTO_MEDIO = set("""cardio_jumping_jack aquec_pular_corda cardio_corrida_est cond_batch3_7 fn_jump_rope_complex
  func_kettlebell_swing func_kb_snatch func_med_ball_slam func_wall_ball func_batch3_2 func_batch3_11 func_tire_flip
  func_mountain_climb ca_circuit_bodyweight aquec_agil_ladder cond_batch3_3 ca_lateral_shuffles cond_batch3_5
  fn_bear_complex cond_clean_complex fn_kb_complex func_clean func_clean_jerk func_snat comp_push_jerk comp_hang_clean
  func_power_clean_from_hang comp_muscle_snatch func_batch3_7 cal_muscle_up pu_ring_muscle_up pu_explosive_pull
  func_batch3_3 fn_deadmill_sprint cond_sled_sprint func_atlas_stone func_batch3_0 om_batch3_1 func_push_press
  cal_free_hs""".split())

# ---------------------------------------------------------------------------
# 3) OBJETIVOS dos antigos — regras + listas revisadas
# ---------------------------------------------------------------------------
CATS_FORCA = {"pernas", "costas", "peito", "ombros", "biceps", "triceps", "gluteos", "puxar", "empurrar",
              "pernas_cal", "core", "core_cal"}
# exercícios dessas categorias que NÃO servem como estímulo de hipertrofia (mobilidade, ativação, isometria leve, reabilitação)
NAO_HIPER = set("""cal_standing_hip_circle cal_legs_batch3_2 ab_vacuum pe_batch3_extra_6 co_bird_dog ab_dead_bug
  om_batch3_8 om_batch3_9 om_empty_can ab_batch3_8 cal_bear_crawl pe_wall_sit lb_wb1 pe_batch3_extra_4
  cal_legs_batch3_0 co_flutter_kicks co_scissor_kicks ab_batch3_1 lb_gl9 ab_prancha lb_cr1 ab_prancha_lat
  ab_batch3_0 ab_batch3_5 cal_dead_hang cal_scap_pull lb_cr8 cal_hollow cal_hollow_rock lb_cr11 ab_crunch_obliquo
  ab_suitcase_crunch co_rotary_torso om_batch3_5 lb_om8 co_prone_cobra co_superman cal_reverse_plank
  ab_pallof_press ab_cable_woodchop""".split())
HIPER_EXTRA = set("""func_farmers_walk func_rdl_halter func_agach_goblet func_thruster func_push_press
  func_single_leg_rdl func_sumo_dl func_trap_bar_dl func_barbell_row func_paused_deadlift func_kb_press
  func_goblet_squat_pause comp_zercher_squat fn_renegade_row fn_single_leg_dl_kb func_batch3_4 func_batch3_8
  cal_ring_dips cal_ring_row sk_hs_pushup_wall cond_farmers_singles func_batch3_14 func_batch3_13
  func_batch3_12 lb_eq2""".split())

# Composto (multiarticular) => condicionamento/perda de peso mesmo fora das categorias "cal"
RE_COMPOSTO = re.compile(r"agach|afundo|passada|fenda|terra|stiff|rdl|step|hip thrust|eleva[cç][aã]o p[eé]lvica|"
                         r"supino|flex[aã]o|remada|row|puxada|\bpull\b|\bpush\b|desenvolv|press|mergulho|dips|squat|lunge|avan[cç]o|levantamento|"
                         r"leg press|hack|bom dia|good morning|swing|thruster|clean|snatch|jerk|deadlift|carry|walk|"
                         r"burpee|ponte|bridge|kroc|renegade|chin", re.I)
NAO_COND = set("""pe_cadeira_ext pe_mesa_flex pe_pantu pe_pantu_sent pe_adut_maq pe_abd_maq pe_leg_ext_uni
  pe_lying_curl pe_seated_leg_curl pe_calf_donkey pl_quad_extension_drop lb_cf1 lb_pa2 pe_batch3_extra_11
  pe_batch3_extra_10 tr_jm_press tr_board_press pe_batch3_9 pe_bench_with_pause cal_maltese neck_flexion
  co_pull_over lb_co5 pe_svend_press co_face_pull om_face_pull_rope co_batch3_8 co_batch3_3
  pe_dumbbell_pullover_ext om_band_pull_loop tr_batch3_5 pe_batch3_3 ab_side_bend tr_triceps_p""".split())
COND_EXTRA = set("""om_batch3_5 co_superman co_bird_dog co_prone_cobra pe_wall_sit lb_wb1 neck_lateral""".split())
# Funcionais de baixo gasto energético (não entram em perda de peso)
NAO_PERDA = set("""neck_flexion neck_lateral act_glute_activation act_band_walk act_rotator_cuff func_band_pull_apart
  func_batch3_12 func_batch3_13 func_hip_hinge func_batch3_6 fn_cable_chop fn_tgu_light func_turkish_getup
  cal_dead_hang cal_scap_pull at_chin_hang cal_maltese cal_human_flag cal_flag_negativo sk_flag_tuck
  sk_straddle_planche sk_full_planche cal_one_arm cal_one_arm_pull pu_l_sit_pull cal_front_lev sk_front_lever_adv
  cal_tuck_fl cal_back_lever cc_back_lever_tuck pe_batch3_extra_10 pe_wall_sit lb_wb1 pe_batch3_extra_4
  cal_legs_batch3_0 pe_batch3_3 pe_batch3_8 tr_diamond_pushup_slow cal_nordic_hold pe_loaded_stretch
  pu_false_grip fn_grip_hang_towel mobi_jefferson_curl func_batch3_9 pe_batch3_extra_6 ab_batch3_8
  cal_legs_batch3_2 cal_standing_hip_circle cal_legs_batch3_1 cal_legs_batch3_3 lb_gl9 lb_gl10 co_bird_dog
  co_superman co_prone_cobra pe_glute_bridge_single cal_glute_bridge lb_gl2 lb_gl4 lb_gl6 lb_gl8
  ab_side_bend ab_pallof_press""".split())
PERDA_EXTRA = set("""ab_plank_to_pushup ab_batch3_1 ab_batch3_5 om_batch3_5 cal_bear_crawl""".split())

# 50+ — exclusões revisadas (carga axial pesada, inversões, impacto, flexão de coluna repetida com carga,
# posições de impacto/rotação interna de ombro, mergulhos)
EXCLUI_50 = set("""pe_agachu pe_stiff pe_terra_rom co_terra co_remada_c co_bom_dia lb_co8 om_rem_alt
  om_upright_cable om_batch3_2 co_batch3_2 om_behind_neck pe_mergulho pe_dips_bar tr_mergulho_banco lb_br7
  mobi_jefferson_curl neck_flexion cal_pike cal_pike_elev om_pike_pushup_wall ab_russian_twist ab_crunch
  ab_crunch_obliquo lb_cr10 ab_batch3_4 ab_leg_raise lb_cr6 cal_hollow cal_hollow_rock co_flutter_kicks
  co_scissor_kicks ab_side_bend func_thruster func_push_press om_dev_arnold lb_om5 cal_flex_diamante pe_supino_r
  pe_supino_inc pe_supino_dec co_remada_cavalinho co_t_bar_row lb_co9 pe_box_squat pl_back_squat_highbar
  comp_front_squat func_sumo_dl func_trap_bar_dl func_barbell_row mobi_dislocate mobi_shoulder_dislocate
  cal_flex_elevada pe_batch3_2 pe_split_squat_bar pe_hip_thrust lb_hp1 lb_br1 at_rosca_21 at_batch3_5
  co_incline_row tr_close_bench om_dev_front om_batch3_0 ab_wheel co_ab_wheel_knees lb_cr11 ab_batch3_3
  cal_lsit cal_nordic_hold at_chin_eccentric cal_pull_up cal_chin_up cal_pull_neutro pu_mixed_grip
  pu_close_neutral at_chin_up_close ab_hanging_knee cal_commando_pull func_kb_press om_batch3_6 tr_triceps_t
  tr_triceps_frances pe_crucifixo_inc pe_loaded_stretch ab_stability_ball_crunch pe_batch3_extra_3 co_rack_pull
  ab_batch3_7 func_yoke_carry func_tire_carry func_sandbag_carry func_sled_row func_pull_sled func_sled_push
  cond_prowler co_shrug_bar pe_agach_sum cal_inverted_row cal_australian_row ab_plank_to_pushup
  cal_spiderman_push cal_push_batch3_1 cal_push_batch3_5 cal_push_batch3_6 at_drag_curl pe_romanian_dl
  cal_pull_neg pu_band_pull at_band_assisted_chin cal_dead_hang cal_scap_pull mobi_pigeon_pose mobi_frog_stretch
  mobi_couch_stretch mo_bretzel cal_cossack_squat cal_legs_batch3_5 func_batch3_8 ab_batch3_2 ab_cable_crunch
  ab_crunch_polia ab_abdominal_maq co_rotary_torso ab_suitcase_crunch pe_flat_band_press co_batch3_9""".split())
INCLUI_50 = set("""pe_agach_bul func_turkish_getup om_bottoms_up_kb lb_sq1 ab_batch3_9 co_batch3_7 ca_step_aerobics
  fn_tgu_light""".split())   # avançados/ médios que um praticante 50+ treinado pode fazer com segurança

RAQUETE_EXISTENTES = set("""aquec_agil_ladder cond_batch3_3 ca_lateral_shuffles cal_cossack_squat lb_gl12
  cal_legs_batch3_4 fn_box_lateral_jump cardio_sprint_30 cond_hiit_sprint func_broad_jump pe_agach_salto
  cal_plyometric_lunge cal_legs_batch3_6 func_box_jump cal_step_up_jump cond_vertimax aquec_pular_corda
  cond_batch3_7 cond_jump_rope_du fn_jump_rope_complex pe_batch3_extra_5 ab_pallof_press func_batch3_6
  ab_cable_woodchop fn_cable_chop ab_landmine_rotation func_batch3_5 ab_batch3_8 func_med_ball_slam
  func_batch3_2 ab_prancha_lat ab_batch3_9 cal_legs_batch3_1 act_band_walk lb_gl8 lb_gl4 lb_gl9 lb_gl10
  act_glute_activation lb_eq5 act_rotator_cuff lb_om8 om_batch3_8 om_batch3_9 co_face_pull om_face_pull_rope
  co_batch3_8 func_band_pull_apart om_band_pull_loop om_trap_raise om_w_raise om_cuban_press om_batch3_4
  om_empty_can om_bottoms_up_kb om_land_mine_press lb_om7 om_bird_row at_batch3_3 at_reverse_curl
  at_rosca_zottman at_rosca_m func_batch3_12 func_batch3_13 fn_grip_hang_towel cal_dead_hang func_farmers_walk
  cond_farmers_singles func_waiter_carry fn_overhead_carry pe_pantu pl_single_leg_calf pe_batch3_extra_11
  mobi_ankle_mob mobi_wall_ankle mobi_ankle_circles lb_al5 lb_eq1 lb_eq2 lb_eq3 lb_eq4 lb_eq6 func_single_leg_rdl
  fn_single_leg_dl_kb pe_agach_bul lb_af2 lb_af1 cal_fenda pe_fenda_hal lb_ps1 pe_step_up_halteres
  pe_batch3_extra_6 cal_nordic mobi_thoracic mobi_thoracic_rotation_wall mobi_world_greatest mobi_90_90 lb_mob6
  mobi_hip_flexor_stretch mobi_leg_swings mobi_hip_circle mo_shinbox mo_thoracic_opener act_thoracic_ext
  mobi_thoracic_foam mobi_wrist_series func_kettlebell_swing func_sled_push cond_sled_sprint fn_sprint_resistance
  om_batch3_5 pe_batch3_extra_2 lb_gl12 cal_agach_split func_batch3_10""".split())

CATS_COND = {"cardio", "funcional", "core", "core_cal", "mobilidade", "alongamento", "equilibrio", "pernas_cal",
             "empurrar", "puxar", "skills"}


def lista(s):
    return s.split()


def norm(s):
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()


def classificar_existente(e, ap_map):
    i = e["id"]
    cat = e["categoria"]
    niv = e["nivel"]
    ap = ap_map[i]
    # local
    loc = set()
    if ap in APARELHO_CASA or i in CASA_EXTRA:
        loc.add("casa")
    if i in SEM_CASA:
        loc.discard("casa")
    loc.add("academia")
    # impacto
    imp = "alto" if i in IMPACTO_ALTO else "medio" if i in IMPACTO_MEDIO else "baixo"
    # objetivos
    obj = set()
    composto = bool(RE_COMPOSTO.search(e["nome"])) and i not in NAO_COND
    if (cat in CATS_FORCA and i not in NAO_HIPER and imp != "alto" and cat != "core_cal") or i in HIPER_EXTRA:
        obj.add("hipertrofia")
    if cat == "core_cal" and i in {"cal_dragon", "cal_v_sit", "cal_lsit", "cal_planche_pushup"}:
        obj.add("hipertrofia")
    if cat == "skills" and i in {"cal_ring_dips", "cal_ring_row", "sk_hs_pushup_wall"}:
        obj.add("hipertrofia")
    if ((cat in CATS_COND or composto) and i not in NAO_COND) or i in COND_EXTRA:
        obj.add("condicionamento")
    if (cat == "cardio" or cat == "funcional" or composto or i in PERDA_EXTRA or imp in ("medio", "alto")) \
            and i not in NAO_PERDA and cat not in ("mobilidade", "alongamento", "skills") and niv != "elite":
        obj.add("perda_peso")
    ok50 = (niv in ("iniciante", "intermediario") and imp == "baixo" and cat not in ("skills", "core_cal")
            and i not in EXCLUI_50)
    if ok50 or i in INCLUI_50:
        obj.add("50mais")
    if i in RAQUETE_EXISTENTES:
        obj.add("raquete")
    if not obj:
        obj.add("condicionamento")
    return sorted(loc), [o for o in OBJETIVOS if o in obj], imp, ap


# ---------------------------------------------------------------------------
# 4) Parser do formato dos arquivos de exercícios novos / correções
# ---------------------------------------------------------------------------
COD_LOCAL = {"c": ["casa"], "a": ["academia"], "ca": ["academia", "casa"], "ac": ["academia", "casa"]}
COD_OBJ = {"C": "condicionamento", "P": "perda_peso", "H": "hipertrofia", "5": "50mais", "R": "raquete"}
COD_IMP = {"b": "baixo", "m": "medio", "a": "alto"}
COD_NIV = {"ini": "iniciante", "int": "intermediario", "ava": "avancado"}


def split_lista(s, sep):
    return [x.strip() for x in s.split(sep) if x.strip()]


def parse_blocos(texto):
    blocos = []
    atual = []
    for linha in texto.splitlines():
        if linha.strip().startswith("#"):
            continue
        if not linha.strip():
            if atual:
                blocos.append(atual)
                atual = []
            continue
        atual.append(linha.rstrip())
    if atual:
        blocos.append(atual)
    return blocos


def parse_tags(linhas):
    t = {}
    for l in linhas:
        m = re.match(r"^(P|S|I|E|PR|RG|F):\s?(.*)$", l)
        if not m:
            raise ValueError("Linha inválida: %r" % l)
        t[m.group(1)] = m.group(2).strip()
    return t


def parse_novo(bloco, origem_arquivo):
    cab = [x.strip() for x in bloco[0].split("|")]
    if len(cab) != 12:
        raise ValueError("%s: cabeçalho com %d campos: %r" % (origem_arquivo, len(cab), bloco[0]))
    (id_, nome, cat, equip, niv, icon, ap, loc, imp, objs, series, reps) = cab
    t = parse_tags(bloco[1:])
    nivel = COD_NIV[niv]
    ex = OrderedDict()
    ex["id"] = id_
    ex["nome"] = nome
    ex["categoria"] = cat
    ex["equipamento"] = equip
    ex["nivel"] = nivel
    ex["icon"] = icon
    ex["musculos_primarios"] = split_lista(t.get("P", ""), ",")
    ex["musculos_secundarios"] = split_lista(t.get("S", ""), ",")
    ex["instrucoes"] = split_lista(t.get("I", ""), " | ")
    ex["erros_comuns"] = split_lista(t.get("E", ""), " | ")
    ex["proxima_progressao"] = t.get("PR", "")
    if t.get("RG"):
        ex["regressao"] = t["RG"]
    ex["series"] = series
    ex["reps"] = reps
    ex["weekUnlock"] = WEEK[nivel]
    ex["videoUrl"] = ""
    ex["origem"] = "trivox_v2"
    ex["local"] = COD_LOCAL[loc]
    ex["objetivos"] = [o for o in OBJETIVOS if o in {COD_OBJ[c] for c in objs}]
    ex["impacto"] = COD_IMP[imp]
    ex["aparelho"] = ap
    if t.get("F"):
        ex["fedb_id"] = t["F"]
    ex["_arquivo"] = origem_arquivo
    return ex


def parse_correcao(bloco):
    cab = [x.strip() for x in bloco[0].split("|")]
    if len(cab) != 4:
        raise ValueError("correção com cabeçalho inválido: %r" % bloco[0])
    id_, nome, series, reps = cab
    t = parse_tags(bloco[1:])
    return id_, nome, series, reps, t


# ---------------------------------------------------------------------------
# 5) Correções pontuais de texto (nomes com erro de digitação / mistura de idioma)
# ---------------------------------------------------------------------------
RENOMEAR = {
    "om_batch3_0": "Desenvolvimento com Barra Sentado",
    "cal_push_batch3_0": "Flexão Explosiva na Caixa",
    "cal_push_batch3_4": "Flexão Unilateral com Apoio na Bola",
    "cal_push_batch3_2": "Flexão Planche Declinada",
    "fn_deadmill_sprint": "Corrida na Esteira Desligada",
}
TEXTO_FIX = [("Segrar muito nos corrimãos", "Segurar demais nos corrimãos")]


def main():
    dados = json.load(open(ARQ, encoding="utf-8"))
    antigos = [e for e in dados if e.get("origem") != "trivox_v2"]
    if len(antigos) != 563:
        print("AVISO: esperava 563 exercícios antigos, encontrei", len(antigos))
    ids_antigos = [e["id"] for e in antigos]

    # mapa aparelho dos antigos
    ap_map = {}
    for ap, ids in APARELHO_EXISTENTES.items():
        assert ap in APARELHOS, ap
        for i in lista(ids):
            if i in ap_map:
                raise SystemExit("id com 2 aparelhos: %s (%s, %s)" % (i, ap_map[i], ap))
            ap_map[i] = ap
    faltando = [i for i in ids_antigos if i not in ap_map]
    sobrando = [i for i in ap_map if i not in set(ids_antigos)]
    if faltando or sobrando:
        raise SystemExit("aparelho: faltando=%s sobrando=%s" % (faltando, sobrando))
    for conj, nome in [(CASA_EXTRA, "CASA_EXTRA"), (SEM_CASA, "SEM_CASA"), (IMPACTO_ALTO, "IMPACTO_ALTO"),
                       (IMPACTO_MEDIO, "IMPACTO_MEDIO"), (EXCLUI_50, "EXCLUI_50"), (INCLUI_50, "INCLUI_50"),
                       (RAQUETE_EXISTENTES, "RAQUETE"), (NAO_HIPER, "NAO_HIPER"), (COND_EXTRA, "COND_EXTRA"), (PERDA_EXTRA, "PERDA_EXTRA"), (HIPER_EXTRA, "HIPER_EXTRA"),
                       (NAO_PERDA, "NAO_PERDA"), (NAO_COND, "NAO_COND")]:
        x = conj - set(ids_antigos)
        if x:
            raise SystemExit("ids inexistentes em %s: %s" % (nome, sorted(x)))

    # correções das fichas genéricas ("Execute X com técnica correta")
    correcoes = {}
    if os.path.exists(ARQ_CORRECOES):
        for b in parse_blocos(open(ARQ_CORRECOES, encoding="utf-8").read()):
            id_, nome, series, reps, t = parse_correcao(b)
            correcoes[id_] = (nome, series, reps, t)
    por_id = {e["id"]: e for e in antigos}
    for id_, (nome, series, reps, t) in correcoes.items():
        e = por_id[id_]
        if nome and nome != "=":
            e["nome"] = nome
        if series and series != "=":
            e["series"] = series
        if reps and reps != "=":
            e["reps"] = reps
        if "P" in t:
            e["musculos_primarios"] = split_lista(t["P"], ",")
        if "S" in t:
            e["musculos_secundarios"] = split_lista(t["S"], ",")
        if "I" in t:
            e["instrucoes"] = split_lista(t["I"], " | ")
        if "E" in t:
            e["erros_comuns"] = split_lista(t["E"], " | ")
        if "PR" in t:
            e["proxima_progressao"] = t["PR"]
        if "RG" in t:
            e["regressao"] = t["RG"]

    for e in antigos:
        if e["nivel"] == "intermediante":
            e["nivel"] = "intermediario"
        if e["id"] in RENOMEAR:
            e["nome"] = RENOMEAR[e["id"]]
        for a, b in TEXTO_FIX:
            e["erros_comuns"] = [x.replace(a, b) for x in e["erros_comuns"]]
        # progressão apontando para o próprio exercício não ajuda o usuário
        if e["proxima_progressao"].strip().lower() == e["nome"].strip().lower():
            e["proxima_progressao"] = "Aumente carga, repetições ou tempo sob tensão"
        loc, obj, imp, ap = classificar_existente(e, ap_map)
        e["local"] = loc
        e["objetivos"] = obj
        e["impacto"] = imp
        e["aparelho"] = ap

    # exercícios novos
    novos = []
    for nome_arq in sorted(os.listdir(DIR_NOVOS)):
        if not nome_arq.endswith(".txt") or nome_arq.startswith("_"):
            continue
        txt = open(os.path.join(DIR_NOVOS, nome_arq), encoding="utf-8").read()
        for b in parse_blocos(txt):
            novos.append(parse_novo(b, nome_arq))

    fedb_ids = set()
    if os.path.exists(FEDB):
        fedb_ids = {x["id"] for x in json.load(open(FEDB, encoding="utf-8"))}

    final = antigos + novos
    erros = validar(final, ids_antigos, fedb_ids)
    if erros:
        for x in erros:
            print("ERRO:", x)
        raise SystemExit("%d erros de validação — arquivo NÃO gravado" % len(erros))

    por_arquivo = Counter(e.pop("_arquivo") for e in novos)
    if "--dry" in sys.argv:
        json.dump(final, open(os.environ.get("TRIVOX_DRY_OUT", os.devnull), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("(--dry: nada gravado em data/exercicios.json)")
    else:
        with open(ARQ, "w", encoding="utf-8") as f:
            json.dump(final, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print("Resultado %s: %d exercícios (%d antigos + %d novos)" % (ARQ, len(final), len(antigos), len(novos)))
    print("Novos por arquivo:", dict(por_arquivo))
    print("Fichas genéricas reescritas:", len(correcoes))
    imprimir_tabelas(final, antigos, novos)


def validar(final, ids_antigos, fedb_ids):
    erros = []
    ids = Counter(e["id"] for e in final)
    erros += ["id duplicado: %s" % i for i, n in ids.items() if n > 1]
    nomes = Counter(norm(e["nome"]).strip() for e in final)
    erros += ["nome duplicado: %s" % n for n, k in nomes.items() if k > 1]
    presentes = set(ids)
    erros += ["id antigo perdido: %s" % i for i in ids_antigos if i not in presentes]
    for e in final:
        i = e["id"]
        if e["nivel"] not in NIVEIS:
            erros.append("%s nível inválido %s" % (i, e["nivel"]))
        if not e.get("local") or any(l not in LOCAIS for l in e["local"]):
            erros.append("%s local inválido %s" % (i, e.get("local")))
        if not e.get("objetivos") or any(o not in OBJETIVOS for o in e["objetivos"]):
            erros.append("%s objetivos inválidos %s" % (i, e.get("objetivos")))
        if e.get("impacto") not in IMPACTOS:
            erros.append("%s impacto inválido" % i)
        if e.get("aparelho") not in APARELHOS:
            erros.append("%s aparelho inválido %s" % (i, e.get("aparelho")))
        if not e["instrucoes"] or not e["musculos_primarios"]:
            erros.append("%s sem instruções/músculos" % i)
        for campo in ("id", "nome", "categoria", "equipamento", "icon", "series", "reps", "proxima_progressao",
                      "videoUrl", "origem", "weekUnlock", "erros_comuns", "musculos_secundarios"):
            if campo not in e:
                erros.append("%s sem campo %s" % (i, campo))
        if e.get("origem") == "trivox_v2":
            if not (4 <= len(e["instrucoes"]) <= 6):
                erros.append("%s: %d instruções" % (i, len(e["instrucoes"])))
            if not (2 <= len(e["erros_comuns"]) <= 4):
                erros.append("%s: %d erros comuns" % (i, len(e["erros_comuns"])))
            if not e["musculos_secundarios"]:
                erros.append("%s sem músculos secundários" % i)
            if e.get("fedb_id") and fedb_ids and e["fedb_id"] not in fedb_ids:
                erros.append("%s fedb_id inexistente %s" % (i, e["fedb_id"]))
            if "50mais" in e["objetivos"] and e["impacto"] == "alto":
                erros.append("%s marcado 50mais com impacto alto" % i)
    return erros


def nivel3(n):
    return "avancado" if n == "elite" else n


def imprimir_tabelas(final, antigos, novos):
    out = []
    p = out.append
    p("## Totais\n")
    p("- Total: **%d** exercícios (%d antigos preservados + %d novos `trivox_v2`)\n" % (len(final), len(antigos), len(novos)))
    p("\n## Local × nível (elite contado à parte)\n")
    p("| local | iniciante | intermediario | avancado | elite | total |")
    p("|---|---|---|---|---|---|")
    for l in LOCAIS:
        c = Counter(e["nivel"] for e in final if l in e["local"])
        p("| %s | %d | %d | %d | %d | %d |" % (l, c["iniciante"], c["intermediario"], c["avancado"], c["elite"], sum(c.values())))
    p("\n## Objetivo × nível\n")
    p("| objetivo | iniciante | intermediario | avancado | elite | total |")
    p("|---|---|---|---|---|---|")
    for o in OBJETIVOS:
        c = Counter(e["nivel"] for e in final if o in e["objetivos"])
        p("| %s | %d | %d | %d | %d | %d |" % (o, c["iniciante"], c["intermediario"], c["avancado"], c["elite"], sum(c.values())))
    p("\n## Células local × nível × objetivo (avançado inclui elite; meta ≥ 15)\n")
    p("| local | objetivo | iniciante | intermediario | avancado |")
    p("|---|---|---|---|---|")
    baixas = []
    for l in LOCAIS:
        for o in OBJETIVOS:
            c = Counter(nivel3(e["nivel"]) for e in final if l in e["local"] and o in e["objetivos"])
            p("| %s | %s | %d | %d | %d |" % (l, o, c["iniciante"], c["intermediario"], c["avancado"]))
            for n in ("iniciante", "intermediario", "avancado"):
                if c[n] < 15:
                    baixas.append((l, o, n, c[n]))
    p("\n## Impacto\n")
    c = Counter(e["impacto"] for e in final)
    p("| impacto | qtd |\n|---|---|")
    for k in IMPACTOS:
        p("| %s | %d |" % (k, c[k]))
    p("\n## Aparelho\n")
    p("| aparelho | qtd | | aparelho | qtd |")
    p("|---|---|---|---|---|")
    ca = sorted(Counter(e["aparelho"] for e in final).items(), key=lambda x: (-x[1], x[0]))
    meio = (len(ca) + 1) // 2
    for k in range(meio):
        a = ca[k]
        b = ca[k + meio] if k + meio < len(ca) else ("", "")
        p("| %s | %s | | %s | %s |" % (a[0], a[1], b[0], b[1]))
    nao_usados = sorted(APARELHOS - {k for k, _ in ca})
    p("\nChaves da lista que não aparecem em nenhum exercício: %s" % (", ".join(nao_usados) or "—"))
    p("\n## Novos por categoria\n")
    c = Counter(e["categoria"] for e in novos)
    p(", ".join("%s: %d" % kv for kv in sorted(c.items(), key=lambda x: -x[1])))
    p("\n## Novos com fedb_id: %d\n" % sum(1 for e in novos if e.get("fedb_id")))
    if baixas:
        p("\n## Células abaixo de 15\n")
        for b in baixas:
            p("- %s × %s × %s: %d" % b)
    else:
        p("\nTodas as 30 células local × nível × objetivo têm ≥ 15 exercícios.")
    texto = "\n".join(out) + "\n"
    print(texto)
    # atualiza a seção de tabelas do relatório (entre os marcadores), se o relatório existir
    if "--dry" not in sys.argv and os.path.exists(RELATORIO):
        rel = open(RELATORIO, encoding="utf-8").read()
        if MARCA_INI in rel and MARCA_FIM in rel:
            a, resto = rel.split(MARCA_INI, 1)
            _, b = resto.split(MARCA_FIM, 1)
            with open(RELATORIO, "w", encoding="utf-8") as f:
                f.write(a + MARCA_INI + "\n" + texto + MARCA_FIM + b)


if __name__ == "__main__":
    main()
