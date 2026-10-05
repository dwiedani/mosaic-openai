# Mosaic OpenAI

Eine einfache Verbrauchsanzeige für **Codex mit ChatGPT-Abo**: Prozentbalken für jedes verfügbare Limit, etwa das 5-Stunden- und Wochenlimit. App und Widget verwenden dieselben Daten und aktualisieren sich jede Minute. Fehlende Limits werden nicht als 0 % dargestellt.

## Lokal starten

Voraussetzungen: Node.js >= 22.14, Mosaic als Nachbar-Repository `../Mosaic` und eine installierte Codex CLI mit ChatGPT-Anmeldung (`codex login`). Das SDK ist derzeit nur lokal verfügbar.

```sh
npm ci
npm start
```

Der lokale Verbrauchsdienst läuft auf `http://127.0.0.1:4311`. Er verwendet die vorhandene Codex-Anmeldung über den [offiziellen App Server](https://learn.chatgpt.com/docs/app-server), mit `initialize`, `initialized` und `account/rateLimits/read`. Er startet keine Modellanfragen. Zugangsdaten werden weder aus Dateien gelesen noch an den Browser übermittelt.

Falls `codex` nicht im PATH liegt:

```sh
MOSAIC_CODEX_BIN=/absoluter/pfad/zu/codex npm start
```

Mosaic läuft standardmäßig unter `http://127.0.0.1:4310` oder `http://localhost:4310`. Andere lokale Mosaic-Ursprünge können mit `MOSAIC_ALLOWED_ORIGINS` freigegeben werden (kommagetrennte vollständige Origins). Der Dienst ist ausschließlich an Loopback gebunden; der Browser und Codex müssen auf demselben Rechner laufen. Dies ist ein persönlicher lokaler Dienst für das dort angemeldete Codex-Konto; eine Nutzung als gemeinsames Backend für verschiedene Mosaic-Nutzer ist nicht vorgesehen.

## Build und Installation

```sh
npm run typecheck
npm test
npm run validate
npm run package
```

Der Mosaic-Builder erzeugt `dist/manifest.json`, Browser-Entrypoints sowie `release/mosaic-app.zip` und `release/checksums.json`. Für die Installation per Repository-Link müssen die beiden Release-Dateien als GitHub-Release-Assets veröffentlicht werden. Repository: `https://github.com/dwiedani/mosaic-openai`.

Nach der Installation die App **OpenAI** aktivieren und das Widget **OpenAI-Verbrauch** zum Dashboard hinzufügen. Unterstützt werden Small, Medium und Large sowie die Themes Cloud und Pixel. Die App und das große Widget zeigen zusätzlich Rücksetzzeiten und eine manuelle Aktualisierung. Der Verbrauchsdienst muss separat mit `npm start` laufen; der Mosaic-Browser-Builder startet keine Backend-Prozesse.

## Anzeige und Grenzen

- Prozentwerte bedeuten **verbraucht**, nicht verbleibend. Zeitfenster werden anhand ihrer tatsächlichen Dauer beschriftet, nicht anhand ihrer Position in der API-Antwort.
- Alle vom Konto gemeldeten Limitgruppen werden angezeigt; die aktuelle Mehrgruppen-Antwort hat Vorrang vor der älteren Einzelgruppe.
- Erfolgreiche Abfragen werden 60 Sekunden zwischengespeichert; parallele Anfragen teilen sich denselben Abruf.
- Rücksetzzeiten erscheinen in der Zeitzone des Browsers. Abgelaufene Zeitfenster werden als „Rücksetzung ausstehend“ markiert, bis neue Serverwerte vorliegen.
- Die Anzeige betrifft die von Codex bereitgestellten Abo-Limits. Allgemeine ChatGPT-Nachrichtenlimits und OpenAI-API-Ausgaben gehören nicht zu dieser Schnittstelle.
- Fehlende Anmeldung, nicht erreichbarer Dienst und ungültige Daten erscheinen als Fehler mit Wiederholungsaktion.

Die Tests prüfen Normalisierung, fehlende/ungültige Limits, Mehrgruppen-Antworten, RPC-Handshake, Timeout, Fehlerbehandlung, CORS-/Host-Schutz und den gemeinsamen Servercache.
