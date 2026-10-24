"""Export an explicitly authorized visible-only sample to stdout, without changing the source."""
import argparse
import hashlib
import io
import json
import pathlib
import sqlite3
import sys
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('--data', required=True)
parser.add_argument('--limit', type=int, default=100)
args = parser.parse_args()
if not 1 <= args.limit <= 100:
    parser.error('--limit must be between 1 and 100')
root = pathlib.Path(args.data).resolve(strict=True)
db_path = (root / 'library.sqlite').resolve(strict=True)
image_dir = (root / 'images').resolve(strict=True)
db = sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True)
db.execute('PRAGMA query_only=ON')
try:
    # Snapshot metadata quickly; don't hold SQLite's read lock while copying originals.
    db.execute('BEGIN')
    rows = db.execute('SELECT id,filename,original_name,created_at,content_hash FROM images WHERE hidden_from_gallery=0 ORDER BY created_at,id').fetchall()
    count = min(args.limit, len(rows))
    if not count:
        raise ValueError('No visible images to evaluate')
    chosen = [rows[i * (len(rows) - 1) // (count - 1) if count > 1 else 0] for i in range(count)]
    tags = {row[0]: [{'name': tag[0]} for tag in db.execute('SELECT tags.name FROM tags JOIN image_tags ON tags.id=image_tags.tag_id WHERE image_id=? ORDER BY image_tags.created_at,tags.id', (row[0],))] for row in chosen}
    db.commit()
finally:
    db.close()
images = []
total_bytes = 0
with tarfile.open(fileobj=sys.stdout.buffer, mode='w|') as archive:
    for image_id, filename, original_name, created_at, expected in chosen:
        path = (image_dir / filename).resolve(strict=True)
        if pathlib.Path(filename).name != filename or path.parent != image_dir:
            raise ValueError('Image path escaped the image directory')
        data = path.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if expected and actual != expected:
            raise ValueError('An original changed; sample export aborted')
        info = tarfile.TarInfo('images/' + filename)
        info.mode = 0o600
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))
        total_bytes += len(data)
        images.append({'id': image_id, 'file': 'images/' + filename, 'sha256': actual,
                       'originalName': original_name, 'createdAt': created_at, 'tags': tags[image_id], 'hiddenFromGallery': False})
    metadata = json.dumps({'version': 1, 'selection': 'even temporal sample of visible images',
                           'visibleCount': len(rows), 'images': images}, ensure_ascii=False, indent=2).encode()
    info = tarfile.TarInfo('dataset.json')
    info.mode = 0o600
    info.size = len(metadata)
    archive.addfile(info, io.BytesIO(metadata))
print(json.dumps({'selectedImages': count, 'visibleImages': len(rows), 'originalBytes': total_bytes}), file=sys.stderr)
