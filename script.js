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

    let allCollapsed = false;
    let currentFilter = 'all';
    let propertyFilterValue = '';
    let lastDifferences = [];

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

    function compareArrays(arrA, arrB, path) {
        const differences = [];

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

    function findDifferences(objA, objB, path) {
        const differences = [];

        if (Array.isArray(objA) && Array.isArray(objB)) {
            return compareArrays(objA, objB, path);
        }

        const allKeys = new Set([
            ...Object.keys(objA || {}),
            ...Object.keys(objB || {})
        ]);

        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const valueA = objA ? objA[key] : undefined;
            const valueB = objB ? objB[key] : undefined;

            if (!(key in (objA || {}))) {
                differences.push({
                    type: 'added',
                    path: currentPath,
                    valueB: valueB
                });
            } else if (!(key in (objB || {}))) {
                differences.push({
                    type: 'removed',
                    path: currentPath,
                    valueA: valueA
                });
            } else if (typeof valueA !== typeof valueB) {
                differences.push({
                    type: 'changed',
                    path: currentPath,
                    valueA: valueA,
                    valueB: valueB
                });
            } else if (Array.isArray(valueA) && Array.isArray(valueB)) {
                const arrayDiffs = compareArrays(valueA, valueB, currentPath);
                differences.push(...arrayDiffs);
            } else if (typeof valueA === 'object' && valueA !== null && valueB !== null) {
                const nestedDiffs = findDifferences(valueA, valueB, currentPath);
                differences.push(...nestedDiffs);
            } else if (valueA !== valueB) {
                differences.push({
                    type: 'changed',
                    path: currentPath,
                    valueA: valueA,
                    valueB: valueB
                });
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
