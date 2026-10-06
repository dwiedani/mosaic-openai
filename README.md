# Mosaic OpenAI

Eine einfache Verbrauchsanzeige für **Codex mit ChatGPT-Abo**: Prozentbalken für jedes verfügbare Limit, etwa das 5-Stunden- und Wochenlimit. App und Widget verwenden dieselben Daten und aktualisieren sich jede Minute. Fehlende Limits werden nicht als 0 % dargestellt.

## Installation in Mosaic

Voraussetzung ist ein Mosaic-Stand mit **Service-Runtime** und `service.call(appId, method, input)` im SDK. Ältere Mosaic-Versionen unterstützen das Service-Manifest nicht.

Die Release-Dateien `mosaic-app.zip` und `checksums.json` als GitHub-Release-Assets veröffentlichen. Dann in Mosaic das Repository `https://github.com/dwiedani/mosaic-openai` installieren beziehungsweise aktualisieren, die App **OpenAI** aktivieren und das Widget **OpenAI-Verbrauch** hinzufügen.

Mosaic startet den mitgelieferten Node-Service automatisch. Ein separates `npm start` für diese App, Port 4311 und CORS-/CSP-Freigaben sind ab Version 0.0.2 nicht mehr erforderlich.

## Codex auf dem Mosaic-Host

Codex muss auf dem Rechner installiert sein, auf dem **der Mosaic-Server** läuft. Dort unter dem Betriebssystemkonto, das Mosaic startet, mit einem ChatGPT-Abo anmelden:

```sh
codex login
```

