# Gottesdienst — die vorgemerkte Liedauswahl

Der Gottesdienst-Tab hält die zwei, drei Lieder einer Messe griffbereit, ohne dafür eine
Playlist anzulegen oder die Favoriten zu belasten. Er erscheint, sobald etwas vorgemerkt
ist, und verschwindet mit dem Tag wieder (Einstellungen → Gottesdienst → *Tab immer
anzeigen* pinnt ihn dauerhaft).

Siehe [Issue #37](https://github.com/johkirche/gb-app-pwa/issues/37). Der Ablauf ist
zugleich der Einstiegspunkt für den Gottesdienst-Modus aus
[#32](https://github.com/johkirche/gb-app-pwa/issues/32).

## Wo was liegt

| Datei | Rolle |
| --- | --- |
| `src/db/index.ts` | `ServicePlan`, `ServiceEntry`, `ServicePlanOrigin`; Dexie-Tabelle `services` (v7) |
| `src/services/servicePlans/plan.ts` | Reine Helfer: Datum ↔ Ablaufzeitpunkt, Formatierung, `createPlan` |
| `src/services/servicePlans/types.ts` | `ServicePlanProvider` — die Schnittstelle für fertige Abläufe |
| `src/services/servicePlans/providers.ts` | Registry und `collectServicePlanOffers()` |
| `src/services/servicePlans/playlistProvider.ts` | Referenz-Provider: die Playlists dieses Geräts |
| `src/stores/service.ts` | Der Store: vormerken, sortieren, übernehmen, ablaufen lassen |
| `src/views/ServicePage.vue` | Der Tab unter `/tabs/gottesdienst` |
| `src/components/service/` | Liste und Quellen-Panel |

## Zwei Wege zur Auswahl

1. **Lied für Lied** — über das Aktionsmenü in der Liederliste (langer Druck /
   Rechtsklick) oder im Lied selbst. Legt beim ersten Lied automatisch einen Plan für
   heute an.
2. **Fertigen Ablauf übernehmen** — aus einer Quelle, die einen `ServicePlanProvider`
   implementiert. Heute ist das nur „Aus einer Playlist"; der Knopf erscheint nur, wenn
   tatsächlich etwas angeboten wird.

## Ablauf und Aufräumen

Ein Plan hat ein Datum (`date`, ISO `yyyy-mm-dd`, lokal) und daraus abgeleitet
`expiresAt` — das Ende dieses Tages. Beides wird nur zusammen geändert
(`serviceStore.setDate`). Aufgeräumt wird beim Laden des Stores und immer, wenn die App
wieder in den Vordergrund kommt (`visibilitychange`) — ein Telefon, das über Nacht auf
dem Pult liegt, lädt die App nie neu.

## Eine Directus-Quelle ergänzen

Die Auswahl ist bewusst nicht an ihre Herkunft gebunden: ein im Backend veröffentlichter
Ablauf landet im selben Datensatz wie eine von Hand zusammengestellte Auswahl. Um das
Kirchenbüro als Quelle anzubieten, genügt ein weiterer Provider:

```ts
// src/services/servicePlans/directusProvider.ts
export const directusServicePlanProvider: ServicePlanProvider = {
    id: 'directus',
    label: 'Vom Kirchenbüro',
    description: 'Veröffentlichte Gottesdienstabläufe',

    // Darf nie werfen — offline heißt einfach: nichts im Angebot.
    async isAvailable() {
        return navigator.onLine && Boolean(directusConfig.url);
    },

    async listOffers() {
        // Nur Kopfdaten: Titel, Datum, Anzahl. Wird bei jedem Öffnen des Panels gerufen.
    },

    async loadOffer(offerId) {
        // Die Lieder auf lokale Song-Ids abbilden und alles verwerfen,
        // was auf diesem Gerät nicht existiert.
    },
};
```

Registriert wird er in `src/services/servicePlans/index.ts` neben dem Playlist-Provider.
Panel, Store und Seite greifen ihn von selbst auf — die übernommene Auswahl merkt sich in
`ServicePlan.origin`, aus welchem Angebot sie stammt, sodass sie sich später auch
auffrischen ließe.

Zwei Regeln, an die sich ein Provider halten muss:

- **Er spricht lokale Song-Ids.** Was das Backend als Liednummer, Titel oder eigene Id
  führt, bildet der Provider ab; was er nicht abbilden kann, lässt er weg. Die Seite
  weist Einträge ohne Lied auf diesem Gerät gesondert aus.
- **Er darf nicht im Weg stehen.** Ist er nicht erreichbar oder wirft er, fällt seine
  Gruppe im Panel still weg (`collectServicePlanOffers` fängt das ab). Die Lieder von
  Hand vorzumerken muss immer funktionieren, auch ohne Netz.
