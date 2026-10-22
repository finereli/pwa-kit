#!/usr/bin/env python3
"""pwa kit tool: drift detection between the kit and a project.

    kit.py status <project-dir> [--all]   what the project has, and how it differs from the kit
    kit.py relabel <project-dir>          rewrite headers of `current` files to the kit's version
    kit.py bump <item> [--note "..."]     new version of a kit item: rewrite headers, record hashes
    kit.py check                          every kit file's header + hash matches MANIFEST.json
    kit.py list                           kit items, versions, files
    kit.py changelog                      rewrite CHANGELOG.md from the manifest's version notes

Every kit file carries a header line `pwa-kit: <item>/<file> v<n>` in whatever comment
syntax the file type uses. MANIFEST.json records, per item, the current version and the
sha256 of each file at every version it has had. That history is what lets `status`
distinguish "the kit moved" from "this project edited its copy" from "both".

Statuses printed by `status`:
    current       identical to the kit's current version
    upstream      the kit has a newer version and the project copy is untouched: copy over
    modified      same version as the kit but the project edited it: keep, or promote
    both          the kit moved AND the project edited: three-way merge by hand (or by Claude)
    unknown       header names a kit path or version the manifest doesn't know
    available     kit items the project doesn't use at all (only with --all)

Only the Python standard library is used.
"""
import hashlib
import json
import os
import re
import sys

KIT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kit')
KIT = os.path.normpath(KIT)
MANIFEST = os.path.join(KIT, 'MANIFEST.json')
CHANGELOG = os.path.join(KIT, '..', 'CHANGELOG.md')
HEADER = re.compile(r'pwa-kit:\s*(\S+)\s+v(\d+)')
SKIP_DIRS = {'node_modules', 'dist', 'dist-media', '.git', '.svelte-kit', '.wrangler', 'build', '.venv'}
TEXT_EXT = {'.js', '.mjs', '.ts', '.svelte', '.css', '.html', '.sh', '.py', '.sql', '.md', '.json', '.toml', '.jsonc', '.yml', '.yaml', '.vars', '.txt'}

# JSON has no comment syntax: these get no header (still hashed in the manifest;
# `status` can't find them in a project, and they're edited templates anyway).
HEADERLESS_EXT = {'.json'}

COMMENT = {
    '.js': ('// ', ''), '.mjs': ('// ', ''), '.ts': ('// ', ''), '.jsonc': ('// ', ''),
    '.svelte': ('<!-- ', ' -->'), '.html': ('<!-- ', ' -->'), '.md': ('<!-- ', ' -->'),
    '.css': ('/* ', ' */'),
    '.sh': ('# ', ''), '.py': ('# ', ''), '.toml': ('# ', ''), '.yml': ('# ', ''), '.yaml': ('# ', ''), '.vars': ('# ', ''),
    '.sql': ('-- ', ''),
}


def sha(path):
    """sha256 of the file with the pwa-kit header line removed, so a version bump that
    only relabels the header doesn't count as a content change."""
    with open(path, 'rb') as f:
        lines = f.read().split(b'\n')
    lines = [l for l in lines[:5] if not HEADER.search(l.decode('utf-8', 'replace'))] + lines[5:]
    return hashlib.sha256(b'\n'.join(lines)).hexdigest()


def load_manifest():
    if not os.path.exists(MANIFEST):
        return {'items': {}}
    with open(MANIFEST) as f:
        return json.load(f)


