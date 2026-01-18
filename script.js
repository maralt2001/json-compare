document.addEventListener('DOMContentLoaded', function() {
    const jsonATextarea = document.getElementById('jsonA');
    const jsonBTextarea = document.getElementById('jsonB');
    const diffResult = document.getElementById('diffResult');
    const compareBtn = document.getElementById('compareBtn');
    const formatBtn = document.getElementById('formatBtn');
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

    let allCollapsed = false;
    let currentFilter = 'all';
    let propertyFilterValue = '';
    let lastDifferences = [];
    let selectedProperties = null; // null = alle vergleichen
    let allScannedProperties = []; // alle gescannten Properties mit Herkunft

    fileA.addEventListener('change', (e) => handleFileSelect(e.target.files[0], jsonATextarea));
    fileB.addEventListener('change', (e) => handleFileSelect(e.target.files[0], jsonBTextarea));

    clearSingleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const textarea = document.getElementById(targetId);
            const highlight = targetId === 'jsonA' ? highlightA : highlightB;
            textarea.value = '';
            updateHighlight(textarea, highlight);
            resetDiffState();
            resetPropertySelector();
        });
    });

    function resetDiffState() {
        diffResult.innerHTML = '';
        lastDifferences = [];
        allCollapsed = true;
        toggleAllBtn.textContent = 'Alle aufklappen';
        currentFilter = 'all';
        propertyFilterValue = '';
        propertyFilter.value = '';
        filterButtons.forEach(btn => {
            const filter = btn.dataset.filter;
            btn.classList.toggle('active', filter === 'all');
            const label = btn.textContent.split(' (')[0];
            btn.innerHTML = `${label} <span class="filter-count">(0)</span>`;
        });
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
            obj.forEach((item, index) => {
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
                if (prop.inA && prop.inB) {
                    item.classList.add('prop-both');
                } else if (prop.inA) {
                    item.classList.add('prop-only-a');
                } else {
                    item.classList.add('prop-only-b');
                }
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

            // Checkbox
            if (prop) {
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
                    }
                    // Auch alle Kind-Properties mit aktualisieren
                    if (hasChildren) {
                        toggleChildProperties(prop.path, e.target.checked);
                    }
                    updatePropertySelectorButtonText();
                });
                item.appendChild(checkbox);
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

    // Klick außerhalb schließt Dropdown
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.property-selector')) {
            propSelectorDropdown.classList.remove('open');
        }
    });

    copyBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.dataset.target;
            const textarea = document.getElementById(targetId);

            try {
                await navigator.clipboard.writeText(textarea.value);
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 1500);
            } catch (err) {
                textarea.select();
                document.execCommand('copy');
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 1500);
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

    jsonATextarea.addEventListener('input', () => updateHighlight(jsonATextarea, highlightA));
    jsonBTextarea.addEventListener('input', () => updateHighlight(jsonBTextarea, highlightB));
    jsonATextarea.addEventListener('scroll', () => syncScroll(jsonATextarea, highlightA));
    jsonBTextarea.addEventListener('scroll', () => syncScroll(jsonBTextarea, highlightB));

    function updateHighlight(textarea, highlight) {
        const text = textarea.value;
        highlight.innerHTML = highlightJSON(text);
    }

    function syncScroll(textarea, highlight) {
        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
    }

    function highlightJSON(text) {
        if (!text) return '';

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:')
            .replace(/:(\s*)("(?:[^"\\]|\\.)*")/g, ':$1<span class="json-string">$2</span>')
            .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
            .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
            .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
    }

    function setupDragAndDrop(textarea) {
        const container = textarea.closest('.container');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            container.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            container.addEventListener(event, () => {
                container.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(event => {
            container.addEventListener(event, () => {
                container.classList.remove('drag-over');
            });
        });

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
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                textarea.value = JSON.stringify(json, null, 2);
            } catch (err) {
                textarea.value = e.target.result;
                showError('Die Datei enthält kein gültiges JSON: ' + err.message);
            }
            updateHighlight(textarea, highlight);
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
    updateHighlight(jsonATextarea, highlightA);
    updateHighlight(jsonBTextarea, highlightB);

    compareBtn.addEventListener('click', compareJSON);
    formatBtn.addEventListener('click', formatJSON);
    toggleAllBtn.addEventListener('click', toggleAll);
    exportBtn.addEventListener('click', exportResults);
    exampleBtn.addEventListener('click', loadExample);

    function loadExample() {
        jsonATextarea.value = JSON.stringify(exampleA, null, 2);
        jsonBTextarea.value = JSON.stringify(exampleB, null, 2);
        updateHighlight(jsonATextarea, highlightA);
        updateHighlight(jsonBTextarea, highlightB);
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

        toggleAllBtn.textContent = allCollapsed ? 'Alle aufklappen' : 'Alle zuklappen';
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

        const removed = lastDifferences.filter(d => d.type === 'removed');
        const added = lastDifferences.filter(d => d.type === 'added');
        const changed = lastDifferences.filter(d => d.type === 'changed');

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

        // Normalisiere: Entferne Array-Indizes und prüfe erneut
        // z.B. "results[0].user.email" -> "results.user.email"
        const normalizedPath = path.replace(/\[\d+\]/g, '');
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

        // Normalisiere: Entferne Array-Indizes
        const normalizedPath = path.replace(/\[\d+\]/g, '');
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
     * Vergleicht zwei Arrays und findet Unterschiede.
     *
     * Es gibt zwei Vergleichs-Modi:
     *
     * 1. STRUKTURELLER VERGLEICH (positionsbasiert):
     *    Wenn das Array Objekte enthält UND Kind-Properties ausgewählt sind.
     *    Vergleicht Element für Element an der gleichen Position.
     *    Beispiel: results[0] mit results[0], results[1] mit results[1], etc.
     *    Ermöglicht Auswahl einzelner Felder wie "results.user.email".
     *
     * 2. MENGEN-VERGLEICH (vorhandensbasiert):
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

        // MODUS 1: Struktureller Vergleich für Objekt-Arrays mit Kind-Auswahl
        if ((hasObjectsA || hasObjectsB) && hasSelectedChildren(path)) {
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

        // MODUS 2: Mengen-Vergleich (Original-Logik)
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
        toggleAllBtn.textContent = 'Alle aufklappen';
        currentFilter = 'all';

        const nameA = aliasA.value.trim() || 'A';
        const nameB = aliasB.value.trim() || 'B';

        const counts = {
            all: differences.length,
            added: differences.filter(d => d.type === 'added').length,
            removed: differences.filter(d => d.type === 'removed').length,
            changed: differences.filter(d => d.type === 'changed').length
        };

        filterButtons.forEach(btn => {
            const filter = btn.dataset.filter;
            const count = counts[filter];
            btn.classList.toggle('active', filter === 'all');
            btn.innerHTML = `${btn.textContent.split(' (')[0]} <span class="filter-count">(${count})</span>`;
        });

        if (differences.length === 0) {
            diffResult.innerHTML = '<div class="no-diff">Keine Unterschiede gefunden - Die JSON-Daten sind identisch.</div>';
            return;
        }

        differences.forEach(diff => {
            const line = document.createElement('div');
            line.className = 'diff-line collapsed';

            let icon, hint;
            switch (diff.type) {
                case 'added':
                    line.classList.add('diff-added');
                    icon = '+';
                    hint = `(nur in ${nameB})`;
                    break;
                case 'removed':
                    line.classList.add('diff-removed');
                    icon = '-';
                    hint = `(nur in ${nameA})`;
                    break;
                case 'changed':
                    line.classList.add('diff-changed');
                    icon = '~';
                    hint = '';
                    break;
            }

            line.innerHTML = `
                <div class="diff-header">
                    <span class="diff-toggle"></span>
                    <span class="diff-path">${icon} ${diff.path}</span>
                    ${hint ? `<span class="diff-hint">${hint}</span>` : ''}
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

            const header = line.querySelector('.diff-header');
            header.addEventListener('click', () => {
                line.classList.toggle('collapsed');
            });

            diffResult.appendChild(line);
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

    function formatJSON() {
        try {
            if (jsonATextarea.value.trim()) {
                const jsonA = JSON.parse(jsonATextarea.value);
                jsonATextarea.value = JSON.stringify(jsonA, null, 2);
                updateHighlight(jsonATextarea, highlightA);
            }
        } catch (e) {
            showError('JSON A ist ungültig: ' + e.message);
            return;
        }

        try {
            if (jsonBTextarea.value.trim()) {
                const jsonB = JSON.parse(jsonBTextarea.value);
                jsonBTextarea.value = JSON.stringify(jsonB, null, 2);
                updateHighlight(jsonBTextarea, highlightB);
            }
        } catch (e) {
            showError('JSON B ist ungültig: ' + e.message);
            return;
        }
    }
});
