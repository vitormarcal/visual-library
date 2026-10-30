"""Read-only visible-library evaluation using an explicitly selected Immich ML endpoint."""
import argparse
import hashlib
import html
import io
import ipaddress
import json
import math
import pathlib
import sqlite3
import time
import urllib.parse
import urllib.request
import uuid

MODEL = 'ViT-B-16-SigLIP2__webli'
DIMENSIONS = 768


def digest(value):
    return hashlib.sha256(value).hexdigest()


def normalized(value):
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, list) or len(value) != DIMENSIONS or any(
        isinstance(x, bool) or not isinstance(x, (float, int)) or not math.isfinite(x) for x in value
    ):
        raise ValueError('Invalid CLIP vector')
    norm = math.sqrt(sum(x * x for x in value))
    if not math.isfinite(norm) or norm == 0:
        raise ValueError('Empty or invalid CLIP vector')
    return [x / norm for x in value]


def candidates(images, max_distance):
    import numpy as np
    if not math.isfinite(max_distance) or not 0 <= max_distance <= 0.1:
        raise ValueError('Invalid distance')
    if not images:
        return []
    matrix = np.array([normalized(image['vector']) for image in images], dtype=np.float64)
    pairs = []
    # Row-by-row: retain only qualifying pairs, without allocating an N x N matrix.
    for i, image in enumerate(images):
        distances = np.clip(1 - matrix[i + 1:] @ matrix[i], 0, 2)
        for offset in np.flatnonzero(distances <= max_distance):
            other = images[i + 1 + int(offset)]
            pairs.append({'a': image['id'], 'b': other['id'], 'distance': float(distances[offset])})
    return sorted(pairs, key=lambda pair: (pair['distance'], pair['a'], pair['b']))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def endpoint_url(value):
    parsed = urllib.parse.urlsplit(value)
    try:
        explicit_host = parsed.hostname == 'localhost' or bool(ipaddress.ip_address(parsed.hostname))
    except ValueError:
        explicit_host = False
    if parsed.scheme != 'http' or not explicit_host or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('Use an explicit HTTP Immich ML IP address, without credentials or path')
    return value.rstrip('/') + '/predict'


def encode(endpoint, image):
    boundary = uuid.uuid4().hex
    entries = json.dumps({'clip': {'visual': {'modelName': MODEL}}}).encode()
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="entries"\r\n\r\n'.encode()
            + entries + f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="image"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
            + image + f'\r\n--{boundary}--\r\n'.encode())
    request = urllib.request.Request(endpoint, data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=120) as response:
        return normalized(json.load(response)['clip'])


