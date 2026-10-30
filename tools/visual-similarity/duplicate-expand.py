"""Expand a frozen duplicate report from its cached vectors, without inference or source access."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import re
import shutil
import time

spec = importlib.util.spec_from_file_location('duplicates', Path(__file__).with_name('duplicate-evaluate.py'))
duplicates = importlib.util.module_from_spec(spec)
spec.loader.exec_module(duplicates)


def expand(source, output, maximum):
    started = time.monotonic()
    source, output = Path(source).resolve(strict=True), Path(output).resolve()
    repo = Path(__file__).resolve().parents[2]
    if output == source or source in output.parents or output in source.parents or output == repo or repo in output.parents or output in repo.parents:
        raise ValueError('Keep output separate from the source report and repository')
    previous = json.loads((source / 'results.json').read_text())
    if not math.isfinite(maximum) or not previous['maxDistance'] < maximum <= .1:
        raise ValueError('Expanded distance must exceed the original and be at most 0.1')
    encoder = previous['encoderId']
    images = []
    for image in previous['images']:
        if not re.fullmatch('[a-f0-9]{64}', image['sha256']):
            raise ValueError('Invalid image hash')
        cache_key = duplicates.digest((encoder + image['sha256']).encode())
        cache = json.loads((source / 'vectors' / (cache_key + '.json')).read_text())
        if cache['encoderId'] != encoder or cache['sourceHash'] != image['sha256']:
            raise ValueError('Cached vector does not match source report')
        images.append({**image, 'vector': duplicates.normalized(cache['vector'])})
    if len({image['id'] for image in images}) != len(images) or len(images) != previous['metrics']['prepared']:
        raise ValueError('Incomplete or invalid source report')
    pairs = duplicates.candidates(images, maximum)
    identity = {'version': 1, 'sourceRunFingerprint': previous['runFingerprint'], 'encoderId': encoder, 'maxDistance': maximum}
    results = {**previous, 'sourceRunFingerprint': previous['runFingerprint'],
               'runFingerprint': duplicates.digest(json.dumps(identity, sort_keys=True).encode()),
               'baselineMaxDistance': previous['maxDistance'], 'maxDistance': maximum, 'pairs': pairs,
               'metrics': {'visibleCount': previous['metrics']['visibleCount'], 'prepared': len(images),
                           'failures': previous['metrics']['failures'], 'cacheHits': len(images),
                           'inferenceSeconds': 0, 'comparedPairs': len(images) * (len(images) - 1) // 2}}
    # A fresh directory preserves the original report and any saved human judgments.
    output.mkdir(parents=True, exist_ok=False)
    try:
        thumbs = output / 'thumbs'
        thumbs.mkdir()
        hashes = {image['id']: image['sha256'] for image in images}
        for image_hash in {hashes[pair[key]] for pair in pairs for key in ('a', 'b')}:
            shutil.copyfile(source / 'thumbs' / (image_hash + '.webp'), thumbs / (image_hash + '.webp'))
        results['metrics']['totalSeconds'] = time.monotonic() - started
        duplicates.write_json(output / 'run.json', identity)
        duplicates.write_json(output / 'results.json', results)
        (output / 'index.html').write_text(duplicates.report(results))
    except Exception:
        shutil.rmtree(output)
        raise
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-report', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--max-distance', type=float, default=.1)
    args = parser.parse_args()
    results = expand(args.from_report, args.out, args.max_distance)
    baseline = results['baselineMaxDistance']
    print(json.dumps({'prepared': results['metrics']['prepared'], 'pairs': len(results['pairs']),
                      'additionalPairs': sum(pair['distance'] > baseline for pair in results['pairs']),
                      'counts': {str(t): sum(pair['distance'] <= t for pair in results['pairs']) for t in (.03, .04, .05, .06, .08, .1) if t <= args.max_distance},
                      'metrics': results['metrics']}))


if __name__ == '__main__':
    main()
