"""Baut die App aus src/:
  site/                    -> installierbare Web-App (PWA) für GitHub Pages
  dist/single.html         -> eine Datei ohne Online-Teil (Claude-Seite)
  dist/apk-index.html      -> eine Datei für die Android-APK (lokal + KI-Joker über CDN)
Aufruf: python3 tools/build.py [--config config.json] [--out site]"""
import json, os, re, shutil, sys, time, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
args = sys.argv[1:]
def arg(name, default):
    return args[args.index(name) + 1] if name in args else default
CONFIG = json.load(open(os.path.join(ROOT, arg("--config", "config.json")), encoding="utf8"))
OUT = os.path.join(ROOT, arg("--out", "site"))
DIST = os.path.join(ROOT, "dist")

def read(name): return open(os.path.join(SRC, name), encoding="utf8").read()

def reel(cx, cy, tape_r):
    teeth = "".join(f'<rect x="{cx-2.5}" y="{cy-12}" width="5" height="6" rx="1" fill="#120F2B" transform="rotate({a} {cx} {cy})"/>' for a in range(0, 360, 60))
    return (f'<circle cx="{cx}" cy="{cy}" r="{tape_r}" fill="#4A2E3A"/><g class="reel"><circle cx="{cx}" cy="{cy}" r="19" fill="#F5F2FF"/>'
            f'<circle cx="{cx}" cy="{cy}" r="12" fill="#2D2766"/>{teeth}<circle cx="{cx}" cy="{cy-15}" r="2" fill="#ABA5D8"/></g>')

SVG = {
 "CASSETTE": f'''<svg viewBox="0 0 320 200" role="img" aria-label="Kassette"><defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#FF4F7B"/><stop offset="1" stop-color="#FFB547"/></linearGradient></defs>
<rect x="4" y="4" width="312" height="192" rx="18" fill="#2D2766" stroke="#4B4398" stroke-width="2"/><circle cx="18" cy="18" r="4" fill="#120F2B"/><circle cx="302" cy="18" r="4" fill="#120F2B"/><circle cx="18" cy="182" r="4" fill="#120F2B"/><circle cx="302" cy="182" r="4" fill="#120F2B"/>
<rect x="28" y="20" width="264" height="118" rx="10" fill="#FFF4DC"/><rect x="28" y="20" width="264" height="18" rx="10" fill="url(#cg)"/><rect x="28" y="30" width="264" height="8" fill="url(#cg)"/>
<text class="caslbl" x="40" y="58" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#2A2140" letter-spacing="1.5">RÜCKWÄRTS-RÄTSEL</text><text x="280" y="58" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#2A2140" text-anchor="end">A↔B</text>
<rect x="70" y="68" width="180" height="56" rx="28" fill="#120F2B"/><rect x="128" y="80" width="64" height="32" rx="3" fill="#1D1846"/>{reel(98, 96, 25)}{reel(222, 96, 21)}
<path d="M70 196 L88 156 H232 L250 196 Z" fill="#231E52" stroke="#4B4398" stroke-width="2"/><circle cx="112" cy="178" r="5" fill="#120F2B"/><circle cx="208" cy="178" r="5" fill="#120F2B"/><rect x="146" y="170" width="10" height="10" rx="2" fill="#120F2B"/><rect x="164" y="170" width="10" height="10" rx="2" fill="#120F2B"/></svg>''',
 "PHONE": '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/><path d="M20 8l2 2-2 2M4 12l-2 2 2 2"/></svg>',
 "PLAY": '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
 "REV": '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 5.5v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 11 5.5zm11 0v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5a1 1 0 0 1 1.6.8z"/></svg>',
 "SKIP": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
 "I_ONLINE": '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M2.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><path d="M14.5 14.6c.6-.3 1.3-.4 2-.4 2.3 0 4.1 1.5 4.6 4"/></svg>',
 "I_LOCAL": '<svg viewBox="0 0 24 24" fill="none" stroke="#ABA5D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>',
 "I_GEAR": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
 "I_BACK": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 "I_AI": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="12.5" r="1.3" fill="currentColor"/><circle cx="15" cy="12.5" r="1.3" fill="currentColor"/><path d="M9.5 16h5"/><path d="M2 11v4M22 11v4"/></svg>',
 "I_AGAIN": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 11.6 4"/><path d="M12 17.5V21"/><path d="M18.5 11.5V15h-3.5"/></svg>',
 "I_LETTERS": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16l3.5-9 3.5 9"/><path d="M4.3 13h4.4"/><path d="M13 17h3M18 17h3"/></svg>',
 "I_SENT": '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
}

