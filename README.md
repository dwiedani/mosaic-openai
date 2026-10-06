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

Mosaic verwendet die vorhandene Codex-Anmeldung über den [offiziellen App Server](https://learn.chatgpt.com/docs/app-server), mit `initialize`, `initialized` und `account/rateLimits/read`. Es werden keine Modellanfragen gestartet. Zugangsdaten werden weder aus Dateien gelesen noch an den Browser übermittelt.

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
- Small, Medium und Large sowie Cloud und Pixel werden unterstützt. Die App und das große Widget zeigen zusätzlich Rücksetzzeiten und eine manuelle Aktualisierung.
- Die Anzeige betrifft Codex-Abo-Limits. Allgemeine ChatGPT-Nachrichtenlimits und OpenAI-API-Ausgaben gehören nicht zu dieser Schnittstelle.
- Fehlendes Codex, fehlende Host-Anmeldung und Service-Probleme zeigen Einrichtungshinweise mit Wiederholungsaktion.
- Ein einzelner Client-Abbruch beendet nicht den gemeinsam genutzten Abruf. Ein Service-Stop bricht den Abruf ab und wartet auf die Beendigung des Codex-Prozesses. Das Abruflimit liegt unter Mosaics Standard-RPC-Zeitlimit.

## Migration von 0.0.1

Nach dem Update übernimmt Mosaic den Service-Start. Einen noch laufenden separaten Dienst auf Port 4311 beenden. Die nur dafür eingerichtete Freigabe `http://127.0.0.1:4311` kann aus Mosaics `.mosaic/connect-origins.json` oder `MOSAIC_CONNECT_ORIGINS` entfernt werden. Andere Freigaben erhalten. Anschließend die Mosaic-Browserseite neu laden.

## Provider-neutrale Mosaic AI

Die App kann zusätzlich einen Provider `openai` für `mosaic.ai` registrieren. Nur diese Provider-App kennt den OpenAI-Transport; konsumierende Apps importieren ausschließlich Mosaic SDK. Die bestehende App-ID `openai` bleibt erhalten. Im Mosaic-Server verweist `MOSAIC_SERVICE_CONFIGURATION_FILE` auf lokale Konfiguration nach App-ID: `{"openai":{"apiKey":"…","model":"…","embeddingModel":"…"}}`. Zugangsdaten bleiben serverseitig und werden nicht in UI-/Registryantworten ausgegeben. Ohne Key/Modell erfolgt keine AI-Registrierung; die Verbrauchsfunktion bleibt nutzbar. Embeddings werden nur bei konfiguriertem Embedding-Modell angeboten. Die Modelle müssen die jeweiligen Capabilities unterstützen.

Der Provider unterstützt Textgenerierung, JSON-Schema-Ausgaben, Klassifikation und optional Embeddings. Responses verwenden `store: false`, keine Tools und keine autonomen Aktionen. Ergebnisse sind AI-abgeleitet und werden durch Mosaic/App-Schemas geprüft. Providerauswahl erfolgt in Mosaic-Einstellungen. Tests verwenden Mock-HTTP; Live-Inferenz wurde ohne konfigurierte Zugangsdaten nicht ausgeführt.
