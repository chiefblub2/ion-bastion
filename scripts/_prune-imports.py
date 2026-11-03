# Throwaway: drop named imports a file never uses (TS6133/TS6192 as reported by tsc --noUnusedLocals) from the given files.
import re, subprocess, sys
files = set(sys.argv[1:])
out = subprocess.run(["npx", "tsc", "--noEmit", "-p", ".", "--noUnusedLocals"], capture_output=True, text=True).stdout
unused = {}
for line in out.splitlines():
    m = re.match(r"(.+?)\((\d+),(\d+)\): error TS6(133|192): (?:'(\w+)')?", line)
    if m and m.group(1) in files: unused.setdefault(m.group(1), []).append((int(m.group(2)), m.group(5)))
for f, items in unused.items():
    L = open(f).read().split("\n")
    for ln, name in items:
        l = L[ln - 1]
        if not l.startswith("import"): continue
        if name is None: L[ln - 1] = None; continue
        m = re.match(r"import (type )?\{(.*)\} from (.*)$", l)
        if not m: continue
        names = [n.strip() for n in m.group(2).split(",") if n.strip() and re.sub(r"^type ", "", n.strip()) != name]
        L[ln - 1] = f"import {m.group(1) or ''}{{ {', '.join(names)} }} from {m.group(3)}" if names else None
    open(f, "w").write("\n".join(l for l in L if l is not None))
    print("pruned", f, len(items))