def words_js():
    w = {"de": json.load(open(os.path.join(SRC, "words_de.json"), encoding="utf8")),
         "en": json.load(open(os.path.join(SRC, "words_en.json"), encoding="utf8"))}
    return "window.RR_WORDS=" + json.dumps(w, ensure_ascii=False, separators=(",", ":")) + ";"

def config_js(extra):
    c = dict(CONFIG); c.update(extra)
    return "window.RR_CONFIG=" + json.dumps(c, ensure_ascii=False) + ";"

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;600;800&family=JetBrains+Mono:wght@500;700&display=swap">'

def page(head, scripts):
    html = read("shell.html")
    css = read("base.css") + "\n" + read("extra.css")
    html = html.replace("__HEAD__", head).replace("__CSS__", css).replace("__SCRIPTS__", scripts)
    for k, v in SVG.items():
        html = html.replace(f"__{k}__", v)
    left = re.findall(r"__[A-Z_]+__", html)
    assert not left, left
    return html

def build_site():
    if os.path.isdir(OUT):
        for name in os.listdir(OUT):
            if name == "vendor": continue
            p = os.path.join(OUT, name)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    os.makedirs(OUT, exist_ok=True)
    head = ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<title>Rückwärts-Rätsel</title>\n<meta name="theme-color" content="#120F2B">\n'
            '<meta name="description" content="Rückwärts-Sprachspiel: Wort einsprechen, rückwärts nachsprechen, erraten. Online-Duelle mit Freunden.">\n'
            '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icons/icon-192.png">\n'
            '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
            '<meta name="apple-mobile-web-app-title" content="Rückwärts-Rätsel">\n' + FONTS + '\n</head>\n<body>')
    scripts = '<script src="config.js"></script>\n<script src="words.js"></script>\n<script src="app.js"></script>\n</body>\n</html>\n'
    html = page(head, scripts).replace("<style>", "<style>\n:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\nbody{margin:0}\n", 1)
    files = {"index.html": html, "app.js": read("app.js"), "words.js": words_js(), "config.js": config_js({})}
    build = hashlib.sha1("".join(files.values()).encode()).hexdigest()[:10]
    files["sw.js"] = read("sw.js").replace("__BUILD__", build)
    files["manifest.webmanifest"] = json.dumps({
        "name": "Rückwärts-Rätsel", "short_name": "Rückwärts", "description": "Rückwärts-Sprachspiel für zwei – auch online.",
        "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait",
        "background_color": "#120F2B", "theme_color": "#120F2B", "lang": "de",
        "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
                  {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]
    }, ensure_ascii=False, indent=1)
    files[".nojekyll"] = ""
    for name, content in files.items():
        open(os.path.join(OUT, name), "w", encoding="utf8").write(content)
    shutil.copytree(os.path.join(ROOT, "icons"), os.path.join(OUT, "icons"))
    return build

def build_single(name, extra):
    os.makedirs(DIST, exist_ok=True)
    head = '<title>Rückwärts-Rätsel</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="theme-color" content="#120F2B">\n' + FONTS
    scripts = ("<script>" + config_js(extra) + "</script>\n<script>" + words_js() + "</script>\n<script>" + read("app.js") + "</script>\n")
    open(os.path.join(DIST, name), "w", encoding="utf8").write(page(head, scripts))

if __name__ == "__main__":
    b = build_site()
    build_single("single.html", {"onlineDisabled": True, "ttsBases": [], "serviceWorker": False})
    build_single("apk-index.html", {"onlineDisabled": True, "serviceWorker": False, "ttsBases": ["https://cdn.jsdelivr.net/npm/mespeak/"]})
    print("built", b, "->", OUT)
