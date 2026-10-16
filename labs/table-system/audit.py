"""Check pre-existing file hashes and additive source boundaries without modifying files."""
import hashlib
import json
from pathlib import Path

workspace = Path(__file__).resolve().parents[2]
baseline = json.loads((Path(__file__).parent / 'initial-state.json').read_text())
changed = [name for name, digest in baseline['hashes'].items()
           if not (workspace / name).is_file()
           or hashlib.sha256((workspace / name).read_bytes()).hexdigest() != digest]
source_roots = [workspace / 'src/app/shared/table-system', workspace / 'src/app/features/table-system-lab']
prohibited = []
for root in source_roots:
    for source in root.rglob('*.ts'):
        text = source.read_text()
        if any(path in text for path in ['shared/grid-cells', 'shared/editor-host', 'features/grid-demo']):
            prohibited.append(str(source.relative_to(workspace)))
cache_changes = [name for name in changed if name.startswith('.npm-cache/')]
changed = [name for name in changed if name not in cache_changes]
allowed = ('src/app/shared/table-system/', 'src/app/features/table-system-lab/', 'labs/table-system/')
new_outside = []
import os
for folder, dirs, files in os.walk(workspace):
    dirs[:] = [name for name in dirs if name not in {'.git', 'node_modules', '.npm-cache', '.angular', 'dist', 'out-tsc', 'test-results', 'playwright-report'}]
    for filename in files:
        name = str((Path(folder) / filename).relative_to(workspace))
        if name not in baseline['hashes'] and not name.startswith(allowed):
            new_outside.append(name)
result = {'new_files_outside_scope': new_outside, 'changed_tool_caches': cache_changes, 'changed_existing_files': changed, 'prohibited_import_files': prohibited}
print(json.dumps(result, indent=2))
raise SystemExit(bool(changed or prohibited or new_outside))