def write_json(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    temp.replace(path)


def report(results):
    esc = lambda value: html.escape(str(value), quote=True)
    images = {image['id']: image for image in results['images']}
    sections = []
    baseline = results.get('baselineMaxDistance')
    for number, pair in enumerate(results['pairs'], 1):
        figures = []
        for image_id in (pair['a'], pair['b']):
            image = images[image_id]
            figures.append(f'<figure><a href="thumbs/{image["sha256"]}.webp" target="_blank" rel="noopener"><img loading="lazy" src="thumbs/{image["sha256"]}.webp" alt="{esc(image["originalName"])}"></a><figcaption>{esc(image["originalName"])} · {esc(image_id)} · {image["width"]}×{image["height"]} · {image["sizeBytes"]} bytes</figcaption></figure>')
        key = esc(pair['a'] + '/' + pair['b'])
        is_new = baseline is not None and pair['distance'] > baseline
        badge = (' · Novo candidato' if is_new else ' · Já apresentado') if baseline is not None else ''
        sections.append(f'<section data-distance="{pair["distance"]}" data-new="{str(is_new).lower()}"><h2>Par {number} · distância {pair["distance"]:.6f}{badge}</h2><div class="pair">{"".join(figures)}</div><label>Julgamento <select data-pair="{key}"><option value="">Não avaliado</option><option value="duplicate">Mesma imagem / cópia</option><option value="related">Imagens diferentes relacionadas</option><option value="different">Imagens diferentes</option><option value="uncertain">Incerto</option></select></label></section>')
    metrics = results['metrics']
    controls, filter_script = '', ''
    if baseline is not None:
        thresholds = sorted({baseline, *[v for v in (.04, .05, .06, .08, .1) if baseline < v <= results['maxDistance']], results['maxDistance']})
        options, rows = [], []
        old_count = sum(pair['distance'] <= baseline for pair in results['pairs'])
        for threshold in thresholds:
            count = sum(pair['distance'] <= threshold for pair in results['pairs'])
            selected = ' selected' if threshold == results['maxDistance'] else ''
            options.append(f'<option value="{threshold}"{selected}>{threshold:g}</option>')
            rows.append(f'<tr><td>{threshold:g}</td><td>{count}</td><td>{count - old_count}</td></tr>')
        controls = f'<p>Ampliação do mesmo snapshot, sem nova inferência. Os {old_count} pares até {baseline:g} já foram apresentados; suas marcações anteriores não foram modificadas.</p><table><thead><tr><th>Distância máxima</th><th>Total de pares</th><th>Adicionais</th></tr></thead><tbody>{"".join(rows)}</tbody></table><p><label>Distância máxima <select id="distance-limit">{"".join(options)}</select></label> <label><input type="checkbox" id="new-only" checked> Mostrar apenas novos candidatos</label></p><p id="visible-count" aria-live="polite"></p>'
        filter_script = '''const limit=document.getElementById('distance-limit'),onlyNew=document.getElementById('new-only');function filterPairs(){let count=0;document.querySelectorAll('section[data-distance]').forEach(section=>{section.hidden=Number(section.dataset.distance)>Number(limit.value)||(onlyNew.checked&&section.dataset.new!=='true');if(!section.hidden)count++});document.getElementById('visible-count').textContent=count+' pares nesta seleção'}limit.onchange=onlyNew.onchange=filterPairs;filterPairs();'''
    return f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Possíveis duplicatas · CLIP</title>
<style>[hidden]{{display:none!important}}body{{font:16px system-ui;margin:24px;background:#fbfbf9;color:#211922}}main{{max-width:1200px;margin:auto}}section{{margin:24px 0;padding:16px;background:white;border-radius:16px}}.pair{{display:flex;gap:16px}}figure{{flex:1;min-width:0;margin:0}}img{{width:100%;height:480px;object-fit:contain;background:#f6f6f3;border-radius:16px}}figcaption{{font-size:12px;overflow-wrap:anywhere}}select,button{{padding:10px;margin:12px 0}}table{{border-collapse:collapse;font-size:14px}}th,td{{padding:8px;text-align:left}}@media(max-width:650px){{.pair{{flex-direction:column}}img{{height:360px}}}}</style>
<main><h1>Possíveis duplicatas</h1><p>{metrics['prepared']} de {metrics['visibleCount']} imagens visíveis analisadas · {len(results['pairs'])} pares · {len(metrics['failures'])} falhas.</p>
<p>{esc(MODEL)} · distância cosseno ≤ {results['maxDistance']}. Inferência pelo Immich ML do Mordor; comparação exaustiva dos vetores prontos. Isto é uma avaliação, sem ações sobre o acervo. Não avaliados não contam como acertos.</p>
<p>Previews de até 960 px; clique para abrir. Julgamentos permanecem apenas nesta página até baixar o arquivo; baixe antes de fechar.</p><button id="export">Baixar julgamentos JSON</button>
{controls}
{''.join(sections) if sections else '<p>Nenhum par candidato entre as imagens analisadas.</p>'}
<details><summary>Configuração, cobertura e falhas</summary><pre>{esc(json.dumps({k: v for k, v in results.items() if k not in ('images', 'pairs')}, ensure_ascii=False, indent=2))}</pre></details></main>
<script>{filter_script}document.getElementById('export').onclick=()=>{{const judgments=Array.from(document.querySelectorAll('[data-pair]')).filter(x=>x.value).map(x=>({{pair:x.dataset.pair,judgment:x.value}}));const blob=new Blob([JSON.stringify({{version:1,runFingerprint:'{results['runFingerprint']}',judgments}},null,2)],{{type:'application/json'}});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='duplicate-judgments.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}};</script></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--ml-url', required=True)
    parser.add_argument('--encoder-id', required=True, help='Fingerprint of the actual ML image, weights and processing configuration')
    parser.add_argument('--max-distance', type=float, default=0.03)
    args = parser.parse_args()
    if not math.isfinite(args.max_distance) or not 0 <= args.max_distance <= 0.1:
        parser.error('max-distance must be between 0 and 0.1')
    endpoint = endpoint_url(args.ml_url)
    data = pathlib.Path(args.data).resolve(strict=True)
    output = pathlib.Path(args.out).resolve()
    repo = pathlib.Path(__file__).resolve().parents[2]
    if output == data or output in data.parents or data in output.parents or output == repo or repo in output.parents or output in repo.parents:
        parser.error('Output must be outside the repository and separate from source data')
    image_dir = (data / 'images').resolve(strict=True)
    db_path = (data / 'library.sqlite').resolve(strict=True)
    if db_path.parent != data or image_dir.parent != data:
        parser.error('Source paths escaped data directory')
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = 40_000_000
    db = sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True)
    db.execute('PRAGMA query_only=ON')
    db.row_factory = sqlite3.Row
    try:
        rows = [dict(row) for row in db.execute('SELECT id,filename,original_name,content_hash FROM images WHERE hidden_from_gallery=0 ORDER BY id')]
    finally:
        db.close()
    if not rows:
        parser.error('No visible images')
    identity = {'version': 1, 'model': MODEL, 'encoderId': args.encoder_id,
                'input': 'original-bytes;ML-decode-and-preprocess', 'dimensions': DIMENSIONS,
                'snapshot': rows, 'maxDistance': args.max_distance}
    fingerprint = digest(json.dumps(identity, sort_keys=True).encode())
    output.mkdir(parents=True, exist_ok=True)
    manifest = output / 'run.json'
    if manifest.exists() and json.loads(manifest.read_text()) != identity:
        parser.error('Use a fresh output directory for a different snapshot or encoder')
    write_json(manifest, identity)
    cache, thumbs = output / 'vectors', output / 'thumbs'
    cache.mkdir(exist_ok=True)
    thumbs.mkdir(exist_ok=True)
    started = time.monotonic()
    metrics = {'visibleCount': len(rows), 'prepared': 0, 'cacheHits': 0, 'failures': [], 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'inferenceSeconds': 0}
    images = []
    for index, row in enumerate(rows, 1):
        try:
            source = (image_dir / row['filename']).resolve(strict=True)
            if source.parent != image_dir or pathlib.Path(row['filename']).name != row['filename']:
                raise ValueError('Source path escaped image directory')
            content = source.read_bytes()
            source_hash = digest(content)
            if row['content_hash'] and source_hash != row['content_hash']:
                raise ValueError('Source content hash changed')
            with Image.open(io.BytesIO(content)) as preview:
                if preview.width * preview.height > 40_000_000:
                    raise ValueError('Image exceeds 40 MP')
                preview.seek(0)
                preview = ImageOps.exif_transpose(preview)
                width, height = preview.size
                preview.thumbnail((960, 960))
                preview.convert('RGB').save(thumbs / (source_hash + '.webp'), 'WEBP', quality=85)
            cache_key = digest((args.encoder_id + source_hash).encode())
            path = cache / (cache_key + '.json')
            vector = None
            if path.exists():
                try:
                    saved = json.loads(path.read_text())
                    if saved['encoderId'] == args.encoder_id and saved['sourceHash'] == source_hash:
                        vector = normalized(saved['vector'])
                        metrics['cacheHits'] += 1
                except (ValueError, KeyError, TypeError):
                    pass
            if vector is None:
                before = time.monotonic()
                vector = encode(endpoint, content)
                metrics['inferenceSeconds'] += time.monotonic() - before
                write_json(path, {'encoderId': args.encoder_id, 'sourceHash': source_hash, 'vector': vector})
            images.append({'id': row['id'], 'originalName': row['original_name'] or row['id'], 'sha256': source_hash,
                           'width': width, 'height': height, 'sizeBytes': len(content), 'vector': vector})
        except Exception as error:
            metrics['failures'].append({'id': row['id'], 'error': type(error).__name__, 'message': str(error)[:240]})
        if index % 25 == 0 or index == len(rows):
            print(json.dumps({'processed': index, 'total': len(rows), 'prepared': len(images), 'failures': len(metrics['failures'])}), flush=True)
    ranking_started = time.monotonic()
    pairs = candidates(images, args.max_distance)
    metrics.update(prepared=len(images), rankingSeconds=time.monotonic() - ranking_started, totalSeconds=time.monotonic() - started,
                   comparedPairs=len(images) * (len(images) - 1) // 2)
    results = {'version': 1, 'runFingerprint': fingerprint, 'encoderId': args.encoder_id, 'model': MODEL,
               'maxDistance': args.max_distance, 'distance': 'cosine', 'snapshot': 'all visible images at start',
               'images': [{k: v for k, v in image.items() if k != 'vector'} for image in images], 'pairs': pairs, 'metrics': metrics}
    write_json(output / 'results.json', results)
    (output / 'index.html').write_text(report(results))
    print(json.dumps({'report': str(output / 'index.html'), 'pairs': len(pairs), 'metrics': metrics}), flush=True)
    if metrics['failures']:
        raise SystemExit(2)


if __name__ == '__main__':
    main()
