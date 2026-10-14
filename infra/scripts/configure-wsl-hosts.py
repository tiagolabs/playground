#!/usr/bin/env python3
"""Update only lab aliases; preserve all unrelated hosts entries and WSL settings."""
from pathlib import Path
import re
hosts = Path('/etc/hosts')
aliases = {'heroassociation.test','auth.heroassociation.test','identity.lab.test','auth.lab.test','payments.lab.test','app.e2e.heroassociation.test','auth.e2e.heroassociation.test'}
lines = []
for line in hosts.read_text().splitlines():
    address, _, comment = line.partition('#')
    parts = address.split()
    if len(parts)>1:
        names = [name for name in parts[1:] if name not in aliases]
        if not names: continue
        line = parts[0]+'\t'+' '.join(names)+(' #'+comment if comment else '')
    lines.append(line)
lines.append('127.0.0.2 heroassociation.test identity.lab.test auth.lab.test payments.lab.test app.e2e.heroassociation.test auth.e2e.heroassociation.test # tiagolabs-local')
hosts.write_text('\n'.join(lines)+'\n')
# WSL otherwise regenerates /etc/hosts at startup.
config=Path('/etc/wsl.conf')
s=config.read_text() if config.exists() else ''
section=re.search(r'(?ms)^\[network\][^\[]*',s)
if section:
    value=section.group()
    if re.search(r'(?m)^\s*generateHosts\s*=',value):
        value=re.sub(r'(?m)^\s*generateHosts\s*=.*$', 'generateHosts=false',value)
    else: value=value.rstrip()+'\ngenerateHosts=false\n'
    s=s[:section.start()]+value+s[section.end():]
else:s=s.rstrip()+'\n\n[network]\ngenerateHosts=false\n'
config.write_text(s)
print('Configured WSL lab aliases on 127.0.0.2.')
