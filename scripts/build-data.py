#!/usr/bin/env python3
"""
Builds data/*.json from the ACTIVITIES PLANNER .docx.

Usage:  python3 scripts/build-data.py "path/to/ACTIVITIES_PLANNER.docx"

Re-run this whenever the planner changes. The site reads the JSON files only.
"""
import json, re, sys, os
import docx

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(OUT, exist_ok=True)
d = docx.Document(SRC)
T = d.tables


def rows(i):
    out = []
    for r in T[i].rows[1:]:
        out.append([re.sub(r'\s+', ' ', c.text).strip() for c in r.cells])
    return out


def slugify(s):
    s = s.lower().replace('&', 'and')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s


# ---- name normalisation (the planner spells the same activity several ways)
NAME_MAP = {
    'pool table': 'Pool',
    'crazy pool table': 'Crazy Pool',
    'archery - mini crossbow': 'Mini Crossbow Archery',
    'adventure golf - 9 holes': 'Adventure Golf',
    'festive cozy nights': 'Festive Cosy Nights',
    'football fun family challenge': 'Football Fun Challenge',
    'football fun challenge': 'Football Fun Challenge',
    'xmas events academy / crafts': 'Xmas Events Academy',
    'farm visits (experiential)': 'Farm Visits',
    'silent trust walks (?)': 'Silent Trust Walks',
    'festive pony painting (?)': 'Festive Pony Painting',
}


def canon(name):
    n = re.sub(r'\s+', ' ', name).strip()
    k = n.lower()
    if k in NAME_MAP:
        return NAME_MAP[k]
    return re.sub(r'\s*\(\?\)\s*$', '', n)


# ---- type tables (index -> category label)
TYPE_TABLES = {
    3: 'Indoor', 4: 'Outdoor', 5: 'Creative', 6: 'Sports & Fitness',
    7: 'Family', 8: 'Children', 9: 'Seasonal', 10: 'Relaxing',
}

acts = {}   # slug -> dict
order = []


def get(name):
    nm = canon(name)
    s = slugify(nm)
    if s not in acts:
        acts[s] = {
            'slug': s, 'name': nm, 'categories': [], 'setting': None,
            'description': '', 'suitableFor': '', 'duration': '', 'needs': '',
            'corporate': False,
        }
        order.append(s)
    return acts[s]


def add_cat(a, c):
    if c not in a['categories']:
        a['categories'].append(c)


# 1) master register: categories, setting, suitable, duration
CAT_ALIASES = {'corporate-suitable': 'Corporate', 'sports & fitness': 'Sports & Fitness'}
for r in rows(2):
    _id, name, cats, setting, suit, dur = r
    a = get(name)
    for c in [x.strip() for x in cats.split(',')]:
        if c.lower() == 'corporate-suitable':
            a['corporate'] = True
        else:
            add_cat(a, c)
    a['setting'] = setting
    a['suitableFor'] = suit
    a['duration'] = dur

# 2) type tables: description, needs, and category membership
for idx, cat in TYPE_TABLES.items():
    for r in rows(idx):
        name, desc, suit, dur, needs = r
        a = get(name)
        add_cat(a, cat)
        a['description'] = a['description'] or desc
        a['needs'] = a['needs'] or needs
        a['suitableFor'] = a['suitableFor'] or suit
        a['duration'] = a['duration'] or dur

# 3) corporate team-building list adds Family Challenge + Chef Academy as corporate
tb = rows(12)
team_value = {}
for r in tb:
    name, involves, dur, value = r
    a = get(name)
    a['corporate'] = True
    a['teamValue'] = value
    a['description'] = a['description'] or involves
    a['duration'] = a['duration'] or dur
    team_value[a['slug']] = value

# settings for activities missing from the register
for s, a in acts.items():
    if not a['setting']:
        a['setting'] = 'Outdoor' if 'Outdoor' in a['categories'] else ('Indoor' if 'Indoor' in a['categories'] else 'Outdoor')