Mosaic verwendet die vorhandene Codex-Anmeldung über den [offiziellen App Server](https://learn.chatgpt.com/docs/app-server), mit `initialize`, `initialized` und `account/rateLimits/read`. Die Verbrauchsanzeige startet keine Modellanfragen. Explizite Aufrufe über `mosaic.ai` nutzen ab 0.0.4 zusätzlich den Codex-AI-Provider. Zugangsdaten werden weder aus Dateien gelesen noch an den Browser übermittelt.

Der Service sucht automatisch nach `codex` im PATH des Mosaic-Prozesses. Auf macOS erkennt er zusätzlich die gebündelte Codex-Datei in `ChatGPT.app` unter `/Applications` und `~/Applications`. Für diese Installation ist `MOSAIC_CODEX_BIN` nicht erforderlich.

Für andere Installationsorte kann **Mosaic** mit einem expliziten Pfad gestartet werden. Dieser hat Vorrang vor der automatischen Erkennung:

```sh
MOSAIC_CODEX_BIN=/absoluter/pfad/zu/codex npm start
```

Der gebündelte Pfad auf diesem macOS-Installationstyp lautet `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`. In Containern muss Codex innerhalb des Containers vorhanden sein.

Alternativ kann der Host über `ServerOptions.serviceConfiguration.openai.codexBin` einen serverseitigen Pfad injizieren. Der normale Mosaic-Start liest diese Service-Konfiguration derzeit nicht aus einer Datei; die Umgebungsvariable ist daher der einfache Weg.

## Gehosteter Betrieb

```text
Client-Browser → Mosaic-Service-Gateway mit Session-Auth
               → OpenAI-Node-Service im Mosaic-Server
               → codex app-server auf dem Host (stdin/stdout)
```

Clients benötigen nur ihren Browser; Codex ist dort nicht erforderlich. Das SDK verwendet den Mosaic-Ursprung, sodass die Anzeige auch auf anderen Rechnern und über HTTPS funktioniert. Mosaic prüft Anmeldung sowie Plattform- und Benutzeraktivierung der Ziel-App.

Die Prozentwerte betreffen das **auf dem Host angemeldete Codex-Konto**. Alle Mosaic-Nutzer mit Zugriff auf die aktivierte OpenAI-App sehen dieselben Kontolimits. Eine persönliche Codex-Anmeldung je Mosaic-Nutzer ist nicht implementiert.

## Entwicklung und Release

Voraussetzungen: Node.js >= 22.14 und Mosaic als Nachbar-Repository `../Mosaic`. Das SDK ist derzeit nur lokal verfügbar.

```sh
npm ci
npm run typecheck
npm test
npm run validate
npm run package
```

Der Mosaic-Builder erzeugt Browser-Entrypoints, `service.bundle.js`, `dist/manifest.json` sowie `release/mosaic-app.zip` und `release/checksums.json`. Das Service-Bundle ist selbstständig und wird von Mosaic nicht als Browser-Asset ausgeliefert. App- und Widget-IDs bleiben kompatibel mit 0.0.1; vorhandene Widget-Instanzen können weiterverwendet werden.

## Anzeige und Grenzen

- Prozentwerte bedeuten **verbraucht**, nicht verbleibend. Zeitfenster werden anhand ihrer tatsächlichen Dauer beschriftet.
- Alle vom Konto gemeldeten Limitgruppen werden angezeigt; Mehrgruppen-Antworten haben Vorrang vor der älteren Einzelgruppe.
- Erfolgreiche Abrufe werden hostweit 60 Sekunden zwischengespeichert. Parallele Client-Anfragen teilen sich denselben Abruf. Fehler werden nicht gecacht.
- Rücksetzzeiten erscheinen in der Zeitzone des Browsers. Abgelaufene Zeitfenster bleiben als „Rücksetzung ausstehend“ markiert, bis neue Serverwerte vorliegen.
- Small, Medium und Large sowie Cloud, Pixel und Flat werden unterstützt. Die App und das große Widget zeigen zusätzlich Rücksetzzeiten und eine manuelle Aktualisierung.
- Die Anzeige betrifft Codex-Abo-Limits. Allgemeine ChatGPT-Nachrichtenlimits und OpenAI-API-Ausgaben gehören nicht zu dieser Schnittstelle.
- Fehlendes Codex, fehlende Host-Anmeldung und Service-Probleme zeigen Einrichtungshinweise mit Wiederholungsaktion.
- Ein einzelner Client-Abbruch beendet nicht den gemeinsam genutzten Abruf. Ein Service-Stop bricht den Abruf ab und wartet auf die Beendigung des Codex-Prozesses. Das Abruflimit liegt unter Mosaics Standard-RPC-Zeitlimit.

## Migration von 0.0.1

Nach dem Update übernimmt Mosaic den Service-Start. Einen noch laufenden separaten Dienst auf Port 4311 beenden. Die nur dafür eingerichtete Freigabe `http://127.0.0.1:4311` kann aus Mosaics `.mosaic/connect-origins.json` oder `MOSAIC_CONNECT_ORIGINS` entfernt werden. Andere Freigaben erhalten. Anschließend die Mosaic-Browserseite neu laden.

## Provider-neutrale Mosaic AI

Ab 0.0.4 registriert die App den Provider **`codex`**, wenn Codex auf dem Mosaic-Host vorhanden und mit ChatGPT angemeldet ist. Ein OpenAI-API-Key ist dafür nicht erforderlich. `MOSAIC_CODEX_BIN` oder die automatische macOS-Erkennung gelten für Verbrauch und AI gleichermaßen:

```sh
MOSAIC_CODEX_BIN="/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex" npm start
```

Nach Installation oder Aktualisierung der OpenAI-App erscheint `codex` in Mosaics AI-Einstellungen. Der Provider unterstützt Textgenerierung, JSON-Schema-Ausgaben und Klassifikation. Embeddings werden nicht angeboten. Das Modell kommt aus der Codex-Host-Konfiguration; optional kann `MOSAIC_SERVICE_CONFIGURATION_FILE` die App-Konfiguration `{"openai":{"codexModel":"<Modell-ID>"}}` liefern. Nach einer späteren Host-Anmeldung den App-Service oder Mosaic neu starten, damit die Registrierung erneut geprüft wird. Alle berechtigten Mosaic-Nutzer verwenden das Codex-Konto des Hosts und dessen Limits.

Jede Anfrage verwendet einen eigenen temporären Arbeitsordner und einen ephemeren App-Server-Thread mit Read-only-Sandbox. Shell, Code Mode, Apps, Hooks, Websuche und Multi-Agent-Tools werden deaktiviert; konfigurierte MCP-Server und Plugins werden für den Thread deaktiviert. Interaktions-/Tool-Anfragen werden abgelehnt. Der Adapter beendet Prozesse bei Erfolg, Fehler, Timeout, Client-Abbruch und Service-Stop und entfernt den temporären Ordner. Er verwendet nur den übergebenen Prompt und Context-EntityRefs; EntityRefs enthalten keine automatisch aufgelösten Dateiinhalte.

Optional bleibt der separate API-Provider `openai` verfügbar. Im Mosaic-Server verweist `MOSAIC_SERVICE_CONFIGURATION_FILE` auf `{"openai":{"apiKey":"…","model":"…","embeddingModel":"…"}}`. Nur dieser Transport benötigt einen API-Key. Embeddings werden nur mit konfiguriertem Embedding-Modell angeboten. Responses verwenden `store: false` und keine Tools. Zugangsdaten bleiben serverseitig. Die bestehende App-ID `openai` bleibt erhalten; konsumierende Apps verwenden ausschließlich das Mosaic SDK. Die Provider-Auswahl erfolgt zentral pro Capability.

Ergebnisse bleiben AI-abgeleitet und werden durch Mosaic/App-Schemas geprüft. Tests verwenden Mock-HTTP und einen Fake-Codex-App-Server; reale Textgenerierung, strukturierte Ausgabe und Klassifikation wurden zusätzlich mit der vorhandenen ChatGPT-Host-Anmeldung geprüft.
