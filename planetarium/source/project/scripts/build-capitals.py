"""Rebuild the bundled capital-city snapshot. Python stdlib + Node.js only.

GeoNames coordinates: CC BY 4.0. Natural Earth Korean names: public domain.
Downloads are used at build time only; the application has no external dependency.
"""
from pathlib import Path
import argparse
from datetime import date
import hashlib
import json
import math
import re
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'research'
NE_REV = 'ca96624a56bd078437bca8184e78163e5039ad19'
SOURCES = {
    'cities15000.zip': 'https://download.geonames.org/export/dump/cities15000.zip',
    'countryInfo.txt': 'https://download.geonames.org/export/dump/countryInfo.txt',
    'natural-earth-populated-places.geojson': f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_REV}/geojson/ne_10m_populated_places.geojson',
}
parser = argparse.ArgumentParser()
parser.add_argument('--refresh', action='store_true', help='Download current GeoNames files again')
parser.add_argument('--snapshot-date', default=date.today().isoformat(), help='Date recorded in the generated snapshot metadata')
args = parser.parse_args()
CACHE.mkdir(parents=True, exist_ok=True)
for name, url in SOURCES.items():
    if args.refresh or not (CACHE / name).exists():
        (CACHE / name).write_bytes(urllib.request.urlopen(url, timeout=60).read())

rows = [line.split('\t') for line in zipfile.ZipFile(CACHE / 'cities15000.zip').read('cities15000.txt').decode('utf-8').splitlines()]
cities = {row[0]: row for row in rows}
countries = {row[0]: row for line in (CACHE / 'countryInfo.txt').read_text(encoding='utf-8').splitlines() if not line.startswith('#') and (row := line.split('\t'))}
ne = json.loads((CACHE / 'natural-earth-populated-places.geojson').read_text(encoding='utf-8'))
korean = {str(feature['properties'].get('GEONAMESID')): feature['properties']['NAME_KO'] for feature in ne['features'] if feature['properties'].get('NAME_KO')}

# Additional present-day seats are explicitly enumerated: do not ingest every
# PPLG or Natural Earth CAPALT row, since those contain historical/other places.
extras = {
    '281184': ('예루살렘', '정부 소재지'),
    '7303419': ('동예루살렘', '수도 주장'),
    '282239': ('라말라', '행정중심지'),
    '3369157': ('케이프타운', '입법 수도'),
    '1018725': ('블룸폰테인', '사법 수도'),
    '3911925': ('라파스', '정부 소재지'),
    '2747373': ('헤이그', '정부 소재지'),
    '6697380': ('푸트라자야', '행정중심지'),
    '935048': ('로밤바', '왕실·입법 중심지'),
    '1238992': ('스리자야와르데네푸라코테', '입법 수도'),
    '2394819': ('코토누', '정부 소재지'),
    '7266440': ('브레이즈', '정부 소재지'),
}
selected = {row[0]: row for row in rows if row[7] == 'PPLC'}
selected.update({key: cities[key] for key in extras})
country_codes = sorted({row[8] for row in selected.values()})
node_code = "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const d=new Intl.DisplayNames(['ko'],{type:'region'});process.stdout.write(JSON.stringify(Object.fromEntries(JSON.parse(s).map(c=>[c,d.of(c)]))));});"
names = json.loads(subprocess.run(['node', '-e', node_code], input=json.dumps(country_codes), capture_output=True, text=True, encoding='utf-8', check=True).stdout)
names.update({'KR': '대한민국', 'KP': '북한', 'PS': '팔레스타인', 'CD': '콩고민주공화국', 'CG': '콩고공화국'})
city_overrides = {'1835848': '서울', '1850147': '도쿄', '5128581': '뉴욕', '4140963': '워싱턴 D.C.', '703448': '키이우', '1816670': '베이징'}
roles = {'964137': '행정 수도', '3903987': '헌법상 수도', '1248991': '행정·상업 중심지'}
result = []
for key, row in selected.items():
    code = row[8]
    label = city_overrides.get(key) or korean.get(key)
    if not label:
        candidates = [name for name in row[3].split(',') if re.fullmatch(r'[가-힣][가-힣\s·.-]*', name)]
        label = candidates[0] if candidates else row[1]
    role = roles.get(key, '')
    if key in extras:
        label, role = extras[key]
    lat, lon = float(row[4]), float(row[5])
    assert math.isfinite(lat) and -90 <= lat <= 90 and math.isfinite(lon) and -180 <= lon <= 180
    item = {'id': f'capital-{code.lower()}-{key}', 'countryCode': code, 'country': names.get(code, countries[code][4]), 'city': label + (f' ({role})' if role else ''), 'cityEnglish': row[2] or row[1], 'latitude': lat, 'longitude': lon, 'elevation': 0}
    result.append(item)
result.sort(key=lambda row: (row['countryCode'], row['cityEnglish']))

# Coverage target: current 193 UN member states plus Vatican City and Palestine.
required = set('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW PS'.split())
assert len(required) == 195
missing = sorted(required - set(country_codes))
assert not missing, f'Missing countries: {missing}'
assert len({row['id'] for row in result}) == len(result)
source = {'snapshotDate': args.snapshot_date, 'provider': 'GeoNames', 'url': 'https://www.geonames.org/', 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/', 'places': len(result), 'countriesAndTerritories': len(country_codes), 'naturalEarthRevision': NE_REV, 'sha256': {name: hashlib.sha256((CACHE / name).read_bytes()).hexdigest() for name in SOURCES}}
(ROOT / 'src').mkdir(parents=True, exist_ok=True)
(ROOT / 'src/capitals.js').write_text('// Coordinates derived from GeoNames, CC BY 4.0; Korean place names from Natural Earth (public domain).\n// See docs/CAPITALS.md for attribution, coverage and build instructions.\nexport const capitalSource = ' + json.dumps(source, ensure_ascii=False, indent=2) + ';\n\nexport const capitals = [\n' + ',\n'.join('  ' + json.dumps(item, ensure_ascii=False) for item in result) + '\n];\n', encoding='utf-8')
print(json.dumps({'places': len(result), 'countriesAndTerritories': len(country_codes), 'UN193_plus_VA_PS_missing': missing, 'KoreanCityNames': sum(bool(re.search('[가-힣]', row['city'])) for row in result), 'EnglishFallback': [row['cityEnglish'] for row in result if not re.search('[가-힣]', row['city'])]}))