# Chef Academy is a kitchen activity
if 'chef-academy' in acts:
    acts['chef-academy']['setting'] = 'Indoor'

# NEW / UPCOMING flags from the Browse table
for s in ['crazy-pool', 'bird-watching', 'forest-discovery-trail', 'community-tourism', 'freestyle-yoga']:
    acts[s]['isNew'] = True
UPCOMING = ['christmas-hunt', 'xmas-events-academy', 'festive-pony-painting', 'festive-cosy-nights']
for s in UPCOMING:
    acts[s]['isUpcoming'] = True


# ---- helper: parse durations into minutes range + bucket
def parse_duration(txt):
    t = txt.lower()
    lo = hi = None
    m = re.search(r'(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(hrs?|min)', t)
    if m:
        f = 60 if m.group(3).startswith('hr') else 1
        lo, hi = float(m.group(1)) * f, float(m.group(2)) * f
    else:
        m = re.search(r'(\d+(?:\.\d+)?)\s*(hrs?|min)', t)
        if m:
            f = 60 if m.group(2).startswith('hr') else 1
            lo = hi = float(m.group(1)) * f
    if 'evening' in t or 'overnight' in t:
        return 'evening'
    if 'half' in t or 'full day' in t or 'full' in t:
        return 'day'
    if hi is None:
        return 'short'
    if hi <= 60:
        return 'short'      # up to 1 hr
    if hi <= 120:
        return 'medium'     # 1 to 2 hrs
    return 'long'           # 2 hrs +


def age_tags(suit, cats):
    t = suit.lower()
    tags = set()
    if 'all ages' in t:
        tags.update(['kids', 'teens', 'adults'])
    if re.search(r'children|kids|young', t):
        tags.add('kids')
    if 'teen' in t:
        tags.add('teens')
    if 'adult' in t:
        tags.add('adults')
    if 'famil' in t:
        tags.update(['kids', 'teens', 'adults'])
    if re.search(r'age\s*(\d+)\+', t):
        n = int(re.search(r'age\s*(\d+)\+', t).group(1))
        tags.update(['teens', 'adults'])
        if n <= 10:
            tags.add('kids')
    if re.search(r'ages\s*(\d+)\+', t):
        n = int(re.search(r'ages\s*(\d+)\+', t).group(1))
        tags.update(['teens', 'adults'])
        if n <= 10:
            tags.add('kids')
    if 'schools' in t or 'groups' in t or 'teams' in t or 'corporate' in t:
        tags.update(['teens', 'adults'])
    if not tags:
        tags.update(['teens', 'adults'])
    return sorted(tags)


# ---- icons per activity (names used by views/partials/icon.ejs)
ICON = {
    'pool': 'waves', 'crazy-pool': 'waves', 'mini-crossbow-archery': 'target', 'badminton': 'racket',
    'table-tennis': 'racket', 'jim-jam-pyjama-party': 'moon', 'nickelodeon-pyjama-party': 'moon',
    'build-nature-house': 'home', 'interactive-forest-challenge': 'compass', 'laser-combat': 'zap',
    'adventure-golf': 'flag', 'aerial-tree-trekking': 'tree', 'field-archery': 'target',
    'tree-discovery-experience': 'tree', 'den-building-and-decorating': 'home', 'easter-egg-hunt': 'egg',
    'christmas-hunt': 'gift', 'fire-building-and-campfire': 'flame', 'silent-trust-walks': 'footprints',
    'compass-and-night-hikes': 'compass', 'festive-pony-painting': 'brush', 'festive-cosy-nights': 'flame',
    'football-fun-challenge': 'ball', 'foot-golf-challenge': 'ball', 'insect-safari': 'bug',
    'nature-walks': 'footprints', 'cycling-and-off-road-explorer': 'bike', 'quad-bike-safari': 'bike',
    'forest-walks-and-trekking': 'footprints', 'bird-watching': 'bird', 'forest-discovery-trail': 'compass',
    'community-tourism': 'users', 'farm-visits': 'leaf', 'freestyle-yoga': 'sun', 'sound-bathing': 'waves',
    'xmas-events-academy': 'gift', 'face-painting': 'brush', 'family-handprint': 'hand',
    'family-nature-journal': 'book', 'chef-academy': 'chef', 'family-challenge': 'users',
}

