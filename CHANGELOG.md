# Changelog

## 0.0.3

- Optionaler OpenAI-Provider für Mosaics provider-neutrale AI Runtime: Textgenerierung, strukturierte JSON-Schema-Ausgaben, Klassifikation und konfigurierbare Embeddings.
- Serverseitige Provider-Konfiguration; die Verbrauchsanzeige bleibt auch ohne AI-Konfiguration nutzbar.
- Automatische Erkennung der gebündelten Codex-Datei in ChatGPT.app auf macOS; explizite Host-Konfiguration hat Vorrang.
- Unterstützung des Flat Themes über die bestehenden SDK-Komponenten.

## 0.0.2

- OpenAI-Service läuft automatisch in Mosaics Service-Runtime; Browser nutzen das authentifizierte SDK-Gateway.
- Keine separate App-Startanweisung, kein Port 4311 und keine CORS-/CSP-Freigabe mehr nötig.
- Hostweiter 60-Sekunden-Cache und Abbruch/Prozess-Cleanup bei Service-Stop.
- Verständliche Einrichtungshinweise bei fehlendem Codex oder fehlender Host-Anmeldung.

## 0.0.1

- Mosaic-App mit OpenAI-Verbrauchs-Widget in Small, Medium und Large.
- Prozentbalken für verfügbare Codex-Abo-Limits und Rücksetzzeiten in der App.
- Lokaler Dienst über die dokumentierte Codex-App-Server-Schnittstelle; automatische Aktualisierung jede Minute.
