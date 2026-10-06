"""Fortward dev server: obsluhuje priečinok www a cez POST /snap?name=x uloží PNG snímku (na ladenie grafiky)."""
import base64
import http.server
import os
import sys
import urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'www')
# --lan: sprístupní server aj iným zariadeniam v sieti (mobil na tej istej Wi-Fi)
LAN = '--lan' in sys.argv
ARGS = [a for a in sys.argv[1:] if a != '--lan']
SNAP_DIR = ARGS[1] if len(ARGS) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snaps')
PORT = int(ARGS[0]) if ARGS else 8420


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path != '/snap' or LAN:  # v sieťovom režime nikto zvonka nezapisuje na disk
            self.send_error(404)
            return
        name = urllib.parse.parse_qs(u.query).get('name', ['snap'])[0]
        name = ''.join(c for c in name if c.isalnum() or c in '-_') or 'snap'
        data = self.rfile.read(int(self.headers['Content-Length']))
        png = base64.b64decode(data.split(b',', 1)[-1])
        os.makedirs(SNAP_DIR, exist_ok=True)
        with open(os.path.join(SNAP_DIR, name + '.png'), 'wb') as f:
            f.write(png)
        self.send_response(204)
        self.end_headers()


if LAN:
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except OSError:
        ip = '?'
    finally:
        s.close()
    print(f'Fortward beží aj v sieti: http://{ip}:{PORT}  (otvor na mobile v tej istej Wi-Fi)', flush=True)
http.server.ThreadingHTTPServer(('0.0.0.0' if LAN else '127.0.0.1', PORT), Handler).serve_forever()