# ---- safety / bring notes drawn only from what the planner states
SAFETY_BY_SLUG = {
    'aerial-tree-trekking': 'Height limits apply. You are in a harness at all times with a trained guide at every stage.',
    'quad-bike-safari': 'Helmets are worn and a safety briefing comes first. Riders sign a waiver. Minors ride only with a guide, per operator rules.',
    'laser-combat': 'A marshal gives a safety briefing before every game.',
    'mini-crossbow-archery': 'An instructor stands beside you throughout. Safety nets are in place.',
    'field-archery': 'Shooting takes place on a safe range, supervised by an instructor.',
    'pool': 'The pool is lifeguarded. Children must be supervised by an adult.',
    'crazy-pool': 'The pool is lifeguarded and all games are supervised.',
    'fire-building-and-campfire': 'A fire pit and an extinguisher are on hand. Children join with an adult.',
    'compass-and-night-hikes': 'A guide leads the night trail and first aid is carried.',
    'cycling-and-off-road-explorer': 'Helmets are provided and a guide leads the route.',
    'farm-visits': 'Hand-wash points are available and protective wear is provided.',
    'silent-trust-walks': 'A guide leads the session. Blindfolds are optional.',
    'forest-walks-and-trekking': 'A guide leads the walk, water breaks are built in and first aid is carried.',
    'jim-jam-pyjama-party': 'Supervisors stay with the children all evening.',
    'nickelodeon-pyjama-party': 'Supervisors stay with the children all evening. Decor is themed only.',
}
BRING_BY_SETTING = {
    'Outdoor': 'Comfortable closed shoes, a hat, sunscreen and a bottle of water. Bring a light rain jacket in the wet season.',
    'Indoor': 'Comfortable clothes and flat shoes. Everything else is provided.',
}
BRING_BY_SLUG = {
    'pool': 'Swimwear and a change of clothes. Towels are provided.',
    'crazy-pool': 'Swimwear and a change of clothes.',
    'jim-jam-pyjama-party': 'Your child\'s pyjamas. Bedding is provided.',
    'nickelodeon-pyjama-party': 'Your child\'s pyjamas, and a costume if you like. Bedding is provided.',
    'freestyle-yoga': 'Loose, comfortable clothes. Mats are provided.',
    'sound-bathing': 'Loose, comfortable clothes. Mats are provided.',
    'compass-and-night-hikes': 'Sturdy closed shoes, a light jacket and a water bottle. Torches are provided.',
    'fire-building-and-campfire': 'A warm layer for the evening and closed shoes.',
    'bird-watching': 'Neutral-coloured clothes and closed shoes. Binoculars are provided.',
    'farm-visits': 'Old clothes and closed shoes you do not mind getting dirty.',
    'festive-pony-painting': 'Clothes that can get messy. Aprons are provided.',
    'family-handprint': 'Clothes that can get messy.',
    'face-painting': 'Nothing special. The artist brings everything.',
    'quad-bike-safari': 'Long trousers, closed shoes and sunglasses. Helmets are provided.',
}