def save_manifest(m):
    with open(MANIFEST, 'w') as f:
        json.dump(m, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write('\n')


def read_header(path):
    """Return (kitpath, version) from the file's first 5 lines, or None."""
    try:
        with open(path, encoding='utf-8', errors='replace') as f:
            for _ in range(5):
                line = f.readline()
                if not line:
                    break
                m = HEADER.search(line)
                if m:
                    return m.group(1), int(m.group(2))
    except OSError:
        pass
    return None


def kit_files(item):
    """All files under kit/<item>/ except README.md, as paths relative to the item dir."""
    root = os.path.join(KIT, item)
    out = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            rel = os.path.relpath(os.path.join(dp, fn), root)
            if rel == 'README.md':
                continue
            out.append(rel)
    return sorted(out)


def set_header(path, kitpath, version):
    """Insert or rewrite the pwa-kit header as the first line (after a shebang or
    doctype, if any). JSON files are left alone."""
    ext = os.path.splitext(path)[1]
    if ext in HEADERLESS_EXT:
        return
    open_c, close_c = COMMENT.get(ext, ('# ', ''))
    header = f'{open_c}pwa-kit: {kitpath} v{version}{close_c}\n'
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()
    # drop an existing header wherever it is in the first 5 lines
    for i in range(min(5, len(lines))):
        if HEADER.search(lines[i]):
            del lines[i]
            break
    at = 1 if lines and (lines[0].startswith('#!') or lines[0].lower().startswith('<!doctype')) else 0
    lines.insert(at, header)
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)


def cmd_bump(item, note=None):
    m = load_manifest()
    entry = m['items'].setdefault(item, {'version': 0, 'files': {}, 'notes': {}})
    files = kit_files(item)
    if not files:
        sys.exit(f'no files under kit/{item}/')
    entry['version'] += 1
    v = entry['version']
    for rel in files:
        path = os.path.join(KIT, item, rel)
        set_header(path, f'{item}/{rel}', v)
        entry['files'].setdefault(rel, {})[str(v)] = sha(path)
    # files removed from the item stay in history but are no longer "current"
    entry['current_files'] = files
    if note:
        entry.setdefault('notes', {})[str(v)] = note
    save_manifest(m)
    cmd_changelog(quiet=True)
    print(f'{item} -> v{v} ({len(files)} files)')


def cmd_changelog(quiet=False):
    # The notes are the real history: why each version exists. Commits say when.
    m = load_manifest()
    out = ['# Changelog\n\n',
           'Generated by `scripts/kit.py changelog` from the version notes in `kit/MANIFEST.json`. '
           'Newest version first within each item. Edit the notes, not this file.\n']
    for item in sorted(m['items']):
        e = m['items'][item]
        out.append(f"\n## {item} (v{e['version']})\n\n")
        notes = e.get('notes', {})
        for v in sorted(notes, key=int, reverse=True):
            out.append(f'- **v{v}** - {notes[v]}\n')
    with open(CHANGELOG, 'w', encoding='utf-8') as f:
        f.writelines(out)
    if not quiet:
        print(f'wrote {os.path.normpath(CHANGELOG)}')


def cmd_check():
    m = load_manifest()
    bad = 0
    for item, entry in sorted(m['items'].items()):
        v = entry['version']
        for rel in kit_files(item):
            path = os.path.join(KIT, item, rel)
            h = read_header(path)
            want = (f'{item}/{rel}', v)
            recorded = entry['files'].get(rel, {}).get(str(v))
            if os.path.splitext(rel)[1] in HEADERLESS_EXT:
                if recorded != sha(path):
                    print(f'HASH    {item}/{rel}: file changed since v{v} was recorded (run: kit.py bump {item})')
                    bad += 1
                continue
            if h != want:
                print(f'HEADER  {item}/{rel}: has {h}, want {want}')
                bad += 1
            elif recorded != sha(path):
                print(f'HASH    {item}/{rel}: file changed since v{v} was recorded (run: kit.py bump {item})')
                bad += 1
    for item in sorted(os.listdir(KIT)):
        if os.path.isdir(os.path.join(KIT, item)) and item not in m['items']:
            print(f'UNBUMPED {item}: directory exists but not in manifest (run: kit.py bump {item})')
            bad += 1
    print('ok' if not bad else f'{bad} problem(s)')
    return bad


def cmd_list():
    m = load_manifest()
    for item, entry in sorted(m['items'].items()):
        print(f'{item}  v{entry["version"]}')
        for rel in entry.get('current_files', sorted(entry['files'])):
            print(f'    {rel}')


