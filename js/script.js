document.addEventListener('DOMContentLoaded', function() {
    const jsonATextarea = document.getElementById('jsonA');
    const jsonBTextarea = document.getElementById('jsonB');
    const diffResult = document.getElementById('diffResult');
    const compareBtn = document.getElementById('compareBtn');
    const formatBtns = document.querySelectorAll('.format-btn');
    const toggleAllBtn = document.getElementById('toggleAllBtn');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const fileA = document.getElementById('fileA');
    const fileB = document.getElementById('fileB');
    const exportBtn = document.getElementById('exportBtn');
    const exampleBtn = document.getElementById('exampleBtn');
    const highlightA = document.getElementById('highlightA');
    const highlightB = document.getElementById('highlightB');
    const clearSingleBtns = document.querySelectorAll('.clear-single-btn');
    const expandBtns = document.querySelectorAll('.expand-btn');
    const copyBtns = document.querySelectorAll('.copy-btn');
    const aliasA = document.getElementById('aliasA');
    const aliasB = document.getElementById('aliasB');
    const propertyFilter = document.getElementById('propertyFilter');
    const scanPropsBtn = document.getElementById('scanPropsBtn');
    const propSelectorBtn = document.getElementById('propSelectorBtn');
    const propSelectorDropdown = document.getElementById('propSelectorDropdown');
    const propSelectorList = document.getElementById('propSelectorList');
    const selectAllProps = document.getElementById('selectAllProps');
    const deselectAllProps = document.getElementById('deselectAllProps');
    const normalizeBtn = document.getElementById('normalizeBtn');
    const normalizeDropdown = document.getElementById('normalizeDropdown');
    const normalizeOptions = document.querySelectorAll('.normalize-option');
    const lineNumbersA = document.getElementById('lineNumbersA');
    const lineNumbersB = document.getElementById('lineNumbersB');

    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    const CONFIG = {
        COPY_FEEDBACK_MS: 1500,
        PRIORITY_KEYS: ['id', 'name', 'vorname', 'key', '_id', 'uuid'],
        DRAG_EVENTS: ['dragenter', 'dragover', 'dragleave', 'drop']
    };

    // ========================================================================
    // STATE VARIABLES
    // ========================================================================

    // UI State
    let allCollapsed = false;
    let currentFilter = 'all';

    // Filter State
    let propertyFilterValue = '';
    let selectedProperties = null; // null = alle vergleichen

    // Comparison Data
    let lastDifferences = [];
    let allScannedProperties = []; // alle gescannten Properties mit Herkunft

    // Array Key Handling
    let manualArrayKeys = new Map();   // path -> { mode: 'auto'|'manual'|'none', key: string|null }
    let arrayKeyOptions = new Map();   // path -> Set<string>

    // Inline Diff Highlighting
    let diffHighlightsA = [];  // Array von { start, end } für Inline-Diff in JSON A
    let diffHighlightsB = [];  // Array von { start, end } für Inline-Diff in JSON B
    let highlightedPaths = new Set();  // Aktuell hervorgehobene Pfade (für Toggle)

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Clears all diff highlights from both editors.
     */
    function clearDiffHighlights() {
        diffHighlightsA = [];
        diffHighlightsB = [];
        highlightedPaths = new Set();
        updateHighlight(jsonATextarea, highlightA, lineNumbersA);
        updateHighlight(jsonBTextarea, highlightB, lineNumbersB);
    }

    /**
     * Classifies differences by type.
     * @param {Array} diffs - Array of difference objects
     * @returns {Object} Object with removed, added, changed arrays
     */
    function classifyDifferences(diffs) {
        return {
            removed: diffs.filter(d => d.type === 'removed'),
            added: diffs.filter(d => d.type === 'added'),
            changed: diffs.filter(d => d.type === 'changed')
        };
    }

    /**
     * Finds keys that exist in all objects of an array.
     * @param {Array} objects - Array of objects to analyze
     * @returns {Set} Set of common keys
     */
    function findCommonKeysInObjects(objects) {
        if (objects.length === 0) return new Set();
        return objects.reduce((common, obj) => {
            const objKeys = Object.keys(obj);
            return common === null ? new Set(objKeys) : new Set([...common].filter(k => objKeys.includes(k)));
        }, null) || new Set();
    }

    /**
     * Gets the CSS class for a property based on its source.
     * @param {Object} prop - Property object with inA and inB flags
     * @returns {string} CSS class name
     */
    function getPropertySourceClass(prop) {
        if (prop.inA && prop.inB) return 'prop-both';
        if (prop.inA) return 'prop-only-a';
        return 'prop-only-b';
    }

    /**
     * Resets all filter buttons to default state.
     */
    function resetFilterButtons() {
        filterButtons.forEach(btn => {
            const filter = btn.dataset.filter;
            btn.classList.toggle('active', filter === 'all');
            const label = btn.textContent.split(' (')[0];
            btn.innerHTML = `${label} <span class="filter-count">(0)</span>`;
        });
    }

    /**
     * Skips whitespace characters starting from a position.
     * @param {string} text - Text to scan
     * @param {number} pos - Starting position
     * @returns {number} Position after whitespace
     */
    function skipWhitespace(text, pos) {
        while (pos < text.length && /\s/.test(text[pos])) pos++;
        return pos;
    }

    /**
     * Shows copy feedback on a button.
     * @param {HTMLElement} btn - Button element
     */
    function showCopyFeedback(btn) {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), CONFIG.COPY_FEEDBACK_MS);
    }

    /**
     * Updates filter button counts based on differences.
     * @param {Array} differences - Array of difference objects
     */
    function updateFilterCounts(differences) {
        const classified = classifyDifferences(differences);
        const counts = {
            all: differences.length,
            added: classified.added.length,
            removed: classified.removed.length,
            changed: classified.changed.length
        };

        filterButtons.forEach(btn => {
            const filter = btn.dataset.filter;
            const count = counts[filter];
            btn.classList.toggle('active', filter === 'all');
            btn.innerHTML = `${btn.textContent.split(' (')[0]} <span class="filter-count">(${count})</span>`;
        });
    }

    /**
     * Sortiert ein Objekt alphabetisch nach Keys (rekursiv).
     *
     * @param {*} obj - Das zu sortierende Objekt/Array/Wert
     * @returns {*} Das sortierte Objekt
     */
    function normalizeAlphabetically(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => normalizeAlphabetically(item));
        }

        const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
        const result = {};
        for (const key of sortedKeys) {
            result[key] = normalizeAlphabetically(obj[key]);
        }
        return result;
    }

    /**
     * Sortiert ein Objekt nach der Key-Reihenfolge eines Master-Objekts (rekursiv).
     * Keys die nur im Ziel existieren, werden am Ende alphabetisch angehängt.
     *
     * @param {*} obj - Das zu sortierende Objekt
     * @param {*} master - Das Master-Objekt für die Reihenfolge
     * @returns {*} Das sortierte Objekt
     */
    function normalizeByMaster(obj, master) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            // Bei Arrays: Jedes Element nach dem entsprechenden Master-Element sortieren
            return obj.map((item, index) => {
                const masterItem = Array.isArray(master) && master[index] !== undefined
                    ? master[index]
                    : (Array.isArray(master) && master[0] !== undefined ? master[0] : null);
                return normalizeByMaster(item, masterItem);
            });
        }

        if (master === null || typeof master !== 'object' || Array.isArray(master)) {
            // Kein passendes Master-Objekt - alphabetisch sortieren
            return normalizeAlphabetically(obj);
        }

        const result = {};
        const objKeys = new Set(Object.keys(obj));
        const masterKeys = Object.keys(master);

        // Zuerst Keys in Master-Reihenfolge
        for (const key of masterKeys) {
            if (objKeys.has(key)) {
                result[key] = normalizeByMaster(obj[key], master[key]);
                objKeys.delete(key);
            }
        }

        // Dann verbleibende Keys alphabetisch
        const remainingKeys = [...objKeys].sort((a, b) => a.localeCompare(b));
        for (const key of remainingKeys) {
            result[key] = normalizeAlphabetically(obj[key]);
        }

        return result;
    }

    /**
     * Creates a diff line element for displaying a single difference.
     * @param {Object} diff - Difference object with type, path, valueA, valueB
     * @param {string} nameA - Display name for JSON A
     * @param {string} nameB - Display name for JSON B
     * @returns {HTMLElement} The diff line element
     */
    function createDiffLineElement(diff, nameA, nameB) {
        const line = document.createElement('div');
        line.className = 'diff-line collapsed';

        const fileIcon = `<svg class="diff-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

        let icon, hint;
        switch (diff.type) {
            case 'added':
                line.classList.add('diff-added');
                icon = `<span class="diff-icon-badge">${fileIcon}<span class="diff-icon-letter">B</span></span>`;
                hint = `(nur in ${nameB})`;
                break;
            case 'removed':
                line.classList.add('diff-removed');
                icon = `<span class="diff-icon-badge">${fileIcon}<span class="diff-icon-letter">A</span></span>`;
                hint = `(nur in ${nameA})`;
                break;
            case 'changed':
                line.classList.add('diff-changed');
                icon = '~';
                hint = '';
                break;
        }

        // Show-Button nur für "changed" Unterschiede
        const showBtn = diff.type === 'changed'
            ? `<button class="diff-show-btn" title="Im Editor anzeigen">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                       <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                       <circle cx="12" cy="12" r="3"></circle>
                   </svg>
               </button>`
            : '';

        line.innerHTML = `
            <div class="diff-header">
                <span class="diff-toggle"></span>
                <span class="diff-path">${icon} ${diff.path}</span>
                ${hint ? `<span class="diff-hint">${hint}</span>` : ''}
                ${showBtn}
            </div>
            <div class="diff-compare">
                <div class="diff-side side-a">
                    <span class="diff-label">${nameA}</span>
                    <span class="diff-value">${diff.type === 'added' ? '<span class="empty">—</span>' : formatValue(diff.valueA)}</span>
                </div>
                <div class="diff-side side-b">
                    <span class="diff-label">${nameB}</span>
                    <span class="diff-value">${diff.type === 'removed' ? '<span class="empty">—</span>' : formatValue(diff.valueB)}</span>
                </div>
            </div>
        `;

        // Event listeners
        const header = line.querySelector('.diff-header');
        header.addEventListener('click', (e) => {
            if (e.target.closest('.diff-show-btn')) return;
            line.classList.toggle('collapsed');
        });

        const showBtnEl = line.querySelector('.diff-show-btn');
        if (showBtnEl) {
            showBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                highlightDifferenceInEditors(diff, showBtnEl);
            });
        }

        return line;
    }

    fileA.addEventListener('change', (e) => handleFileSelect(e.target.files[0], jsonATextarea));
    fileB.addEventListener('change', (e) => handleFileSelect(e.target.files[0], jsonBTextarea));

    clearSingleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const textarea = document.getElementById(targetId);
            const highlight = targetId === 'jsonA' ? highlightA : highlightB;
            const lineNumbers = targetId === 'jsonA' ? lineNumbersA : lineNumbersB;
            textarea.value = '';
            updateHighlight(textarea, highlight, lineNumbers);
            resetDiffState();
            resetPropertySelector();
        });
    });

    function resetDiffState() {
        diffResult.innerHTML = '';
        lastDifferences = [];
        diffHighlightsA = [];
        diffHighlightsB = [];
        highlightedPaths = new Set();
        allCollapsed = true;
        toggleAllBtn.innerHTML = '<span class="styled-btn-inner">Alle aufklappen</span>';
        currentFilter = 'all';
        propertyFilterValue = '';
        propertyFilter.value = '';
        resetFilterButtons();
    }

    /* ========================================================================
     * PROPERTY PRE-SELECTION (Vorauswahl)
     * ========================================================================
     *
     * Ermöglicht dem Benutzer, vor dem Vergleich auszuwählen, welche
     * Properties verglichen werden sollen.
     *
     * ARCHITEKTUR:
     * ────────────────────────────────────────────────────────────────────────
     *
     * 1. SCANNEN (extractAllProperties, scanProperties)
     *    - Extrahiert alle Property-Pfade aus beiden JSONs
     *    - Speichert Herkunft: nur in A, nur in B, oder in beiden
     *    - Pfade ohne Array-Indizes (z.B. "results.user.email")
     *
     * 2. BAUM-DARSTELLUNG (buildPropertyTree, renderTreeLevel)
     *    - Wandelt flache Pfad-Liste in hierarchischen Baum
     *    - Aufklappbare Ebenen mit Pfeilen
     *    - Checkboxen für Auswahl
     *
     * 3. AUSWAHL-LOGIK (isPropertySelected, hasSelectedChildren, shouldProcessProperty)
     *    - isPropertySelected: Prüft ob Pfad ausgewählt (für Ergebnis-Meldung)
     *    - hasSelectedChildren: Prüft ob Kind-Pfade ausgewählt (für Traversierung)
     *    - shouldProcessProperty: Kombiniert beide (für Entscheidung ob durchlaufen)
     *
     * 4. VERGLEICH (findDifferences, compareArrays)
     *    - Nutzt die Auswahl-Funktionen
     *    - Traversiert auch nicht-ausgewählte Eltern wenn Kinder ausgewählt sind
     *    - Meldet nur ausgewählte Properties als Unterschiede
     *
     * WICHTIG: Array-Indizes
     * ────────────────────────────────────────────────────────────────────────
     * - Beim Scannen: Pfade OHNE Index (z.B. "results.user.email")
     * - Beim Vergleich: Pfade MIT Index (z.B. "results[0].user.email")
     * - isPropertySelected normalisiert Pfade (entfernt [0], [1], etc.)
     *
     * ======================================================================== */

    function resetPropertySelector() {
        selectedProperties = null;
        allScannedProperties = [];
        manualArrayKeys = new Map();
        arrayKeyOptions = new Map();
        propSelectorBtn.disabled = true;
        propSelectorBtn.querySelector('.prop-selector-text').textContent = 'Properties auswählen';
        propSelectorList.innerHTML = '';
        propSelectorDropdown.classList.remove('open');
    }

    /**
     * Extrahiert alle Property-Pfade aus einem JSON-Objekt (rekursiv).
     *
     * Beispiel-Input:  { user: { name: "Max", email: "max@example.com" }, active: true }
     * Beispiel-Output: ["user", "user.name", "user.email", "active"]
     *
     * Bei Arrays werden die Pfade OHNE Index extrahiert, da die Auswahl
     * für alle Array-Elemente gelten soll (z.B. "results.user.email" statt "results[0].user.email").
     *
     * @param {Object} obj - Das zu scannende JSON-Objekt
     * @param {string} path - Aktueller Pfad-Prefix (für Rekursion)
     * @param {string} source - Herkunft: 'A', 'B' oder 'both'
     * @returns {Array} Liste von {path, source} Objekten
     */
    function extractAllProperties(obj, path = '', source = 'both') {
        const properties = [];

        if (obj === null || typeof obj !== 'object') {
            return properties;
        }

        // Bei Arrays: Durchlaufe Elemente, aber behalte den Array-Pfad (ohne Index)
        if (Array.isArray(obj)) {
            obj.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    properties.push(...extractAllProperties(item, path, source));
                }
            });
            return properties;
        }

        // Bei Objekten: Füge jeden Key als Property hinzu und gehe rekursiv tiefer
        for (const key of Object.keys(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            properties.push({ path: currentPath, source });

            const value = obj[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Verschachteltes Objekt: rekursiv weitermachen
                properties.push(...extractAllProperties(value, currentPath, source));
            } else if (Array.isArray(value)) {
                // Array: Elemente durchlaufen (Pfad bleibt ohne Index)
                value.forEach((item) => {
                    if (typeof item === 'object' && item !== null) {
                        properties.push(...extractAllProperties(item, currentPath, source));
                    }
                });
            }
        }

        return properties;
    }

    /**
     * Ermittelt geeignete Keys für ein Array von Objekten.
     * Ein Key ist geeignet wenn er in allen Objekten vorkommt und primitive Werte hat.
     *
     * @param {Array} arr - Das Array von Objekten
     * @returns {Set<string>} Menge der verfügbaren Keys
     */
    function findAvailableArrayKeys(arr) {
        const availableKeys = new Set();

        // Nur Objekte betrachten
        const objects = arr.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        if (objects.length === 0) return availableKeys;

        // Finde Keys die in ALLEN Objekten vorkommen
        const keysInAll = objects.reduce((common, obj) => {
            const objKeys = Object.keys(obj);
            return common === null ? new Set(objKeys) : new Set([...common].filter(k => objKeys.includes(k)));
        }, null) || new Set();

        // Filtere auf Keys mit primitiven Werten
        for (const key of keysInAll) {
            const allPrimitive = objects.every(obj => {
                const value = obj[key];
                return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
            });
            if (allPrimitive) {
                availableKeys.add(key);
            }
        }

        return availableKeys;
    }

    /**
     * Durchsucht ein JSON-Objekt rekursiv nach Arrays und sammelt verfügbare Keys.
     *
     * @param {Object} obj - Das zu durchsuchende Objekt
     * @param {string} path - Aktueller Pfad
     * @param {Map} keyOptionsMap - Map zum Speichern der Keys (path -> Set<string>)
     */
    function collectArrayKeyOptions(obj, path, keyOptionsMap) {
        if (obj === null || typeof obj !== 'object') return;

        if (Array.isArray(obj)) {
            // Prüfe ob Array Objekte enthält
            const hasObjects = obj.some(item => typeof item === 'object' && item !== null && !Array.isArray(item));
            if (hasObjects) {
                const availableKeys = findAvailableArrayKeys(obj);
                if (availableKeys.size > 0) {
                    // Merge mit existierenden Keys (falls bereits von anderem JSON gescannt)
                    const existing = keyOptionsMap.get(path) || new Set();
                    availableKeys.forEach(k => existing.add(k));
                    keyOptionsMap.set(path, existing);
                }
            }
            // Rekursiv in Array-Elemente
            obj.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    collectArrayKeyOptions(item, path, keyOptionsMap);
                }
            });
        } else {
            // Objekt: Jeden Key durchgehen
            for (const key of Object.keys(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                const value = obj[key];
                if (typeof value === 'object' && value !== null) {
                    collectArrayKeyOptions(value, currentPath, keyOptionsMap);
                }
            }
        }
    }

    /**
     * Entfernt einen Key aus der Auswahl, wenn das zugehörige Property abgewählt wurde.
     *
     * @param {string} propPath - Der Pfad des abgewählten Properties (z.B. "permission.domain")
     */
    function removeKeyIfDeselected(propPath) {
        const parts = propPath.split('.');
        if (parts.length < 2) return;

        const keyName = parts.pop();
        const arrayPath = parts.join('.');

        const setting = manualArrayKeys.get(arrayPath);
        if (setting && setting.mode === 'manual' && setting.keys) {
            const newKeys = setting.keys.filter(k => k !== keyName);
            if (newKeys.length > 0) {
                manualArrayKeys.set(arrayPath, { mode: 'manual', keys: newKeys });
            } else {
                manualArrayKeys.delete(arrayPath);
            }
        }
    }

    /**
     * Aktualisiert alle Key-Dropdowns basierend auf den ausgewählten Properties.
     * Deaktiviert Checkboxen für nicht ausgewählte Properties.
     */
    function updateAllKeyDropdowns() {
        document.querySelectorAll('.array-key-checkbox-label').forEach(label => {
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (!checkbox) return;

            const keyName = checkbox.value;
            const dropdown = label.closest('.array-key-dropdown');
            const wrapper = dropdown?.closest('.array-key-wrapper');
            const selector = wrapper?.closest('.array-key-selector');
            const item = selector?.closest('.prop-selector-item');
            const parentCheckbox = item?.querySelector('input[data-path]');

            if (parentCheckbox) {
                const arrayPath = parentCheckbox.dataset.path;
                const keyPropPath = arrayPath + '.' + keyName;
                const isSelected = selectedProperties.has(keyPropPath);

                checkbox.disabled = !isSelected;
                label.style.opacity = isSelected ? '1' : '0.4';
                label.title = isSelected ? '' : 'Property muss ausgewählt sein';

                // Wenn Key ausgewählt aber Property nicht, entferne Key
                if (checkbox.checked && !isSelected) {
                    checkbox.checked = false;
                    removeKeyIfDeselected(keyPropPath);
                }
            }
        });

        // Aktualisiere Button-Texte
        document.querySelectorAll('.array-key-toggle').forEach(btn => {
            const wrapper = btn.closest('.array-key-wrapper');
            const selector = wrapper?.closest('.array-key-selector');
            const item = selector?.closest('.prop-selector-item');
            const parentCheckbox = item?.querySelector('input[data-path]');

            if (parentCheckbox) {
                const path = parentCheckbox.dataset.path;
                const setting = manualArrayKeys.get(path);

                if (!setting || setting.mode === 'auto') {
                    btn.textContent = 'Auto';
                } else if (setting.mode === 'none') {
                    btn.textContent = 'Idx';
                } else if (setting.mode === 'manual' && setting.keys) {
                    const count = setting.keys.length;
                    btn.textContent = count === 1 ? setting.keys[0] : `Keys: ${count}`;
                }
            }
        });
    }

    /**
     * Erstellt das Dropdown-Element für die manuelle Key-Auswahl bei Arrays.
     *
     * @param {string} path - Der Pfad des Arrays
     * @param {Set<string>} availableKeys - Verfügbare Keys für die Auswahl
     * @returns {HTMLElement} Das Dropdown-Container-Element
     */
    function createArrayKeySelector(path, availableKeys) {
        const container = document.createElement('span');
        container.className = 'array-key-selector';

        const wrapper = document.createElement('div');
        wrapper.className = 'array-key-wrapper';

        // Toggle-Button für das Dropdown
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'array-key-toggle';
        toggleBtn.title = 'Vergleichs-Keys für dieses Array wählen';

        // Aktuellen Wert für Button-Text ermitteln
        const currentSetting = manualArrayKeys.get(path);
        const updateButtonText = () => {
            const setting = manualArrayKeys.get(path);
            if (!setting || setting.mode === 'auto') {
                toggleBtn.textContent = 'Auto';
            } else if (setting.mode === 'none') {
                toggleBtn.textContent = 'Idx';
            } else if (setting.mode === 'manual' && setting.keys) {
                const count = setting.keys.length;
                toggleBtn.textContent = count === 1 ? setting.keys[0] : `Keys: ${count}`;
            }
        };
        updateButtonText();

        // Dropdown-Container
        const dropdown = document.createElement('div');
        dropdown.className = 'array-key-dropdown';
        dropdown.style.display = 'none';

        // Option: Auto
        const autoLabel = document.createElement('label');
        autoLabel.className = 'array-key-option';
        const autoRadio = document.createElement('input');
        autoRadio.type = 'radio';
        autoRadio.name = `array-key-mode-${path}`;
        autoRadio.value = 'auto';
        autoRadio.checked = !currentSetting || currentSetting.mode === 'auto';
        autoLabel.appendChild(autoRadio);
        autoLabel.appendChild(document.createTextNode(' Auto'));
        dropdown.appendChild(autoLabel);

        // Option: Index-basiert
        const indexLabel = document.createElement('label');
        indexLabel.className = 'array-key-option';
        const indexRadio = document.createElement('input');
        indexRadio.type = 'radio';
        indexRadio.name = `array-key-mode-${path}`;
        indexRadio.value = 'none';
        indexRadio.checked = currentSetting?.mode === 'none';
        indexLabel.appendChild(indexRadio);
        indexLabel.appendChild(document.createTextNode(' Index-basiert'));
        dropdown.appendChild(indexLabel);

        // Option: Manuell mit Key-Auswahl
        const manualLabel = document.createElement('label');
        manualLabel.className = 'array-key-option';
        const manualRadio = document.createElement('input');
        manualRadio.type = 'radio';
        manualRadio.name = `array-key-mode-${path}`;
        manualRadio.value = 'manual';
        manualRadio.checked = currentSetting?.mode === 'manual';
        manualLabel.appendChild(manualRadio);
        manualLabel.appendChild(document.createTextNode(' Keys wählen:'));
        dropdown.appendChild(manualLabel);

        // Key-Checkboxen Container
        const keysContainer = document.createElement('div');
        keysContainer.className = 'array-key-checkboxes';

        const sortedKeys = [...availableKeys].sort();
        const selectedKeys = currentSetting?.mode === 'manual' ? new Set(currentSetting.keys || []) : new Set();

        sortedKeys.forEach(key => {
            const keyPropPath = path + '.' + key;
            const isPropSelected = selectedProperties && selectedProperties.has(keyPropPath);

            const keyLabel = document.createElement('label');
            keyLabel.className = 'array-key-checkbox-label';
            if (!isPropSelected) {
                keyLabel.style.opacity = '0.4';
                keyLabel.title = 'Property muss ausgewählt sein';
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = key;
            checkbox.checked = selectedKeys.has(key);
            checkbox.disabled = !isPropSelected;

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                // Bei Checkbox-Änderung: Manuell-Modus aktivieren
                manualRadio.checked = true;
                updateManualKeys();
            });
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            keyLabel.appendChild(checkbox);
            keyLabel.appendChild(document.createTextNode(' ' + key));
            keysContainer.appendChild(keyLabel);
        });
        dropdown.appendChild(keysContainer);

        // Funktion zum Aktualisieren der Key-Indikatoren in der Property-Liste
        const updateKeyIndicators = () => {
            const setting = manualArrayKeys.get(path);
            const selectedKeys = (setting && setting.mode === 'manual' && setting.keys) ? setting.keys : [];

            // Finde alle Child-Properties dieses Arrays (sowohl Checkboxen als auch Key-Symbole)
            propSelectorList.querySelectorAll('.prop-selector-item').forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"][data-path]');
                const keySymbol = item.querySelector('.prop-key-symbol[data-path]');
                const element = checkbox || keySymbol;

                if (element && element.dataset.path && element.dataset.path.startsWith(path + '.')) {
                    const propKey = element.dataset.path.split('.').pop();
                    const propPath = element.dataset.path;
                    const arrow = item.querySelector('.prop-tree-arrow');

                    if (selectedKeys.includes(propKey)) {
                        // Property ist ein Key: Checkbox durch 🔑 ersetzen
                        if (checkbox) {
                            selectedProperties.delete(propPath);
                            const keySymbolNew = document.createElement('span');
                            keySymbolNew.className = 'prop-key-symbol';
                            keySymbolNew.textContent = '🔑';
                            keySymbolNew.title = 'Wird als Identifier-Key verwendet';
                            keySymbolNew.dataset.path = propPath;
                            checkbox.replaceWith(keySymbolNew);
                        }
                        item.classList.add('is-key');
                    } else {
                        // Property ist kein Key mehr: 🔑 durch Checkbox ersetzen
                        if (keySymbol) {
                            const newCheckbox = document.createElement('input');
                            newCheckbox.type = 'checkbox';
                            newCheckbox.checked = selectedProperties.has(propPath);
                            newCheckbox.dataset.path = propPath;
                            newCheckbox.addEventListener('change', (e) => {
                                e.stopPropagation();
                                if (e.target.checked) {
                                    selectedProperties.add(propPath);
                                } else {
                                    selectedProperties.delete(propPath);
                                    removeKeyIfDeselected(propPath);
                                }
                                updatePropertySelectorButtonText();
                                updateAllKeyDropdowns();
                            });
                            keySymbol.replaceWith(newCheckbox);
                        }
                        item.classList.remove('is-key');
                    }
                }
            });

            updatePropertySelectorButtonText();
        };

        // Funktion zum Aktualisieren der manuellen Keys
        const updateManualKeys = () => {
            const checkedKeys = [...keysContainer.querySelectorAll('input[type="checkbox"]:checked')]
                .map(cb => cb.value);
            if (checkedKeys.length > 0) {
                manualArrayKeys.set(path, { mode: 'manual', keys: checkedKeys });
            } else {
                manualArrayKeys.delete(path);
                autoRadio.checked = true;
            }
            updateButtonText();
            updateKeyIndicators();
        };

        // Event-Listener für Radio-Buttons
        [autoRadio, indexRadio, manualRadio].forEach(radio => {
            radio.addEventListener('change', (e) => {
                e.stopPropagation();
                if (autoRadio.checked) {
                    manualArrayKeys.delete(path);
                } else if (indexRadio.checked) {
                    manualArrayKeys.set(path, { mode: 'none', keys: null });
                } else if (manualRadio.checked) {
                    updateManualKeys();
                }
                updateButtonText();
                updateKeyIndicators();
            });
            radio.addEventListener('click', (e) => e.stopPropagation());
        });

        // Toggle-Button Event
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display !== 'none';

            // Schließe alle anderen Array-Key-Dropdowns
            document.querySelectorAll('.array-key-dropdown').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
            });

            if (isVisible) {
                dropdown.style.display = 'none';
            } else {
                // Position berechnen basierend auf Button-Position
                const rect = toggleBtn.getBoundingClientRect();
                dropdown.style.display = 'block';
                dropdown.style.top = (rect.bottom + 4) + 'px';
                dropdown.style.left = Math.max(8, rect.right - dropdown.offsetWidth) + 'px';
            }
        });

        // Schließen bei Klick außerhalb
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(dropdown);
        container.appendChild(wrapper);
        return container;
    }

    function scanProperties() {
        const jsonAText = jsonATextarea.value.trim();
        const jsonBText = jsonBTextarea.value.trim();

        if (!jsonAText && !jsonBText) {
            showError('Bitte mindestens ein JSON-Feld ausfüllen.');
            return;
        }

        let jsonA = null, jsonB = null;

        if (jsonAText) {
            try {
                jsonA = JSON.parse(jsonAText);
            } catch (e) {
                showError('JSON A ist ungültig: ' + e.message);
                return;
            }
        }

        if (jsonBText) {
            try {
                jsonB = JSON.parse(jsonBText);
            } catch (e) {
                showError('JSON B ist ungültig: ' + e.message);
                return;
            }
        }

        const propsA = jsonA ? extractAllProperties(jsonA, '', 'A') : [];
        const propsB = jsonB ? extractAllProperties(jsonB, '', 'B') : [];

        // Array-Key-Optionen sammeln
        arrayKeyOptions = new Map();
        if (jsonA) collectArrayKeyOptions(jsonA, '', arrayKeyOptions);
        if (jsonB) collectArrayKeyOptions(jsonB, '', arrayKeyOptions);
        manualArrayKeys = new Map();  // Reset manual selections

        // Kombiniere und dedupliziere Properties
        const propMap = new Map();

        propsA.forEach(p => {
            propMap.set(p.path, { path: p.path, inA: true, inB: false });
        });

        propsB.forEach(p => {
            if (propMap.has(p.path)) {
                propMap.get(p.path).inB = true;
            } else {
                propMap.set(p.path, { path: p.path, inA: false, inB: true });
            }
        });

        allScannedProperties = Array.from(propMap.values()).sort((a, b) => a.path.localeCompare(b.path));
        selectedProperties = new Set(allScannedProperties.map(p => p.path));

        renderPropertySelector();
        propSelectorBtn.disabled = false;
        updatePropertySelectorButtonText();
    }

    /**
     * Wandelt die flache Property-Liste in eine Baum-Struktur um.
     *
     * Beispiel-Input:  ["user", "user.name", "user.email"]
     * Beispiel-Output: { user: { _props: {...}, _children: { name: {...}, email: {...} } } }
     *
     * Diese Struktur ermöglicht die hierarchische Darstellung im Dropdown
     * mit aufklappbaren Ebenen.
     *
     * @param {Array} properties - Flache Liste von Property-Objekten
     * @returns {Object} Baum-Struktur für die UI-Darstellung
     */
    function buildPropertyTree(properties) {
        const tree = {};

        properties.forEach(prop => {
            const parts = prop.path.split('.');
            let current = tree;

            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        _children: {},  // Kind-Properties
                        _props: null    // Property-Daten (path, inA, inB)
                    };
                }
                // Am Ende des Pfads: Property-Daten speichern
                if (index === parts.length - 1) {
                    current[part]._props = prop;
                }
                current = current[part]._children;
            });
        });

        return tree;
    }

    function renderPropertySelector() {
        propSelectorList.innerHTML = '';

        const tree = buildPropertyTree(allScannedProperties);
        renderTreeLevel(tree, propSelectorList, 0, '');
    }

    function renderTreeLevel(tree, container, depth, parentPath) {
        const keys = Object.keys(tree).sort();

        keys.forEach(key => {
            const node = tree[key];
            const currentPath = parentPath ? `${parentPath}.${key}` : key;
            const hasChildren = Object.keys(node._children).length > 0;
            const prop = node._props;

            // Container für diesen Knoten
            const nodeContainer = document.createElement('div');
            nodeContainer.className = 'prop-tree-node';

            // Das Item (Zeile)
            const item = document.createElement('div');
            item.className = 'prop-selector-item';
            item.style.paddingLeft = `${0.5 + depth * 1.2}em`;

            // Farbkodierung
            if (prop) {
                item.classList.add(getPropertySourceClass(prop));
            }

            // Pfeil für aufklappbare Elemente
            const arrow = document.createElement('span');
            arrow.className = 'prop-tree-arrow';
            if (hasChildren) {
                arrow.classList.add('has-children');
                arrow.textContent = '▶';
                arrow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    nodeContainer.classList.toggle('expanded');
                    arrow.textContent = nodeContainer.classList.contains('expanded') ? '▼' : '▶';
                });
            }
            item.appendChild(arrow);

            // Prüfe ob dieses Property ein Key des Parent-Arrays ist
            const parentKeySetting = manualArrayKeys.get(parentPath);
            let isKey = false;
            if (parentKeySetting && parentKeySetting.mode === 'manual' && parentKeySetting.keys) {
                isKey = parentKeySetting.keys.includes(key);
            }

            // Checkbox oder Key-Symbol
            if (prop) {
                if (isKey) {
                    // Key-Property: Zeige 🔑 statt Checkbox
                    const keySymbol = document.createElement('span');
                    keySymbol.className = 'prop-key-symbol';
                    keySymbol.textContent = '🔑';
                    keySymbol.title = 'Wird als Identifier-Key verwendet';
                    keySymbol.dataset.path = prop.path;
                    item.appendChild(keySymbol);
                    item.classList.add('is-key');
                    // Key-Properties aus selectedProperties entfernen
                    selectedProperties.delete(prop.path);
                } else {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = selectedProperties.has(prop.path);
                    checkbox.dataset.path = prop.path;
                    checkbox.addEventListener('change', (e) => {
                        e.stopPropagation();
                        if (e.target.checked) {
                            selectedProperties.add(prop.path);
                        } else {
                            selectedProperties.delete(prop.path);
                            // Prüfe ob dieses Property ein Key war und entferne es
                            removeKeyIfDeselected(prop.path);
                        }
                        // Auch alle Kind-Properties mit aktualisieren
                        if (hasChildren) {
                            toggleChildProperties(prop.path, e.target.checked);
                        }
                        updatePropertySelectorButtonText();
                        updateAllKeyDropdowns();
                    });
                    item.appendChild(checkbox);
                }
            } else {
                // Platzhalter für Alignment wenn keine Checkbox
                const spacer = document.createElement('span');
                spacer.className = 'prop-checkbox-spacer';
                item.appendChild(spacer);
            }

            // Property-Name (nur der letzte Teil)
            const text = document.createElement('span');
            text.className = 'prop-name';
            text.textContent = key;
            item.appendChild(text);

            // Array-Key-Selector (nur wenn Keys verfügbar sind)
            const availableKeys = arrayKeyOptions.get(currentPath);
            if (availableKeys && availableKeys.size > 0) {
                const keySelector = createArrayKeySelector(currentPath, availableKeys);
                item.appendChild(keySelector);
            }

            nodeContainer.appendChild(item);

            // Kinder-Container
            if (hasChildren) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'prop-tree-children';
                renderTreeLevel(node._children, childrenContainer, depth + 1, currentPath);
                nodeContainer.appendChild(childrenContainer);
            }

            container.appendChild(nodeContainer);
        });
    }

    function updatePropertySelectorButtonText() {
        const total = allScannedProperties.length;
        const selected = selectedProperties ? selectedProperties.size : 0;
        propSelectorBtn.querySelector('.prop-selector-text').textContent =
            `Properties (${selected}/${total})`;
    }

    scanPropsBtn.addEventListener('click', scanProperties);

    propSelectorBtn.addEventListener('click', () => {
        if (!propSelectorBtn.disabled) {
            propSelectorDropdown.classList.toggle('open');
        }
    });

    selectAllProps.addEventListener('click', (e) => {
        e.preventDefault();
        selectedProperties = new Set(allScannedProperties.map(p => p.path));
        propSelectorList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        updatePropertySelectorButtonText();
    });

    deselectAllProps.addEventListener('click', (e) => {
        e.preventDefault();
        selectedProperties = new Set();
        propSelectorList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updatePropertySelectorButtonText();
    });

    // Klick außerhalb schließt Dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.property-selector')) {
            propSelectorDropdown.classList.remove('open');
        }
        if (!e.target.closest('.normalize-selector')) {
            normalizeDropdown.classList.remove('open');
        }
    });

    // Normalize Dropdown Toggle
    normalizeBtn.addEventListener('click', () => {
        normalizeDropdown.classList.toggle('open');
    });

    // Normalize Options
    normalizeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.mode;
            normalizeDropdown.classList.remove('open');
            applyNormalization(mode);
        });
    });

    /**
     * Wendet die Normalisierung basierend auf dem gewählten Modus an.
     *
     * @param {string} mode - 'a-master', 'b-master', oder 'alphabetical'
     */
    function applyNormalization(mode) {
        const jsonAText = jsonATextarea.value.trim();
        const jsonBText = jsonBTextarea.value.trim();

        if (!jsonAText && !jsonBText) {
            showError('Bitte mindestens ein JSON-Feld ausfüllen.');
            return;
        }

        let jsonA = null, jsonB = null;

        if (jsonAText) {
            try {
                jsonA = JSON.parse(jsonAText);
            } catch (e) {
                showError('JSON A ist ungültig: ' + e.message);
                return;
            }
        }

        if (jsonBText) {
            try {
                jsonB = JSON.parse(jsonBText);
            } catch (e) {
                showError('JSON B ist ungültig: ' + e.message);
                return;
            }
        }

        let normalizedA = jsonA;
        let normalizedB = jsonB;

        switch (mode) {
            case 'a-master':
                // A bleibt, B wird nach A sortiert
                if (jsonA && jsonB) {
                    normalizedB = normalizeByMaster(jsonB, jsonA);
                }
                break;
            case 'b-master':
                // B bleibt, A wird nach B sortiert
                if (jsonA && jsonB) {
                    normalizedA = normalizeByMaster(jsonA, jsonB);
                }
                break;
            case 'alphabetical':
                // Beide alphabetisch
                if (jsonA) normalizedA = normalizeAlphabetically(jsonA);
                if (jsonB) normalizedB = normalizeAlphabetically(jsonB);
                break;
        }

        // Ergebnis in Textareas schreiben
        if (normalizedA !== null) {
            jsonATextarea.value = JSON.stringify(normalizedA, null, 2);
            updateHighlight(jsonATextarea, highlightA, lineNumbersA);
        }
        if (normalizedB !== null) {
            jsonBTextarea.value = JSON.stringify(normalizedB, null, 2);
            updateHighlight(jsonBTextarea, highlightB, lineNumbersB);
        }

        // Highlights zurücksetzen
        clearDiffHighlights();
    }

    copyBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.dataset.target;
            const textarea = document.getElementById(targetId);

            try {
                await navigator.clipboard.writeText(textarea.value);
                showCopyFeedback(btn);
            } catch (err) {
                textarea.select();
                document.execCommand('copy');
                showCopyFeedback(btn);
            }
        });
    });

    expandBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const container = document.getElementById(targetId).closest('.container');
            container.classList.toggle('expanded');

            if (container.classList.contains('expanded')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const expandedContainer = document.querySelector('.container.expanded');
            if (expandedContainer) {
                expandedContainer.classList.remove('expanded');
                document.body.style.overflow = '';
            }
        }
    });

    setupDragAndDrop(jsonATextarea);
    setupDragAndDrop(jsonBTextarea);

    jsonATextarea.addEventListener('input', () => {
        clearDiffHighlights();
    });
    jsonBTextarea.addEventListener('input', () => {
        clearDiffHighlights();
    });
    jsonATextarea.addEventListener('scroll', () => syncScroll(jsonATextarea, highlightA, lineNumbersA));
    jsonBTextarea.addEventListener('scroll', () => syncScroll(jsonBTextarea, highlightB, lineNumbersB));

    function updateHighlight(textarea, highlight, lineNumbers, diffRanges = []) {
        const text = textarea.value;
        highlight.innerHTML = highlightJSON(text, diffRanges);
        updateLineNumbers(text, lineNumbers);
    }

    function updateLineNumbers(text, lineNumbersEl) {
        const lines = text.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) {
            html += '<span>' + i + '</span>';
        }
        lineNumbersEl.innerHTML = html || '<span>1</span>';
    }

    /**
     * Aktualisiert beide JSON-Editoren mit Diff-Highlighting.
     */
    function updateHighlightsWithDiff() {
        updateHighlight(jsonATextarea, highlightA, lineNumbersA, diffHighlightsA);
        updateHighlight(jsonBTextarea, highlightB, lineNumbersB, diffHighlightsB);
    }

    function syncScroll(textarea, highlight, lineNumbers) {
        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
        lineNumbers.scrollTop = textarea.scrollTop;
    }

    function highlightJSON(text, diffRanges = []) {
        if (!text) return '';

        // Sortiere Ranges nach Start-Position (absteigend für rückwärts-Einfügung)
        const sortedRanges = [...diffRanges].sort((a, b) => b.start - a.start);

        // Füge Diff-Marker ein (von hinten nach vorne um Positionen nicht zu verschieben)
        let markedText = text;
        sortedRanges.forEach(range => {
            const before = markedText.slice(0, range.start);
            const diffPart = markedText.slice(range.start, range.end);
            const after = markedText.slice(range.end);
            markedText = before + '\x00DIFF_START\x00' + diffPart + '\x00DIFF_END\x00' + after;
        });

        // Standard-Highlighting
        let result = markedText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:')
            .replace(/:(\s*)("(?:[^"\\]|\\.)*")/g, ':$1<span class="json-string">$2</span>')
            .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
            .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
            .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');

        // Ersetze Diff-Marker durch HTML
        result = result
            .replace(/\x00DIFF_START\x00/g, '<span class="json-diff-changed">')
            .replace(/\x00DIFF_END\x00/g, '</span>');

        return result;
    }

    /**
     * Findet die Position eines Wertes im formatierten JSON-Text anhand des Pfads.
     * Gibt { start, end } zurück oder null wenn nicht gefunden.
     *
     * @param {string} jsonText - Der formatierte JSON-String
     * @param {string} path - Der Pfad zum Wert (z.B. "user.name" oder "friends[0].age")
     * @returns {Object|null} { start, end } oder null
     */
    function findValuePositionInJSON(jsonText, path) {
        try {
            // Pfad in Teile zerlegen
            const parts = [];
            // Regex für: key | [index] | [key=val] oder [key1=val1,key2=val2,...]
            const pathRegex = /([^.\[\]]+)|\[(\d+)\]|\[([^\]]+)\]/g;
            let match;
            while ((match = pathRegex.exec(path)) !== null) {
                if (match[1]) {
                    parts.push({ type: 'key', value: match[1] });
                } else if (match[2]) {
                    parts.push({ type: 'index', value: parseInt(match[2]) });
                } else if (match[3]) {
                    // Key-basierter Array-Zugriff (z.B. [vorname=stefan] oder [domain=learning,policyName=read])
                    const keyValuePairs = match[3].split(',').map(pair => {
                        const [key, ...valueParts] = pair.split('=');
                        return { key: key.trim(), value: valueParts.join('=').trim() };
                    });
                    parts.push({ type: 'keyMatch', pairs: keyValuePairs });
                }
            }

            if (parts.length === 0) return null;

            let pos = 0;

            // Navigiere durch den JSON-Text
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];

                if (part.type === 'key') {
                    // Suche nach "key":
                    const keyPattern = new RegExp(`"${part.value}"\\s*:`);
                    const keyMatch = keyPattern.exec(jsonText.slice(pos));
                    if (!keyMatch) return null;
                    pos += keyMatch.index + keyMatch[0].length;

                    // Überspringe Whitespace nach dem Doppelpunkt
                    pos = skipWhitespace(jsonText, pos);

                } else if (part.type === 'index') {
                    // Finde das Array und navigiere zum Index
                    const arrayStart = jsonText.indexOf('[', pos);
                    if (arrayStart === -1) return null;
                    pos = arrayStart + 1;

                    // Zähle Array-Elemente bis zum gewünschten Index
                    let elementCount = 0;
                    let depth = 0;

                    while (pos < jsonText.length && elementCount <= part.value) {
                        const char = jsonText[pos];
                        if (char === '[' || char === '{') depth++;
                        else if (char === ']' || char === '}') depth--;
                        else if (char === ',' && depth === 0) {
                            elementCount++;
                        }

                        if (elementCount === part.value && depth === 0 && !/[\s,\[]/.test(char)) {
                            break;
                        }
                        pos++;
                    }

                    // Überspringe Whitespace
                    while (pos < jsonText.length && /[\s,]/.test(jsonText[pos])) pos++;

                } else if (part.type === 'keyMatch') {
                    // Finde das Array und suche Element mit passenden Key-Value-Paaren
                    const arrayStart = jsonText.indexOf('[', pos);
                    if (arrayStart === -1) return null;
                    pos = arrayStart + 1;

                    // Erstelle Regex-Patterns für alle Key-Value-Paare
                    const searchPatterns = part.pairs.map(pair => {
                        // Unterstütze sowohl String-Werte ("value") als auch primitive Werte (123, true)
                        const escapedKey = pair.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const escapedValue = pair.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        return new RegExp(`"${escapedKey}"\\s*:\\s*("${escapedValue}"|${escapedValue})`);
                    });

                    let depth = 0;
                    let objStart = -1;
                    let found = false;

                    while (pos < jsonText.length && !found) {
                        const char = jsonText[pos];

                        if (char === '{') {
                            if (depth === 0) {
                                objStart = pos;
                            }
                            depth++;
                        } else if (char === '[') {
                            depth++;
                        } else if (char === '}') {
                            depth--;
                            // Prüfe ob wir am Ende eines Top-Level-Objekts im Array sind
                            if (depth === 0 && objStart !== -1) {
                                const objText = jsonText.slice(objStart, pos + 1);
                                const allMatch = searchPatterns.every(pattern => pattern.test(objText));
                                if (allMatch) {
                                    pos = objStart;
                                    found = true;
                                    break;
                                }
                                objStart = -1;
                            }
                        } else if (char === ']') {
                            depth--;
                            if (depth < 0) break; // Ende des Arrays
                        }

                        pos++;
                    }

                    // Überspringe Whitespace
                    pos = skipWhitespace(jsonText, pos);
                }
            }

            // Jetzt sind wir am Start des Wertes - finde das Ende
            const startPos = pos;
            const startChar = jsonText[pos];

            if (startChar === '"') {
                // String: Finde das schließende Anführungszeichen
                pos++;
                while (pos < jsonText.length) {
                    if (jsonText[pos] === '"' && jsonText[pos - 1] !== '\\') {
                        pos++;
                        break;
                    }
                    pos++;
                }
            } else if (startChar === '{' || startChar === '[') {
                // Objekt oder Array: Finde die schließende Klammer
                let depth = 1;
                pos++;
                while (pos < jsonText.length && depth > 0) {
                    if (jsonText[pos] === '{' || jsonText[pos] === '[') depth++;
                    else if (jsonText[pos] === '}' || jsonText[pos] === ']') depth--;
                    pos++;
                }
            } else {
                // Primitiver Wert (Zahl, boolean, null)
                while (pos < jsonText.length && /[^\s,\}\]]/.test(jsonText[pos])) {
                    pos++;
                }
            }

            return { start: startPos, end: pos };

        } catch (e) {
            console.warn('Error finding value position:', e);
            return null;
        }
    }

    /**
     * Hebt einen einzelnen Unterschied in beiden JSON-Editoren hervor.
     *
     * @param {Object} diff - Das Difference-Objekt mit path, type, valueA, valueB
     */
    function highlightDifferenceInEditors(diff, buttonEl) {
        // Toggle: Pfad hinzufügen oder entfernen
        if (highlightedPaths.has(diff.path)) {
            // Ausschalten
            highlightedPaths.delete(diff.path);
            if (buttonEl) buttonEl.classList.remove('active');
        } else {
            // Einschalten
            highlightedPaths.add(diff.path);
            if (buttonEl) buttonEl.classList.add('active');
        }

        // Alle Highlights neu berechnen basierend auf aktiven Pfaden
        recalculateAllHighlights();

        // Zu der neu hinzugefügten Stelle scrollen (nur wenn eingeschaltet)
        if (highlightedPaths.has(diff.path)) {
            const jsonAText = jsonATextarea.value;
            const jsonBText = jsonBTextarea.value;
            const posA = findValuePositionInJSON(jsonAText, diff.path);
            const posB = findValuePositionInJSON(jsonBText, diff.path);

            if (posA) {
                scrollToPosition(jsonATextarea, highlightA, posA.start);
            }
            if (posB) {
                scrollToPosition(jsonBTextarea, highlightB, posB.start);
            }
        }
    }

    /**
     * Berechnet alle Highlights neu basierend auf den aktiven Pfaden.
     */
    function recalculateAllHighlights() {
        diffHighlightsA = [];
        diffHighlightsB = [];

        const jsonAText = jsonATextarea.value;
        const jsonBText = jsonBTextarea.value;

        for (const path of highlightedPaths) {
            const posA = findValuePositionInJSON(jsonAText, path);
            const posB = findValuePositionInJSON(jsonBText, path);

            if (posA) diffHighlightsA.push(posA);
            if (posB) diffHighlightsB.push(posB);
        }

        updateHighlightsWithDiff();
    }

    /**
     * Scrollt den Editor zur angegebenen Position.
     *
     * @param {HTMLTextAreaElement} textarea - Das Textarea-Element
     * @param {HTMLElement} highlight - Das Highlight-Overlay
     * @param {number} charPos - Die Zeichenposition
     */
    function scrollToPosition(textarea, highlight, charPos) {
        const text = textarea.value;

        // Zeile berechnen in der sich die Position befindet
        const textBefore = text.slice(0, charPos);
        const lineNumber = (textBefore.match(/\n/g) || []).length;

        // Ungefähre Zeilenhöhe (basierend auf line-height und font-size)
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 22;
        const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 16;

        // Scroll-Position berechnen (zentriert wenn möglich)
        const targetScroll = Math.max(0, (lineNumber * lineHeight) - (textarea.clientHeight / 2) + paddingTop);

        textarea.scrollTop = targetScroll;
        highlight.scrollTop = targetScroll;
    }

    function setupDragAndDrop(textarea) {
        const container = textarea.closest('.container');

        // Prevent default for all drag events
        CONFIG.DRAG_EVENTS.forEach(event => {
            container.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Add/remove drag-over class based on event type
        CONFIG.DRAG_EVENTS.forEach(event => {
            container.addEventListener(event, () => {
                const shouldHighlight = event === 'dragenter' || event === 'dragover';
                container.classList.toggle('drag-over', shouldHighlight);
            });
        });

        // Handle file drop
        container.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileSelect(file, textarea);
            }
        });
    }

    function handleFileSelect(file, textarea) {
        if (!file) return;

        const highlight = textarea === jsonATextarea ? highlightA : highlightB;
        const lineNumbers = textarea === jsonATextarea ? lineNumbersA : lineNumbersB;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                textarea.value = JSON.stringify(json, null, 2);
            } catch (err) {
                textarea.value = e.target.result;
                showError('Die Datei enthält kein gültiges JSON: ' + err.message);
            }
            updateHighlight(textarea, highlight, lineNumbers);
        };
        reader.readAsText(file);
    }

    const exampleA = {
        "name": "Max Mustermann",
        "alter": 32,
        "email": "max@example.com",
        "adresse": {
            "strasse": "Hauptstraße 42",
            "plz": "10115",
            "stadt": "Berlin"
        },
        "hobbys": ["Lesen", "Schwimmen", "Kochen"],
        "aktiv": true,
        "premium": false
    };

    const exampleB = {
        "name": "Max Mustermann",
        "alter": 33,
        "email": "max.mustermann@example.com",
        "adresse": {
            "strasse": "Hauptstraße 42",
            "plz": "10117",
            "stadt": "Berlin",
            "land": "Deutschland"
        },
        "hobbys": ["Lesen", "Joggen", "Kochen"],
        "aktiv": true
    };

    jsonATextarea.value = JSON.stringify(exampleA, null, 2);
    jsonBTextarea.value = JSON.stringify(exampleB, null, 2);
    updateHighlight(jsonATextarea, highlightA, lineNumbersA);
    updateHighlight(jsonBTextarea, highlightB, lineNumbersB);

    compareBtn.addEventListener('click', compareJSON);
    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => formatSingleJSON(btn.dataset.target));
    });
    toggleAllBtn.addEventListener('click', toggleAll);

    // Tab-Taste fügt zwei Leerzeichen ein
    function handleTab(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const spaces = '  ';

            textarea.value = textarea.value.substring(0, start) + spaces + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + spaces.length;

            const highlight = textarea === jsonATextarea ? highlightA : highlightB;
            const lineNumbers = textarea === jsonATextarea ? lineNumbersA : lineNumbersB;
            updateHighlight(textarea, highlight, lineNumbers);
        }
    }

    jsonATextarea.addEventListener('keydown', handleTab);
    jsonBTextarea.addEventListener('keydown', handleTab);
    exportBtn.addEventListener('click', exportResults);
    exampleBtn.addEventListener('click', loadExample);

    function loadExample() {
        jsonATextarea.value = JSON.stringify(exampleA, null, 2);
        jsonBTextarea.value = JSON.stringify(exampleB, null, 2);
        updateHighlight(jsonATextarea, highlightA, lineNumbersA);
        updateHighlight(jsonBTextarea, highlightB, lineNumbersB);
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFilter();
        });
    });

    function applyFilter() {
        const diffLines = diffResult.querySelectorAll('.diff-line');
        diffLines.forEach(line => {
            const path = line.querySelector('.diff-path')?.textContent || '';
            const matchesType = currentFilter === 'all' || line.classList.contains('diff-' + currentFilter);
            const matchesProperty = !propertyFilterValue || path.toLowerCase().includes(propertyFilterValue.toLowerCase());

            if (matchesType && matchesProperty) {
                line.style.display = '';
            } else {
                line.style.display = 'none';
            }
        });
    }

    propertyFilter.addEventListener('input', (e) => {
        propertyFilterValue = e.target.value.trim();
        applyFilter();
    });

    function toggleAll() {
        const diffLines = diffResult.querySelectorAll('.diff-line');
        allCollapsed = !allCollapsed;

        diffLines.forEach(line => {
            if (allCollapsed) {
                line.classList.add('collapsed');
            } else {
                line.classList.remove('collapsed');
            }
        });

        toggleAllBtn.innerHTML = '<span class="styled-btn-inner">' + (allCollapsed ? 'Alle aufklappen' : 'Alle zuklappen') + '</span>';
    }

    function exportResults() {
        if (lastDifferences.length === 0) {
            showError('Keine Unterschiede zum Exportieren vorhanden.');
            return;
        }

        const nameA = aliasA.value.trim() || 'A';
        const nameB = aliasB.value.trim() || 'B';

        const lines = [
            'JSON Vergleich - Ergebnisse',
            '=' .repeat(50),
            `Datum: ${new Date().toLocaleString('de-DE')}`,
            `Vergleich: ${nameA} ⇄ ${nameB}`,
            `Anzahl Unterschiede: ${lastDifferences.length}`,
            '',
            '─'.repeat(50),
            ''
        ];

        const { removed, added, changed } = classifyDifferences(lastDifferences);

        if (removed.length > 0) {
            lines.push(`NUR IN ${nameA} (${removed.length}):`);
            lines.push('─'.repeat(30));
            removed.forEach(diff => {
                lines.push(`  - ${diff.path}: ${JSON.stringify(diff.valueA)}`);
            });
            lines.push('');
        }

        if (added.length > 0) {
            lines.push(`NUR IN ${nameB} (${added.length}):`);
            lines.push('─'.repeat(30));
            added.forEach(diff => {
                lines.push(`  + ${diff.path}: ${JSON.stringify(diff.valueB)}`);
            });
            lines.push('');
        }

        if (changed.length > 0) {
            lines.push(`UNTERSCHIEDLICH (${changed.length}):`);
            lines.push('─'.repeat(30));
            changed.forEach(diff => {
                lines.push(`  ~ ${diff.path}:`);
                lines.push(`      ${nameA}: ${JSON.stringify(diff.valueA)}`);
                lines.push(`      ${nameB}: ${JSON.stringify(diff.valueB)}`);
            });
            lines.push('');
        }

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `json-vergleich-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function compareJSON() {
        const jsonAText = jsonATextarea.value.trim();
        const jsonBText = jsonBTextarea.value.trim();

        if (!jsonAText || !jsonBText) {
            showError('Bitte beide JSON-Felder ausfüllen.');
            return;
        }

        let jsonA, jsonB;

        try {
            jsonA = JSON.parse(jsonAText);
        } catch (e) {
            showError('JSON A ist ungültig: ' + e.message);
            return;
        }

        try {
            jsonB = JSON.parse(jsonBText);
        } catch (e) {
            showError('JSON B ist ungültig: ' + e.message);
            return;
        }

        const differences = findDifferences(jsonA, jsonB, '');
        lastDifferences = differences;

        displayDifferences(differences);

        // Diff-Highlights zurücksetzen (werden erst bei Klick auf "Show" angezeigt)
        diffHighlightsA = [];
        diffHighlightsB = [];
        updateHighlight(jsonATextarea, highlightA, lineNumbersA);
        updateHighlight(jsonBTextarea, highlightB, lineNumbersB);
    }

    /**
     * Prüft ob ein Property-Pfad für den Vergleich ausgewählt ist.
     *
     * Wichtig: Array-Indizes werden ignoriert, damit die Auswahl von
     * "results.user.email" auch für "results[0].user.email" gilt.
     *
     * @param {string} path - Der zu prüfende Pfad (z.B. "results[0].user.email")
     * @returns {boolean} true wenn der Unterschied gemeldet werden soll
     */
    function isPropertySelected(path) {
        if (selectedProperties === null) return true;  // null = alle vergleichen

        // Prüfe ob der exakte Pfad ausgewählt ist
        if (selectedProperties.has(path)) return true;

        // Normalisiere: Entferne Array-Notationen und prüfe erneut
        // z.B. "results[0].user.email" -> "results.user.email"
        // z.B. "friends[vorname=stefan].age" -> "friends.age"
        const normalizedPath = path.replace(/\[[^\]]+\]/g, '');
        return selectedProperties.has(normalizedPath);
    }

    /**
     * Prüft ob es Kind-Properties gibt, die ausgewählt sind.
     *
     * Wird verwendet um zu entscheiden, ob wir in ein Objekt/Array
     * hineinrekursieren müssen, auch wenn das Objekt selbst nicht ausgewählt ist.
     *
     * Beispiel: Wenn "user.email" ausgewählt ist, muss "user" durchlaufen werden.
     *
     * @param {string} path - Der Eltern-Pfad
     * @returns {boolean} true wenn Kind-Pfade ausgewählt sind
     */
    function hasSelectedChildren(path) {
        if (selectedProperties === null) return true;
        if (path === '') {
            return selectedProperties.size > 0;
        }

        // Normalisiere: Entferne Array-Notationen (numerisch und key-basiert)
        const normalizedPath = path.replace(/\[[^\]]+\]/g, '');
        const prefix = normalizedPath + '.';

        // Suche nach Kind-Pfaden die mit diesem Prefix beginnen
        for (const prop of selectedProperties) {
            if (prop.startsWith(prefix)) return true;
        }
        return false;
    }

    /**
     * Kombiniert isPropertySelected und hasSelectedChildren.
     *
     * Eine Property muss verarbeitet werden wenn:
     * - Sie selbst ausgewählt ist (Unterschied wird gemeldet), ODER
     * - Sie Kind-Properties hat die ausgewählt sind (muss durchlaufen werden)
     *
     * @param {string} path - Der zu prüfende Pfad
     * @returns {boolean} true wenn die Property verarbeitet werden soll
     */
    function shouldProcessProperty(path) {
        return isPropertySelected(path) || hasSelectedChildren(path);
    }

    /**
     * Wählt alle Kind-Properties einer Eltern-Property aus oder ab.
     *
     * Wird aufgerufen wenn der Benutzer eine Checkbox einer Property
     * mit Kindern ändert - dann werden alle Kinder automatisch mit aktualisiert.
     *
     * @param {string} parentPath - Pfad der Eltern-Property
     * @param {boolean} checked - true = auswählen, false = abwählen
     */
    function toggleChildProperties(parentPath, checked) {
        const prefix = parentPath + '.';

        // State aktualisieren
        allScannedProperties.forEach(prop => {
            if (prop.path.startsWith(prefix)) {
                if (checked) {
                    selectedProperties.add(prop.path);
                } else {
                    selectedProperties.delete(prop.path);
                }
            }
        });

        // Checkboxen im UI synchronisieren
        propSelectorList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.dataset.path && cb.dataset.path.startsWith(prefix)) {
                cb.checked = checked;
            }
        });
    }

    /**
     * Prüft ob eine Kombination von Keys eindeutige Werte erzeugt.
     *
     * @param {Array} objects - Array von Objekten
     * @param {Array} keys - Array von Key-Namen
     * @returns {boolean} true wenn die Kombination eindeutig ist
     */
    function isKeyComboUnique(objects, keys) {
        const compositeValues = objects.map(obj =>
            keys.map(k => String(obj[k] ?? '')).join('|||')
        );
        return new Set(compositeValues).size === compositeValues.length;
    }

    /**
     * Findet gemeinsame Schlüssel in allen Objekten beider Arrays.
     * Gibt ein Array von Keys zurück, die zusammen eindeutig identifizieren.
     * Priorisiert einzelne Keys, kombiniert mehrere wenn nötig.
     *
     * @param {Array} arrA - Array aus JSON A
     * @param {Array} arrB - Array aus JSON B
     * @returns {Array|null} Array von Schlüsseln oder null
     */
    function findCommonKeys(arrA, arrB) {
        const objectsA = arrA.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        const objectsB = arrB.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));

        if (objectsA.length === 0 || objectsB.length === 0) return null;

        // Finde Keys die in ALLEN Objekten beider Arrays vorkommen
        const keysInAllA = findCommonKeysInObjects(objectsA);
        const keysInAllB = findCommonKeysInObjects(objectsB);
        const commonKeys = [...keysInAllA].filter(k => keysInAllB.has(k));

        // Filtere auf primitive Keys
        const primitiveKeys = commonKeys.filter(key => {
            const valuesA = objectsA.map(obj => obj[key]);
            const valuesB = objectsB.map(obj => obj[key]);
            return [...valuesA, ...valuesB].every(v =>
                typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            );
        });

        if (primitiveKeys.length === 0) return null;

        // 1. Versuche einzelnen Priority-Key
        for (const pk of CONFIG.PRIORITY_KEYS) {
            if (primitiveKeys.includes(pk)) {
                if (isKeyComboUnique(objectsA, [pk]) || isKeyComboUnique(objectsB, [pk])) {
                    return [pk];
                }
            }
        }

        // 2. Versuche anderen einzelnen Key
        for (const key of primitiveKeys) {
            if (isKeyComboUnique(objectsA, [key]) || isKeyComboUnique(objectsB, [key])) {
                return [key];
            }
        }

        // 3. Versuche Kombination aus 2 Keys
        for (let i = 0; i < primitiveKeys.length; i++) {
            for (let j = i + 1; j < primitiveKeys.length; j++) {
                const combo = [primitiveKeys[i], primitiveKeys[j]];
                if (isKeyComboUnique(objectsA, combo) || isKeyComboUnique(objectsB, combo)) {
                    return combo;
                }
            }
        }

        // 4. Versuche Kombination aus 3 Keys
        for (let i = 0; i < primitiveKeys.length; i++) {
            for (let j = i + 1; j < primitiveKeys.length; j++) {
                for (let k = j + 1; k < primitiveKeys.length; k++) {
                    const combo = [primitiveKeys[i], primitiveKeys[j], primitiveKeys[k]];
                    if (isKeyComboUnique(objectsA, combo) || isKeyComboUnique(objectsB, combo)) {
                        return combo;
                    }
                }
            }
        }

        // Fallback: Ersten Key zurückgeben (auch wenn nicht eindeutig)
        return primitiveKeys.length > 0 ? [primitiveKeys[0]] : null;
    }


    /**
     * Vergleicht zwei Arrays und findet Unterschiede.
     *
     * Es gibt drei Vergleichs-Modi:
     *
     * 1. KEY-BASIERTER VERGLEICH (inhaltlich):
     *    Wenn das Array Objekte enthält UND ein gemeinsamer Schlüssel gefunden wird.
     *    Matcht Objekte nach ihrem Schlüsselwert (z.B. "name" oder "id").
     *    Vergleicht dann die Properties der gematchten Objekte.
     *    Beispiel: friends mit name "stefan" werden gematcht, unabhängig von Position.
     *
     * 2. STRUKTURELLER VERGLEICH (positionsbasiert):
     *    Fallback wenn kein gemeinsamer Key gefunden wird.
     *    Vergleicht Element für Element an der gleichen Position.
     *    Beispiel: results[0] mit results[0], results[1] mit results[1], etc.
     *
     * 3. MENGEN-VERGLEICH (vorhandensbasiert):
     *    Für einfache Arrays (Strings, Zahlen) oder wenn das Array selbst ausgewählt ist.
     *    Prüft nur ob Elemente vorhanden sind, nicht die Position.
     *    Beispiel: ["A", "B"] vs ["B", "C"] → A entfernt, C hinzugefügt
     *
     * @param {Array} arrA - Array aus JSON A
     * @param {Array} arrB - Array aus JSON B
     * @param {string} path - Aktueller Pfad (z.B. "results")
     * @returns {Array} Liste der gefundenen Unterschiede
     */
    function compareArrays(arrA, arrB, path) {
        const differences = [];

        // Früher Abbruch wenn weder Array noch Kind-Properties ausgewählt
        if (!shouldProcessProperty(path)) return differences;

        // Prüfe ob Arrays Objekte enthalten (für strukturellen Vergleich)
        const hasObjectsA = arrA.some(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        const hasObjectsB = arrB.some(item => typeof item === 'object' && item !== null && !Array.isArray(item));

        // MODUS 1 & 2: Vergleich für Objekt-Arrays mit Kind-Auswahl
        if ((hasObjectsA || hasObjectsB) && hasSelectedChildren(path)) {

            // Prüfe manuelle Key-Auswahl
            const manualSetting = manualArrayKeys.get(path);
            let commonKeys = null;

            if (manualSetting) {
                if (manualSetting.mode === 'none') {
                    // Erzwinge Index-basierten Vergleich - skip to MODUS 2
                    commonKeys = null;
                } else if (manualSetting.mode === 'manual' && manualSetting.keys) {
                    // Manuell gewählte Keys (Array)
                    commonKeys = manualSetting.keys;
                }
            } else {
                // Auto-Modus: findCommonKeys() verwenden
                commonKeys = findCommonKeys(arrA, arrB);
            }

            if (commonKeys && commonKeys.length > 0) {
                // MODUS 1: KEY-BASIERTER VERGLEICH (mit zusammengesetzten Keys)
                const objectsA = arrA.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));
                const objectsB = arrB.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));

                // Hilfsfunktion: Zusammengesetzten Key-String aus Objekt erstellen
                const getCompositeKey = (obj) => {
                    return commonKeys.map(k => String(obj[k] ?? '')).join('|||');
                };

                // Hilfsfunktion: Pfad-Segment für zusammengesetzte Keys erstellen
                const getKeyPathSegment = (obj) => {
                    return commonKeys.map(k => `${k}=${obj[k]}`).join(',');
                };

                // Erstelle Maps für schnellen Zugriff
                const mapA = new Map();
                const mapB = new Map();

                objectsA.forEach((obj, idx) => {
                    const compositeKey = getCompositeKey(obj);
                    // Nur hinzufügen wenn alle Keys vorhanden sind
                    const allKeysPresent = commonKeys.every(k => obj[k] !== undefined);
                    if (allKeysPresent) {
                        mapA.set(compositeKey, { obj, idx });
                    }
                });

                objectsB.forEach((obj, idx) => {
                    const compositeKey = getCompositeKey(obj);
                    const allKeysPresent = commonKeys.every(k => obj[k] !== undefined);
                    if (allKeysPresent) {
                        mapB.set(compositeKey, { obj, idx });
                    }
                });

                // Alle eindeutigen zusammengesetzten Key-Werte sammeln
                const allKeyValues = new Set([...mapA.keys(), ...mapB.keys()]);

                for (const compositeKey of allKeyValues) {
                    const entryA = mapA.get(compositeKey);
                    const entryB = mapB.get(compositeKey);

                    if (!entryA) {
                        // Objekt nur in B vorhanden
                        if (isPropertySelected(path)) {
                            const itemPath = `${path}[${getKeyPathSegment(entryB.obj)}]`;
                            differences.push({ type: 'added', path: itemPath, valueB: entryB.obj });
                        }
                    } else if (!entryB) {
                        // Objekt nur in A vorhanden
                        if (isPropertySelected(path)) {
                            const itemPath = `${path}[${getKeyPathSegment(entryA.obj)}]`;
                            differences.push({ type: 'removed', path: itemPath, valueA: entryA.obj });
                        }
                    } else {
                        // Beide vorhanden: rekursiv vergleichen
                        const itemPath = `${path}[${getKeyPathSegment(entryA.obj)}]`;
                        const nestedDiffs = findDifferences(entryA.obj, entryB.obj, itemPath);
                        differences.push(...nestedDiffs);
                    }
                }
                return differences;
            }

            // MODUS 2: STRUKTURELLER VERGLEICH (Fallback wenn kein gemeinsamer Key)
            const maxLen = Math.max(arrA.length, arrB.length);

            for (let i = 0; i < maxLen; i++) {
                const itemA = arrA[i];
                const itemB = arrB[i];
                const itemPath = `${path}[${i}]`;

                if (itemA === undefined) {
                    // Element nur in B vorhanden
                    if (isPropertySelected(path)) {
                        differences.push({ type: 'added', path: itemPath, valueB: itemB });
                    }
                } else if (itemB === undefined) {
                    // Element nur in A vorhanden
                    if (isPropertySelected(path)) {
                        differences.push({ type: 'removed', path: itemPath, valueA: itemA });
                    }
                } else if (typeof itemA === 'object' && typeof itemB === 'object') {
                    // Beide sind Objekte: rekursiv vergleichen
                    const nestedDiffs = findDifferences(itemA, itemB, itemPath);
                    differences.push(...nestedDiffs);
                } else if (itemA !== itemB && isPropertySelected(itemPath)) {
                    // Primitive Werte unterschiedlich
                    differences.push({ type: 'changed', path: itemPath, valueA: itemA, valueB: itemB });
                }
            }
            return differences;
        }

        // MODUS 3: Mengen-Vergleich (Original-Logik)
        // Nur wenn das Array selbst ausgewählt ist
        if (!isPropertySelected(path)) return differences;

        const serialize = (val) => JSON.stringify(val);
        const setB = new Set(arrB.map(serialize));
        const setA = new Set(arrA.map(serialize));

        arrA.forEach((item, index) => {
            const serialized = serialize(item);
            if (!setB.has(serialized)) {
                differences.push({
                    type: 'removed',
                    path: `${path}[${index}]`,
                    valueA: item
                });
            }
        });

        arrB.forEach((item, index) => {
            const serialized = serialize(item);
            if (!setA.has(serialized)) {
                differences.push({
                    type: 'added',
                    path: `${path}[${index}]`,
                    valueB: item
                });
            }
        });

        return differences;
    }

    /**
     * Hauptfunktion: Vergleicht zwei JSON-Objekte rekursiv und findet alle Unterschiede.
     *
     * Die Funktion berücksichtigt die Property-Auswahl:
     * - shouldProcessProperty: Entscheidet ob eine Property überhaupt durchlaufen wird
     * - isPropertySelected (shouldReport): Entscheidet ob ein Unterschied gemeldet wird
     *
     * Diese Trennung ermöglicht es, durch "user" zu traversieren um "user.email"
     * zu erreichen, auch wenn "user" selbst nicht ausgewählt ist.
     *
     * Unterschiedstypen:
     * - 'added': Property nur in B vorhanden
     * - 'removed': Property nur in A vorhanden
     * - 'changed': Property in beiden, aber unterschiedliche Werte
     *
     * @param {Object} objA - Objekt aus JSON A
     * @param {Object} objB - Objekt aus JSON B
     * @param {string} path - Aktueller Pfad (für Rekursion, z.B. "user.address")
     * @returns {Array} Liste der gefundenen Unterschiede
     */
    function findDifferences(objA, objB, path) {
        const differences = [];

        // Arrays werden separat behandelt
        if (Array.isArray(objA) && Array.isArray(objB)) {
            return compareArrays(objA, objB, path);
        }

        // Alle Keys aus beiden Objekten sammeln
        const allKeys = new Set([
            ...Object.keys(objA || {}),
            ...Object.keys(objB || {})
        ]);

        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;

            // Skip wenn Property weder ausgewählt noch Kind-Properties hat
            if (!shouldProcessProperty(currentPath)) continue;

            const valueA = objA ? objA[key] : undefined;
            const valueB = objB ? objB[key] : undefined;

            // shouldReport: Soll dieser Unterschied gemeldet werden?
            // (true wenn die Property selbst ausgewählt ist)
            const shouldReport = isPropertySelected(currentPath);

            // Fall 1: Property nur in B (hinzugefügt)
            if (!(key in (objA || {}))) {
                if (shouldReport) {
                    differences.push({
                        type: 'added',
                        path: currentPath,
                        valueB: valueB
                    });
                }
            }
            // Fall 2: Property nur in A (entfernt)
            else if (!(key in (objB || {}))) {
                if (shouldReport) {
                    differences.push({
                        type: 'removed',
                        path: currentPath,
                        valueA: valueA
                    });
                }
            }
            // Fall 3: Unterschiedliche Typen
            else if (typeof valueA !== typeof valueB) {
                if (shouldReport) {
                    differences.push({
                        type: 'changed',
                        path: currentPath,
                        valueA: valueA,
                        valueB: valueB
                    });
                }
            }
            // Fall 4: Beide sind Arrays → delegieren an compareArrays
            else if (Array.isArray(valueA) && Array.isArray(valueB)) {
                const arrayDiffs = compareArrays(valueA, valueB, currentPath);
                differences.push(...arrayDiffs);
            }
            // Fall 5: Beide sind Objekte → rekursiv weitermachen
            else if (typeof valueA === 'object' && valueA !== null && valueB !== null) {
                const nestedDiffs = findDifferences(valueA, valueB, currentPath);
                differences.push(...nestedDiffs);
            }
            // Fall 6: Primitive Werte unterschiedlich
            else if (valueA !== valueB) {
                if (shouldReport) {
                    differences.push({
                        type: 'changed',
                        path: currentPath,
                        valueA: valueA,
                        valueB: valueB
                    });
                }
            }
        }

        return differences;
    }

    function displayDifferences(differences) {
        diffResult.innerHTML = '';
        allCollapsed = true;
        toggleAllBtn.innerHTML = '<span class="styled-btn-inner">Alle aufklappen</span>';
        currentFilter = 'all';

        const nameA = aliasA.value.trim() || 'A';
        const nameB = aliasB.value.trim() || 'B';

        updateFilterCounts(differences);

        if (differences.length === 0) {
            diffResult.innerHTML = '<div class="no-diff">Keine Unterschiede gefunden - Die JSON-Daten sind identisch.</div>';
            return;
        }

        differences.forEach(diff => {
            diffResult.appendChild(createDiffLineElement(diff, nameA, nameB));
        });
    }

    function formatValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${escapeHtml(value)}"`;
        if (typeof value === 'object') {
            return escapeHtml(JSON.stringify(value, null, 2));
        }
        return String(value);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        diffResult.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
    }

    function formatSingleJSON(targetId) {
        const textarea = document.getElementById(targetId);
        const highlight = targetId === 'jsonA' ? highlightA : highlightB;
        const lineNumbers = targetId === 'jsonA' ? lineNumbersA : lineNumbersB;
        const label = targetId === 'jsonA' ? 'A' : 'B';

        try {
            if (textarea.value.trim()) {
                const json = JSON.parse(textarea.value);
                textarea.value = JSON.stringify(json, null, 2);
                updateHighlight(textarea, highlight, lineNumbers);
            }
        } catch (e) {
            showError(`JSON ${label} ist ungültig: ` + e.message);
        }
    }
});
