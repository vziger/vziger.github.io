const SHOWCASE_CATEGORY_LABELS = {
    perception: "Восприятие",
    attention: "Внимание",
    thinking: "Мышление",
    memory: "Память",
    reading: "Чтение",
    counting: "Счёт",
};

function ready_showcase() {
    const cells = document.querySelectorAll(".showcase-cell");
    const filterTags = document.querySelectorAll(".showcase-filter-tag");
    const clearButton = document.querySelector(".showcase-filter-clear");
    const statusElement = document.querySelector(".showcase-filter-status");
    const activeCategories = new Set();

    function getCategoryLabel(category) {
        return SHOWCASE_CATEGORY_LABELS[category] || category;
    }

    function getStatusLabels() {
        return Array.from(activeCategories).map(getCategoryLabel);
    }

    function applyFilter() {
        let visibleCount = 0;
        const showAll = activeCategories.size === 0;

        cells.forEach((cell) => {
            const matches = showAll || activeCategories.has(cell.dataset.category);
            cell.hidden = !matches;
            if (matches) {
                visibleCount += 1;
            }
        });

        filterTags.forEach((button) => {
            const category = button.dataset.category || "";
            const isAllButton = category === "";
            const isActive = isAllButton
                ? showAll
                : activeCategories.has(category);

            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        if (clearButton) {
            clearButton.hidden = showAll;
        }

        if (statusElement) {
            if (showAll) {
                statusElement.textContent = `Показано: ${visibleCount}`;
            } else {
                statusElement.textContent = `Показано: ${visibleCount} — ${getStatusLabels().join(", ")}`;
            }
        }
    }

    function resetFilter() {
        activeCategories.clear();
        applyFilter();
    }

    function toggleCategory(category) {
        if (!category) {
            resetFilter();
            return;
        }

        if (activeCategories.size === 0) {
            activeCategories.add(category);
        } else if (activeCategories.has(category)) {
            activeCategories.delete(category);
        } else {
            activeCategories.add(category);
        }

        applyFilter();
    }

    filterTags.forEach((button) => {
        button.addEventListener("click", () => {
            toggleCategory(button.dataset.category || "");
        });
    });

    if (clearButton) {
        clearButton.addEventListener("click", resetFilter);
    }

    applyFilter();
}
