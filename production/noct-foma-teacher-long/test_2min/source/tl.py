"""Builds scene/timeline_vo.json (lines + named beats) and scene/subs.json from real VO durations."""
import json, os, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
TXT = {}
for fn in ('lines.txt', 'lines2.txt'):
    for l in open(os.path.join(HERE, fn)):
        if l.startswith('#') or not l.strip(): continue
        k, spk, sty, text = l.strip().split('|'); TXT[k] = dict(spk=spk, sty=sty, text=text.replace("'", ''))

def dur(k):
    p = os.path.join(HERE, 'proc', k + '.wav')
    if os.path.exists(p): return sf.info(p).duration
    return max(0.6, len(TXT[k]['text']) / 13.5)

# ('L', id, gap_after) | ('B', name, seconds)
SEQ = [
    ('B', 'hook', 0.2), ('L', 'H1', .12), ('L', 'H2', .15), ('L', 'H3', .12), ('B', 'montage', 1.6), ('L', 'H4', .08), ('L', 'H5', .2), ('B', 'rewind', 0.9),
    ('B', 'room', 0.0), ('B', 'alarm', 0.55), ('L', 'M1', .15), ('L', 'S1', .12), ('L', 'S2', .15), ('L', 'S3', .2), ('L', 'M1b', .15), ('L', 'M2', .12), ('L', 'M3', .05),
    ('B', 'logic', 0.6), ('L', 'M4', .15), ('B', 'tie', 0.9), ('L', 'S4', .1), ('B', 'whoosh', 0.45),
    ('B', 'hall', 0.0), ('L', 'O1', .12), ('B', 'badge', 1.0), ('L', 'F5', .1), ('L', 'O2', .12), ('L', 'F6', 0.0), ('L', 'F7', .1), ('B', 'risk1', 0.6),
    ('L', 'O3', .15), ('L', 'F8', .12), ('L', 'O4', .05), ('B', 'freeze1', 0.8), ('L', 'O5', .08), ('L', 'F15', 0.0), ('L', 'O6', .15), ('B', 'bell', 0.7),
    ('B', 'class', 0.0), ('B', 'door', 0.9), ('L', 'T1', .08), ('L', 'F9', .1), ('B', 'risk2', 0.45), ('L', 'T2', .2),
    ('L', 'F16', .08), ('L', 'T5', .08), ('L', 'F17', .08), ('L', 'L4', .08), ('L', 'F18', .08), ('L', 'K3', .15), ('L', 'F19', 0.0), ('B', 'namefreeze', 0.9),
    ('L', 'T6', .05), ('B', 'laugh', 0.8), ('L', 'F20', .25),
    ('L', 'F10', .1), ('L', 'T3', .03), ('L', 'K1', .03), ('L', 'T4', .1), ('L', 'L1', .05), ('B', 'p56', 0.6), ('L', 'F11', .15),
    ('L', 'L2', .15), ('L', 'F12', .12), ('L', 'L3', .05), ('B', 'deal', 0.7), ('L', 'F13', .15),
    ('B', 'teach', 2.2), ('L', 'K2', .08), ('L', 'F21', .25), ('L', 'D1', .15),
    ('B', 'plane', 2.4), ('B', 'hit', 0.45), ('B', 'score', 1.0), ('L', 'D2', .3), ('L', 'F14', .3), ('L', 'D3', .05), ('B', 'risk5', 0.6), ('L', 'F22', .15), ('B', 'outro', 2.2),
]
SUBTXT = {  # on-screen subtitle text (*word* = highlight); default = line text
    'H1': 'Меня зовут Фома. Мне *тринадцать*.', 'H2': 'И сегодня я — *учитель*.', 'H3': 'Если директор узнает —\nменя *исключат*.',
    'H4': 'Шесть уроков. Один день.\nА в пять — *кабинет директора*.', 'H5': '*ФОМА ИВАНОВИЧ!*', 'M1': '(за дверью) Фома! В школу!', 'M1b': '*Фома! В школу! Сейчас же!*',
    'S2': 'Градусник показывает *36,6*!', 'M3': 'Тем более!\n*Учителей не прогуливают!*', 'M4': '…*Логично.*', 'S4': 'Она что, *в курсе?!*',
    'F6': 'Шесть?! Да я сам в *седьмом кла…*', 'F7': '…в седьмом классе *преподаю*. Иногда.', 'O4': 'Ну, он оказался… *учеником!*', 'O6': '*Не нажимайте!*',
    'T1': 'О! Да это ж *Фома из седьмого «Б»!*', 'F9': 'Фома. *Иванович.*', 'T6': 'А Фомы нет!\nОн, говорят, *учителем стал!*', 'F20': '*Отсутствует!* Следующий!',
    'L1': '*Пятьдесят шесть.*', 'L2': 'Я знаю, что вы *не учитель*.', 'L3': '*Пятёрка за четверть.*\nИ я молчу.', 'F13': '…Договорились.\nЛиза — к доске!',
    'F21': 'Конфискация. *Учительская.*', 'D2': 'Фома *Иванович*.', 'F14': 'Это… элемент урока.\n*Аэродинамика.*', 'D3': 'Контрольная. Через пять минут.\n*Проверю лично.*',
    'F22': 'Пять минут. Контрольная.\nКоторую я *сам не напишу*.', 'F19': 'Фома…',
}
t = 0.0; out = []; subs = []
for it in SEQ:
    if it[0] == 'B':
        out.append(dict(id='b_' + it[1], t0=round(t, 3), t1=round(t + it[2], 3))); t += it[2]
    else:
        k, g = it[1], it[2]; d = dur(k)
        out.append(dict(id=k, t0=round(t, 3), t1=round(t + d - 0.04, 3), spk=TXT[k]['spk']))
        s = SUBTXT.get(k, TXT[k]['text'])
        if len(s) > 34 and '\n' not in s: # wrap long lines
            w = s.split(' '); h = len(w) // 2; s = ' '.join(w[:h]) + '\n' + ' '.join(w[h:])
        subs.append(dict(t0=round(t, 3), t1=round(t + d + min(g, 0.25), 3), text=s))
        t += d + g
out.append(dict(id='END', t0=round(t, 3), t1=round(t, 3)))
os.makedirs(os.path.join(HERE, 'scene'), exist_ok=True)
json.dump(out, open(os.path.join(HERE, 'scene', 'timeline_vo.json'), 'w'), ensure_ascii=False, indent=0)
json.dump(subs, open(os.path.join(HERE, 'scene', 'subs.json'), 'w'), ensure_ascii=False, indent=0)
print('total', round(t, 2), 's =', f'{int(t // 60)}:{t % 60:05.2f}', '| lines', len(subs))
