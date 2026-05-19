# Projekt: tigube v2

## Ziel
Eine vertrauenswürdige Haustierbetreuungsplattform für die Vermittlung zwischen Besitzern und Betreuern.
Nutzer sollen Betreuungsleistungen und Zubehör-Angebote einfach finden, vergleichen und verwalten können.

## Tech-Stack
- Frontend: React 18, TypeScript, Vite, React Router, Tailwind CSS.
- State/UI: Zustand, Headless UI, Lucide Icons.
- Backend: Supabase (PostgreSQL, Auth, Storage, Realtime), Stripe für Zahlungen.
- Tooling: ESLint, TypeScript Strict Mode, PostCSS.

## Architektur
- Seitenbasiertes Routing mit lazy geladenen Routen und deutschen URLs.
- Wiederverwendbare Komponentenstruktur (`components`, `pages`, `lib`, `hooks`, `contexts`).
- Business-Logik in Services, Datenzugriff über Supabase-Module.
- Marktplatz als eigener Funktionsbereich inkl. Terms-Seite und Admin-Moderation.

## Entscheidungen & Constraints
- TypeScript-first und funktionale React-Komponenten mit klaren Props-Interfaces.
- Mobile-first Design mit Tailwind Utilities statt viel Custom CSS.
- Sicherheitsfokus über Supabase RLS und rollenbasierte Berechtigungen.
- Konsistente Marken-Schreibweise „tigube“ in UI-/Rechtstexten.
