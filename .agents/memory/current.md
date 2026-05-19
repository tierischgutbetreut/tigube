# Aktueller Stand

## Letzte Änderungen
- **Produktions-Fix:** Fehlender Import `useToast` in `OwnerDashboardPage.tsx` ergänzt — behebt `ReferenceError: useToast is not defined` und das Abfangen des Owner-Dashboards durch die ErrorBoundary (nach Deploy auf Live prüfen).
- Design-System-Dokumente in `design-system-neutral/` ergänzt; Geocoding- und Fahrtkosten-Logik zuvor erweitert.

## Fokus
- Frontend-Stabilität und Smoke-Tests nach Deploy (Owner-Dashboard, Toasts beim Owner-Approval).
- Optional: esbuild-Warnungen zu doppelten Objekt-Keys `Hausbesuch` in `CaretakerDashboardPage.tsx` bereinigen.

## Nächste Schritte
- Statische Seiten/Baukasten-Anforderungen im Brainstorming schärfen, dann Plan und Umsetzung.
- Beim nächsten größeren Release ggf. Eintrag in `content_items` (Release) wie in Projekt-Doku beschrieben.

## Offene Punkte
- Umfang „Seiten-Baukasten“ (nur Layout vs. Content-Konfig) noch nicht final.
- Kein finaler „fertig“-Kriterienkatalog je statischer Seite.
