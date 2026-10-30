import importlib.util
import hashlib
import json
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location('duplicates', Path(__file__).with_name('duplicate-evaluate.py'))
duplicates = importlib.util.module_from_spec(spec)
spec.loader.exec_module(duplicates)


class DuplicateEvaluationTests(unittest.TestCase):
    def vector(self, x=1, y=0):
        return [x, y] + [0] * 766

    def test_cosine_distance_not_euclidean_or_raw_dot(self):
        images = [{'id': 'a', 'vector': self.vector(2)}, {'id': 'b', 'vector': self.vector(3)},
                  {'id': 'c', 'vector': self.vector(0, 1)}]
        self.assertEqual(duplicates.candidates(images, .03), [{'a': 'a', 'b': 'b', 'distance': 0.0}])
        self.assertEqual(duplicates.candidates([], .03), [])

    def test_threshold_excludes_related_and_no_self_or_reverse_pairs(self):
        images = [{'id': 'a', 'vector': self.vector()}, {'id': 'b', 'vector': self.vector(.98, .199)},
                  {'id': 'c', 'vector': self.vector(.9, .436)}]
        pairs = duplicates.candidates(images, .03)
        self.assertEqual([(p['a'], p['b']) for p in pairs], [('a', 'b')])
        self.assertGreater(pairs[0]['distance'], .01)

    def test_invalid_vectors_and_thresholds(self):
        for vector in ([0] * 768, [1] * 767, [True] * 768, [float('nan')] * 768, [1e308] * 768):
            with self.assertRaises(ValueError):
                duplicates.normalized(vector)
        with self.assertRaises(ValueError):
            duplicates.candidates([], float('nan'))

    def test_endpoint_requires_explicit_address_without_redirect_or_credentials(self):
        self.assertEqual(duplicates.endpoint_url('http://127.0.0.1:3003'), 'http://127.0.0.1:3003/predict')
        for url in ('https://example.com', 'http://example.com', 'http://user:secret@127.0.0.1', 'http://127.0.0.1/foo'):
            with self.assertRaises(ValueError):
                duplicates.endpoint_url(url)

    def test_report_escapes_metadata_and_defaults_to_unjudged(self):
        image = {'id': 'safe-id', 'sha256': 'a' * 64, 'originalName': '<script>alert(1)</script>', 'width': 1, 'height': 1, 'sizeBytes': 1}
        result = {'images': [image, {**image, 'id': 'other'}], 'pairs': [{'a': 'safe-id', 'b': 'other', 'distance': 0}],
                  'metrics': {'visibleCount': 2, 'prepared': 2, 'failures': []}, 'maxDistance': .03, 'runFingerprint': 'b' * 64}
        report = duplicates.report(result)
        self.assertNotIn('<script>alert(1)</script>', report)
        self.assertIn('&lt;script&gt;', report)
        self.assertIn('Não avaliado', report)
        self.assertIn('duplicate-judgments.json', report)

    def test_readonly_source_hidden_exclusion_failures_and_cache(self):
        from PIL import Image
        requests = []
        vector = self.vector()

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                requests.append(self.rfile.read(int(self.headers['Content-Length'])))
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'clip': json.dumps(vector)}).encode())

            def log_message(self, *args):
                pass

        server = HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                data = root / 'data'
                sources = data / 'images'
                sources.mkdir(parents=True)
                db_path = data / 'library.sqlite'
                db = sqlite3.connect(db_path)
                db.execute('CREATE TABLE images(id TEXT,filename TEXT,original_name TEXT,content_hash TEXT,hidden_from_gallery INTEGER)')
                for name, hidden in [('a', 0), ('b', 0), ('hidden', 1), ('broken', 0)]:
                    path = sources / (name + '.png')
                    if name == 'broken':
                        path.write_bytes(b'invalid image')
                    else:
                        Image.new('RGB', (10, 12), 'red' if name == 'a' else 'blue').save(path)
                    db.execute('INSERT INTO images VALUES(?,?,?,?,?)', (name, path.name, name, hashlib.sha256(path.read_bytes()).hexdigest(), hidden))
                db.commit()
                db.close()
                before = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in [db_path, *sources.iterdir()]}
                command = [sys.executable, str(Path(__file__).with_name('duplicate-evaluate.py')), '--data', str(data), '--out', str(root / 'report'),
                           '--ml-url', f'http://127.0.0.1:{server.server_port}', '--encoder-id', 'fixture-encoder']
                for iteration in range(2):
                    run = subprocess.run(command, capture_output=True, text=True)
                    self.assertEqual(run.returncode, 2, run.stderr)
                    result = json.loads((root / 'report/results.json').read_text())
                    self.assertEqual(result['metrics']['visibleCount'], 3)
                    self.assertEqual(result['metrics']['prepared'], 2)
                    self.assertEqual(len(result['pairs']), 1)
                    self.assertEqual(result['metrics']['failures'][0]['id'], 'broken')
                    self.assertEqual(result['metrics']['cacheHits'], 2 * iteration)
                    self.assertEqual(len(requests), 2)
                self.assertTrue(all(hashlib.sha256(path.read_bytes()).hexdigest() == hashed for path, hashed in before.items()))
                self.assertNotIn('hidden', (root / 'report/results.json').read_text())
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_expansion_uses_matching_cache_and_preserves_original_report(self):
        expand_spec = importlib.util.spec_from_file_location('expansion', Path(__file__).with_name('duplicate-expand.py'))
        expansion = importlib.util.module_from_spec(expand_spec)
        expand_spec.loader.exec_module(expansion)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source'
            (source / 'vectors').mkdir(parents=True)
            (source / 'thumbs').mkdir()
            images = []
            for image_id, vector, image_hash in [('a', self.vector(), 'a' * 64), ('b', self.vector(.95, .312), 'b' * 64)]:
                images.append({'id': image_id, 'sha256': image_hash, 'originalName': image_id, 'width': 1, 'height': 1, 'sizeBytes': 1})
                key = duplicates.digest(('fixture' + image_hash).encode())
                (source / 'vectors' / (key + '.json')).write_text(json.dumps({'encoderId': 'fixture', 'sourceHash': image_hash, 'vector': vector}))
                (source / 'thumbs' / (image_hash + '.webp')).write_bytes(b'preview')
            old = {'encoderId': 'fixture', 'runFingerprint': 'c' * 64, 'maxDistance': .03, 'images': images, 'pairs': [],
                   'metrics': {'prepared': 2, 'visibleCount': 3, 'failures': [{'id': 'failed'}]}}
            old_bytes = json.dumps(old).encode()
            (source / 'results.json').write_bytes(old_bytes)
            result = expansion.expand(source, root / 'expanded', .1)
            self.assertEqual(len(result['pairs']), 1)
            self.assertGreater(result['pairs'][0]['distance'], .03)
            self.assertEqual(result['metrics']['inferenceSeconds'], 0)
            self.assertEqual(result['metrics']['cacheHits'], 2)
            self.assertEqual(result['metrics']['failures'], old['metrics']['failures'])
            self.assertEqual((source / 'results.json').read_bytes(), old_bytes)
            markup = (root / 'expanded/index.html').read_text()
            self.assertIn('id="new-only" checked', markup)
            self.assertIn('Novo candidato', markup)
            cache_path = next((source / 'vectors').glob('*.json'))
            cache = json.loads(cache_path.read_text())
            cache['encoderId'] = 'wrong-model'
            cache_path.write_text(json.dumps(cache))
            with self.assertRaises(ValueError):
                expansion.expand(source, root / 'invalid', .1)
            self.assertFalse((root / 'invalid').exists())


if __name__ == '__main__':
    unittest.main()