# ---- sub-groups for each type landing page (from the website outline)
GROUPS = {
    'outdoor': [
        ('Adventure & Thrills', ['laser-combat', 'aerial-tree-trekking', 'quad-bike-safari', 'cycling-and-off-road-explorer', 'interactive-forest-challenge', 'field-archery']),
        ('Nature & Wildlife', ['bird-watching', 'insect-safari', 'nature-walks', 'forest-walks-and-trekking', 'tree-discovery-experience', 'forest-discovery-trail']),
        ('Games & Golf', ['adventure-golf', 'foot-golf-challenge', 'football-fun-challenge', 'family-challenge']),
    ],
    'indoor': [
        ('Games', ['pool', 'crazy-pool', 'table-tennis', 'badminton']),
        ('Archery', ['mini-crossbow-archery']),
        ('Parties', ['jim-jam-pyjama-party', 'nickelodeon-pyjama-party']),
    ],
    'creative': [
        ('Nature Crafts', ['build-nature-house', 'den-building-and-decorating', 'family-nature-journal']),
        ('Art', ['face-painting', 'festive-pony-painting', 'family-handprint']),
        ('Chef Academy', ['chef-academy']),
    ],
    'sports-and-fitness': [
        ('Team Sports', ['football-fun-challenge', 'foot-golf-challenge', 'adventure-golf', 'laser-combat', 'badminton', 'table-tennis']),
        ('Archery', ['mini-crossbow-archery', 'field-archery']),
        ('Trekking & Cycling', ['forest-walks-and-trekking', 'compass-and-night-hikes', 'cycling-and-off-road-explorer', 'quad-bike-safari', 'aerial-tree-trekking']),
        ('Yoga', ['freestyle-yoga']),
    ],
    'relaxing': [
        ('Walks & Trails', ['nature-walks', 'forest-walks-and-trekking', 'forest-discovery-trail', 'tree-discovery-experience', 'silent-trust-walks', 'bird-watching']),
        ('Yoga', ['freestyle-yoga']),
        ('Sound Bathing', ['sound-bathing']),
        ('Campfire', ['fire-building-and-campfire', 'festive-cosy-nights']),
    ],
}

final = []
for s in order:
    a = acts[s]
    a['durationBucket'] = parse_duration(a['duration'])
    a['ages'] = age_tags(a['suitableFor'], a['categories'])
    a['icon'] = ICON.get(s, 'leaf')
    a['safety'] = SAFETY_BY_SLUG.get(s, 'A trained guide briefs every group before the activity begins.')
    a['bring'] = BRING_BY_SLUG.get(s) or BRING_BY_SETTING.get(a['setting'], BRING_BY_SETTING['Outdoor'])
    a['provided'] = a['needs']
    final.append(a)

# related activities: share the most categories, prefer same setting
for a in final:
    scored = []
    for b in final:
        if b['slug'] == a['slug']:
            continue
        sc = len(set(a['categories']) & set(b['categories'])) * 2 + (1 if a['setting'] == b['setting'] else 0) + (1 if a['corporate'] and b['corporate'] else 0)
        scored.append((-sc, b['name'], b['slug']))
    scored.sort()
    a['related'] = [x[2] for x in scored[:4]]

with open(os.path.join(OUT, 'activities.json'), 'w') as f:
    json.dump({'activities': final,
               'groups': {k: [{'name': n, 'items': [i for i in items if i in acts]} for n, items in v] for k, v in GROUPS.items()}},
              f, indent=2, ensure_ascii=False)

# ---------------- corporate ----------------
corp = {
    'meetings': [dict(zip(['name', 'involves', 'requirements'], r)) for r in rows(11)],
    'teamBuilding': [dict(zip(['name', 'involves', 'duration', 'value'], r)) for r in rows(12)],
    'social': [dict(zip(['name', 'involves', 'requirements'], r)) for r in rows(13)],
    'nature': [dict(zip(['name', 'duration', 'use'], r)) for r in rows(14)],
    'checklist': [],
}
for p in d.paragraphs:
    pass
# checklist = list paragraphs between 'Corporate Planning Checklist' and 'Browse Things To Do Page'
started = False
for p in d.paragraphs:
    t = p.text.strip()
    if t == 'Corporate Planning Checklist':
        started = True
        continue
    if started and t.startswith('Browse Things To Do'):
        break
    if started and t:
        corp['checklist'].append(t)
