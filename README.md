# Rückwärts-Rätsel / Backwords

Ein Sprachspiel für zwei: Wort einsprechen, rückwärts anhören, rückwärts nachsprechen, die eigene Stimme umgedreht hören und das Wort erraten.

**Spielen:** https://ppaluma.github.io/rueckwaerts-raetsel/
Auf dem Handy öffnen und „Zum Startbildschirm hinzufügen“ bzw. „Installieren“ wählen, dann funktionieren auch die Benachrichtigungen.

## Spielmodi
- **Online-Duelle** wie bei Quizduell: Konto mit Benutzername + Passwort, beliebig viele Duelle gleichzeitig, 6 Runden mit je einem Wort pro Spieler, Benachrichtigung wenn du dran bist, zufällige Gegner, Revanche.
- **Auf einem Handy**: abwechselnd, Handy weitergeben, 6 Runden pro Spieler.
- Sprachen Deutsch und Englisch, je drei Schwierigkeitsstufen (Easy, Hard, Extreme) mit rund 1.000 Wörtern.

## Joker (jeder einmal pro Spiel)
- **KI spricht**: Statt der Aufnahme des Gegners hörst du eine Computerstimme rückwärts.
- **Nochmal einsprechen**: Der Gegner muss das Wort neu aufnehmen.
- **Buchstaben**: Zeigt Anfangsbuchstaben und Länge, z. B. `K _ _ _ _ _ _`.

## Aufbau
| Ordner | Inhalt |
|---|---|
| `src/` | App (HTML-Gerüst, CSS, JavaScript, Service Worker, Wortlisten) |
| `tools/build.py` | baut `site/` (Web-App) und `dist/` (Einzeldatei-Versionen) |
| `supabase/schema.sql` | Datenbank, Spielregeln und Rechte (im Supabase SQL Editor ausführen) |
| `supabase/functions/notify/` | Edge Function für Push-Benachrichtigungen |
| `config.json` | öffentliche Einstellungen (Supabase-URL, öffentlicher Schlüssel) |

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages. Dabei wird die KI-Stimme [meSpeak.js](https://www.masswerk.at/mespeak/) eingebunden.

Lokal bauen: `python3 tools/build.py`