def cmd_relabel(project):
    """Files whose content matches the kit's current version but whose header
    names an older version get the header rewritten. Nothing else is touched."""
    m = load_manifest()
    project = os.path.abspath(project)
    n = 0
    for st, kitpath, lv, kv, relpath in scan(project, m):
        if st == 'current' and kv is not None and lv != kv:
            set_header(os.path.join(project, relpath), kitpath, kv)
            print(f'relabel   {kitpath:<40} v{lv} -> v{kv}   {relpath}')
            n += 1
    print(f'-- {n} relabeled')


def scan(project, m):
    found = []  # (status, kitpath, local_v, kit_v, path)
    for dp, dns, fns in os.walk(project):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if os.path.splitext(fn)[1] not in TEXT_EXT:
                continue
            path = os.path.join(dp, fn)
            h = read_header(path)
            if not h:
                continue
            kitpath, local_v = h
            item, _, rel = kitpath.partition('/')
            entry = m['items'].get(item)
            relpath = os.path.relpath(path, project)
            if not entry or rel not in entry['files']:
                found.append(('unknown', kitpath, local_v, None, relpath))
                continue
            kit_v = entry['version']
            hist = entry['files'][rel]
            local_sha = sha(path)
            cur_sha = hist.get(str(kit_v))
            origin_sha = hist.get(str(local_v))
            if local_sha == cur_sha:
                st = 'current'          # content matches; header may just need relabeling
            elif local_v > kit_v or origin_sha is None:
                st = 'unknown'
            elif local_sha == origin_sha:
                st = 'upstream'         # untouched copy of an older version
            elif origin_sha == cur_sha:
                st = 'modified'         # kit content didn't move since this copy was taken
            else:
                st = 'both'
            found.append((st, kitpath, local_v, kit_v, relpath))
    return found


def cmd_status(project, show_all=False):
    m = load_manifest()
    project = os.path.abspath(project)
    found = scan(project, m)
    used_items = {r[1].partition('/')[0] for r in found if r[0] != 'unknown'}
    order = {'both': 0, 'upstream': 1, 'modified': 2, 'unknown': 3, 'current': 4}
    found.sort(key=lambda r: (order[r[0]], r[1]))
    w = max([len(r[1]) for r in found] + [10])
    for st, kitpath, lv, kv, relpath in found:
        ver = f'v{lv}' + (f' -> v{kv}' if kv is not None and kv != lv else '')
        print(f'{st:<9} {kitpath:<{w}}  {ver:<10} {relpath}')
    if show_all:
        for item in sorted(m['items']):
            if item not in used_items:
                print(f'available {item} v{m["items"][item]["version"]}')
    counts = {}
    for r in found:
        counts[r[0]] = counts.get(r[0], 0) + 1
    print('--', ', '.join(f'{k} {v}' for k, v in sorted(counts.items(), key=lambda kv: order[kv[0]])) or 'no kit files found')


def main(argv):
    if len(argv) < 2 or argv[1] not in ('status', 'bump', 'check', 'list', 'relabel', 'changelog'):
        print(__doc__)
        return 2
    cmd = argv[1]
    if cmd == 'status':
        if len(argv) < 3:
            sys.exit('usage: kit.py status <project-dir> [--all]')
        cmd_status(argv[2], '--all' in argv)
    elif cmd == 'bump':
        if len(argv) < 3:
            sys.exit('usage: kit.py bump <item> [--note "..."]')
        note = None
        if '--note' in argv:
            note = argv[argv.index('--note') + 1]
        cmd_bump(argv[2], note)
    elif cmd == 'check':
        return 1 if cmd_check() else 0
    elif cmd == 'list':
        cmd_list()
    elif cmd == 'changelog':
        cmd_changelog()
    elif cmd == 'relabel':
        if len(argv) < 3:
            sys.exit('usage: kit.py relabel <project-dir>')
        cmd_relabel(argv[2])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