for item in corp['teamBuilding']:
    item['name'] = canon(item['name'])
    item['slug'] = slugify(item['name'])
with open(os.path.join(OUT, 'corporate.json'), 'w') as f:
    json.dump(corp, f, indent=2, ensure_ascii=False)

# ---------------- breaks ----------------
SIG_ALIAS = {
    'family challenge': 'family-challenge', 'insect safari': 'insect-safari', 'pool': 'pool',
    'face painting': 'face-painting', 'nature walk': 'nature-walks', 'fire building & campfire': 'fire-building-and-campfire',
    'silent trust walk': 'silent-trust-walks', 'festive cosy nights': 'festive-cosy-nights', 'farm visit': 'farm-visits',
    'chef academy': 'chef-academy', 'community tourism': 'community-tourism', 'laser combat': 'laser-combat',
    'aerial trekking': 'aerial-tree-trekking', 'quad-bike safari': 'quad-bike-safari', 'foot golf': 'foot-golf-challenge',
    'freestyle yoga': 'freestyle-yoga', 'sound bathing': 'sound-bathing', 'bird watching': 'bird-watching',
    'forest trail': 'forest-discovery-trail', 'crazy pool': 'crazy-pool', 'easter or christmas hunt': 'easter-egg-hunt',
    'christmas hunt': 'christmas-hunt', 'xmas crafts': 'xmas-events-academy', 'family challenge': 'family-challenge',
    'handprint': 'family-handprint', 'nature journal': 'family-nature-journal', 'den building': 'den-building-and-decorating',
    'easter egg hunt': 'easter-egg-hunt', 'nature walks': 'nature-walks', 'insect safari': 'insect-safari',
    'kids parties': None, 'baby inflatables': None, 'campfire': 'fire-building-and-campfire',
    'festive nights': 'festive-cosy-nights', 'yoga': 'freestyle-yoga', 'sunset waterfront': None,
}


def split_inclusions(txt):
    parts = [p.strip() for p in re.split(r',\s*', txt) if p.strip()]
    out = []
    for p in parts:
        k = p.lower().rstrip('.')
        k2 = k.replace(' crafts', ' crafts')
        slug = SIG_ALIAS.get(k) if k in SIG_ALIAS else None
        if k in SIG_ALIAS and SIG_ALIAS[k] is None:
            slug = None
        elif slug is None:
            cand = slugify(canon(p))
            slug = cand if cand in acts else None
        out.append({'label': p[0].upper() + p[1:], 'slug': slug})
    return out


def brk(r, kind):
    name, timing, guests, incl = r
    return {'name': name, 'slug': slugify(name), 'timing': timing, 'guests': guests,
            'inclusions': split_inclusions(incl), 'kind': kind}


breaks = {
    'seasonal': [brk(r, 'seasonal') for r in rows(19)],
    'other': [brk(r, 'family') for r in rows(20)],
    'durations': [dict(zip(['name', 'length', 'use'], r)) for r in rows(21)],
    'signature': [],
}
for r in rows(22):
    name, feel, incl = r
    breaks['signature'].append({'name': name, 'slug': slugify(name), 'feel': feel,
                                'inclusions': split_inclusions(incl), 'kind': 'signature'})
with open(os.path.join(OUT, 'breaks.json'), 'w') as f:
    json.dump(breaks, f, indent=2, ensure_ascii=False)

# ---------------- report ----------------
from collections import Counter
cnt = Counter()
for a in final:
    for c in a['categories']:
        cnt[c] += 1
    if a['corporate']:
        cnt['Corporate'] += 1
print('activities:', len(final))
for k, v in sorted(cnt.items()):
    print(' ', k, v)
print('overview table (planner says):')
for r in rows(0):
    print(' ', r[0], r[1])
unmatched = [(b['name'], i['label']) for grp in ('seasonal', 'other', 'signature') for b in breaks[grp] for i in b['inclusions'] if not i['slug']]
print('inclusions without an activity page:', unmatched)
