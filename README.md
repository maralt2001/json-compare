# Compare My JSON

Eine clientseitige Webanwendung zum Vergleichen von JSON-Daten. Keine Server-Komponente erforderlich - läuft vollständig im Browser.

![Compare My JSON Screenshot](/assets/CompareMyJson.png)

## Features

### JSON-Eingabe
- **Zwei Editoren** für JSON A und JSON B mit Syntax-Highlighting
- **Datei-Upload** per Button oder Drag & Drop
- **JSON formatieren** - formatiert einzelne JSONs mit Einrückung
- **Kopieren** des Inhalts in die Zwischenablage
- **Leeren** einzelner Textareas
- **Vollbild-Modus** für komplexere JSON-Strukturen
- **Aliase** für die JSON-Quellen (z.B. "Production", "Staging")
- **Beispieldaten** zum schnellen Testen

### JSON-Normalisierung
- **A ist Master** - sortiert B nach der Key-Reihenfolge von A
- **B ist Master** - sortiert A nach der Key-Reihenfolge von B
- **Alphabetisch** - sortiert beide JSONs alphabetisch nach Keys
- Erleichtert den visuellen Vergleich bei unterschiedlicher Key-Reihenfolge

### Property-Vorauswahl (Pre-Comparison Selection)
- **Properties scannen** extrahiert alle Felder aus beiden JSONs
- **Multi-Select Dropdown** zur Auswahl der zu vergleichenden Properties
- **Farbkodierung** zeigt Herkunft:
  - Cyan: in beiden JSONs vorhanden
  - Rot: nur in A
  - Grün: nur in B
- **Alle auswählen / Alle abwählen** für schnelle Selektion
- **Unbegrenzte Tiefe** - funktioniert mit beliebig verschachtelten Strukturen
- **Einrückung** visualisiert die Verschachtelungsebene
- **Array-Key-Auswahl** - manuelle Wahl des Vergleichs-Keys für Arrays (Auto, Index-basiert, oder spezifischer Key)

### Vergleich
- **Struktureller Vergleich** von JSON-Objekten
- **Array-Vergleich** nach Vorhandensein (nicht nach Position)
- **Rekursiver Vergleich** verschachtelter Objekte
- **Selektiver Vergleich** nur ausgewählter Properties
- **Drei Unterschiedstypen**:
  - Nur in A (rot)
  - Nur in B (grün)
  - Unterschiedliche Werte (cyan)

### Key-basierter Array-Vergleich

Bei Arrays von Objekten können ein oder mehrere Properties als **Identifier-Keys** definiert werden, um Objekte eindeutig zu identifizieren - unabhängig von ihrer Position im Array.

#### Vergleichs-Modi

| Modus | Beschreibung | Pfad-Format |
|-------|--------------|-------------|
| **Auto** | Automatische Key-Erkennung (id, name, etc.) | `array[key=value]` |
| **Index** | Position-basierter Vergleich | `array[0]`, `array[1]` |
| **Manuell** | Ein oder mehrere Keys auswählen | `array[key1=val1,key2=val2]` |

#### Composite Keys (Zusammengesetzte Schlüssel)

Wenn ein einzelner Key nicht eindeutig ist, können mehrere Keys kombiniert werden:

**Beispiel:** Eine Firma hat mehrere Mitarbeiter pro Abteilung. `abteilung` allein ist nicht eindeutig, aber `abteilung` + `name` zusammen identifiziert jeden Mitarbeiter.

**JSON A:**
```json
{
  "mitarbeiter": [
    { "abteilung": "IT", "name": "Müller", "gehalt": 4500, "aktiv": true },
    { "abteilung": "IT", "name": "Schmidt", "gehalt": 4200, "aktiv": true },
    { "abteilung": "HR", "name": "Weber", "gehalt": 3800, "aktiv": true }
  ]
}
```

**JSON B:**
```json
{
  "mitarbeiter": [
    { "abteilung": "IT", "name": "Müller", "gehalt": 4800, "aktiv": true },
    { "abteilung": "IT", "name": "Schmidt", "gehalt": 4200, "aktiv": false },
    { "abteilung": "HR", "name": "Fischer", "gehalt": 4000, "aktiv": true }
  ]
}
```

**Ergebnis mit Keys `abteilung` + `name`:**

| Pfad | Typ | A | B |
|------|-----|---|---|
| `mitarbeiter[abteilung=IT,name=Müller].gehalt` | geändert | 4500 | 4800 |
| `mitarbeiter[abteilung=IT,name=Schmidt].aktiv` | geändert | true | false |
| `mitarbeiter[abteilung=HR,name=Weber]` | nur in A | ✓ | - |
| `mitarbeiter[abteilung=HR,name=Fischer]` | nur in B | - | ✓ |

#### Key-Auswahl im UI

1. **Properties scannen** klicken
2. Beim Array (z.B. `permission`) auf den **Key-Button** klicken
3. **"Keys wählen"** auswählen und die gewünschten Keys aktivieren
4. Key-Properties werden mit 🔑 markiert und aus dem Vergleich ausgeschlossen (da sie zur Identifikation dienen, nicht zum Vergleich)

### Ergebnis-Anzeige
- **Auf-/zuklappbare** Unterschiede mit Datei-Icon und A/B-Kennzeichnung
- **Inline-Diff-Highlighting** - markiert Unterschiede direkt in den Editoren (Toggle per Klick)
- **Filter** nach Unterschiedstyp (Alle, Nur in A, Nur in B, Unterschiedlich)
- **Property-Filter** zum Suchen nach bestimmten Feldnamen
- **Counter** zeigen Anzahl pro Kategorie
- **Alle auf-/zuklappen** Button

### Export
- **Textdatei-Export** der Unterschiede
- Enthält Datum, Aliase und alle Unterschiede gruppiert nach Typ

## Verwendung

1. `compare.html` im Browser öffnen
2. JSON-Daten in die Textfelder eingeben oder Dateien laden
3. Optional: Aliase für die Quellen eingeben
4. Optional: "Properties scannen" klicken und gewünschte Properties auswählen
5. "A ⇄ B Vergleichen" klicken
6. Unterschiede analysieren, filtern und ggf. exportieren

### Workflow mit Property-Vorauswahl

```
JSON eingeben → Properties scannen → Properties auswählen → Vergleichen
```

Dies ist besonders nützlich bei großen JSONs, wenn nur bestimmte Felder relevant sind.

## Technologie

- Reines HTML, CSS und JavaScript
- Kein Node.js oder Build-Prozess erforderlich
- Dark Mode mit Cyan-Akzentfarbe (Tailwind-inspiriert)
- Responsive Design

## Dateien

- `compare.html` - HTML-Struktur
- `styles.css` - Styling (Dark Mode)
- `script.js` - Vergleichslogik und Interaktionen
