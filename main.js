const state = {
    mode: "daily",
    difficulty: "easy",
    puzzle: null,
    fromStart: {},
    fromEnd: {},
    guesses: [],
    maxGuesses: 0,
    gameOver: false,
};

const streetLookup = buildStreetLookup(GRAPH);

const startStreetEl = document.getElementById("start-street");
const endStreetEl = document.getElementById("end-street");
const gameStatusEl = document.getElementById("game-status");
const guessForm = document.getElementById("guess-form");
const guessInput = document.getElementById("guess-input");
const guessButton = document.getElementById("guess-button");
const suggestionsMenu = document.getElementById("suggestions-menu");
const feedbackMessageEl = document.getElementById("feedback-message");
const solutionPathEl = document.getElementById("solution-path");
const guessHistoryEl = document.getElementById("guess-history");
const difficultySelect = document.getElementById("difficulty-select");
const dailyButton = document.getElementById("daily-button");
const randomButton = document.getElementById("random-button");
const shareButton = document.getElementById("share-button");

const map = L.map("map", { minZoom: 11, maxZoom: 19 });
map.attributionControl.addAttribution("Street data &copy; OpenStreetMap");
map.fitBounds([[41.889, -71.382], [41.991, -71.218]]);

const baseStreetLayer = L.layerGroup().addTo(map);
if (typeof GEOMETRY !== "undefined") {
    for (const name of Object.keys(GEOMETRY)) {
        L.polyline(GEOMETRY[name], {
            color: "#555555",
            weight: 1.5,
            opacity: 0.45,
            interactive: false,
        }).addTo(baseStreetLayer);
    }
}

const activeStreetLayer = L.featureGroup().addTo(map);

function renderStreet(name, color, permanentLabel = false) {
    if (typeof GEOMETRY === "undefined" || !GEOMETRY[name]) {
        return null;
    }

    const polyline = L.polyline(GEOMETRY[name], {
        color: color,
        weight: 5,
        opacity: 0.9,
    }).addTo(activeStreetLayer);

    polyline.bindTooltip(name, {
        permanent: permanentLabel,
        sticky: true,
        direction: "auto",
        opacity: 0.95
    });

    polyline.on("click", function (e) {
        polyline.openTooltip(e.latlng);
    });

    return polyline;
}

let currentSuggestionIndex = -1;

function closeSuggestions() {
    suggestionsMenu.innerHTML = "";
    suggestionsMenu.hidden = true;
    currentSuggestionIndex = -1;
}

function selectSuggestion(streetName) {
    guessInput.value = streetName;
    closeSuggestions();
    guessInput.focus();
}

function updateCurrentSuggestion(items) {
    items.forEach((item, index) => {
        if (index === currentSuggestionIndex) {
            item.classList.add("active");
            item.scrollIntoView({ block: "nearest" });
        } else {
            item.classList.remove("active");
        }
    });
}

function renderSuggestions(query) {
    const cleaned = query.trim().toLowerCase();
    suggestionsMenu.innerHTML = "";
    currentSuggestionIndex = -1;

    if (cleaned.length === 0) {
        suggestionsMenu.hidden = true;
        return;
    }

    const pool = Object.keys(GRAPH);

    const matches = pool.filter((street) =>
        street.toLowerCase().includes(cleaned)
    );

    matches.sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(cleaned);
        const bStarts = b.toLowerCase().startsWith(cleaned);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
    });

    if (matches.length === 0) {
        suggestionsMenu.hidden = true;
        return;
    }

    for (const street of matches.slice(0, 10)) {
        const li = document.createElement("li");
        li.textContent = street;

        li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectSuggestion(street);
        });

        suggestionsMenu.appendChild(li);
    }

    suggestionsMenu.hidden = false;
}

guessInput.addEventListener("input", (e) => {
    renderSuggestions(e.target.value);
});

guessInput.addEventListener("keydown", (e) => {
    const items = suggestionsMenu.querySelectorAll("li");
    if (items.length === 0 || suggestionsMenu.hidden) return;

    if (e.key === "ArrowDown") {
        e.preventDefault();
        currentSuggestionIndex = (currentSuggestionIndex + 1) % items.length;
        updateCurrentSuggestion(items);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        currentSuggestionIndex =
            currentSuggestionIndex <= 0 ? items.length - 1 : currentSuggestionIndex - 1;
        updateCurrentSuggestion(items);
    } else if (e.key === "Enter" && currentSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(items[currentSuggestionIndex].textContent);
    } else if (e.key === "Escape") {
        closeSuggestions();
    }
});

guessForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.gameOver) return;

    closeSuggestions();

    const input = guessInput.value.trim();
    const evaluation = evaluateGuess(
        input,
        state.puzzle,
        state,
        GRAPH,
        streetLookup
    );

    if (!evaluation.valid) {
        feedbackMessageEl.textContent = evaluation.error;
        feedbackMessageEl.style.color = "var(--red)";
        return;
    }

    feedbackMessageEl.textContent = "";
    state.guesses.push(evaluation);

    const streetColor =
        evaluation.color === "green"
            ? "#4caf6a"
            : evaluation.color === "yellow"
                ? "#e8b94a"
                : "#d9634f";

    const line = renderStreet(evaluation.name, streetColor);
    if (line && !map.getBounds().contains(line.getBounds())) {
        map.panTo(line.getBounds().getCenter(), { animate: true });
    }

    guessInput.value = "";
    updateStatusCard();
    renderGuessChips();

    if (isConnected(GRAPH, state.puzzle, state)) {
        handleGameOver(true);
    } else if (state.guesses.length >= state.maxGuesses) {
        handleGameOver(false);
    }
});

shareButton.addEventListener("click", () => {
    navigator.clipboard.writeText(generateShareText()).then(() => {
        shareButton.textContent = "Copied";
    });
});

function renderGuessChips() {
    guessHistoryEl.innerHTML = "";

    for (const guess of state.guesses) {
        let label = "Far off";
        if (guess.extra === 0) label = "On a shortest route";
        else if (guess.extra === 1) label = "Small detour";

        const chip = document.createElement("div");
        chip.className = `chip ${guess.color}`;

        const nameEl = document.createElement("strong");
        nameEl.textContent = guess.name;

        const labelEl = document.createElement("small");
        labelEl.textContent = label;

        chip.appendChild(nameEl);
        chip.appendChild(labelEl);
        guessHistoryEl.appendChild(chip);
    }
}

function handleGameOver(won) {
    state.gameOver = true;
    guessInput.disabled = true;
    guessButton.disabled = true;
    closeSuggestions();

    if (won) {
        const isOptimal = state.guesses.length === state.puzzle.hops - 1;
        feedbackMessageEl.textContent = isOptimal
            ? "Perfect route!"
            : "Connected! You made it.";
        feedbackMessageEl.style.color = "var(--green)";
    } else {
        feedbackMessageEl.textContent = "Out of guesses!";
        feedbackMessageEl.style.color = "var(--red)";
    }

    const optimalRoute = findShortestRoute(GRAPH, state.puzzle, state.fromEnd);
    solutionPathEl.textContent = `A shortest route: ${optimalRoute.join(" → ")}`;

    for (const street of optimalRoute) {
        const alreadyDrawn =
            street === state.puzzle.start ||
            street === state.puzzle.end ||
            state.guesses.some((g) => g.name === street);

        if (!alreadyDrawn) {
            renderStreet(street, "#8a5cd0", true);
        }
    }

    map.fitBounds(activeStreetLayer.getBounds(), { padding: [30, 30] });
    shareButton.hidden = false;
}

function generateShareText() {
    const squares = state.guesses
        .map((g) => {
            if (g.extra === 0) return "🟩";
            if (g.extra === 1) return "🟨";
            return "🟥";
        })
        .join("");

    const connected = isConnected(GRAPH, state.puzzle, state);
    const score = connected
        ? `${state.guesses.length}/${state.maxGuesses}`
        : `X/${state.maxGuesses}`;
    const modeLabel =
        state.mode === "daily" ? `Daily ${getTodaySeed()}` : "Random puzzle";

    return `Attleboro Streets - ${modeLabel}\n${state.puzzle.start} → ${state.puzzle.end}\n${squares} ${score}`;
}

document.addEventListener("click", (e) => {
    if (!guessInput.contains(e.target) && !suggestionsMenu.contains(e.target)) {
        closeSuggestions();
    }
});

function updateStatusCard() {
    startStreetEl.textContent = state.puzzle.start;
    endStreetEl.textContent = state.puzzle.end;

    const remaining = state.maxGuesses - state.guesses.length;
    gameStatusEl.textContent = `Shortest route: ${state.puzzle.hops - 1} street(s) in between. Guesses left: ${remaining}`;
}

function startNewGame(mode = "daily") {
    state.mode = mode;
    state.difficulty = difficultySelect.value;
    state.gameOver = false;
    state.guesses = [];

    const randomFn = mode === "daily" ? seededRandom(getTodaySeed()) : Math.random;
    const duplicates = typeof DUPLICATES !== "undefined" ? DUPLICATES : [];

    state.puzzle = createPuzzle(GRAPH, randomFn, duplicates, state.difficulty);
    state.fromStart = bfs(GRAPH, state.puzzle.start);
    state.fromEnd = bfs(GRAPH, state.puzzle.end);
    state.maxGuesses = state.puzzle.hops + 5;

    feedbackMessageEl.textContent = "";
    solutionPathEl.textContent = "";
    guessInput.value = "";
    guessInput.disabled = false;
    guessButton.disabled = false;
    shareButton.hidden = true;
    shareButton.textContent = "Copy Result";
    closeSuggestions();

    activeStreetLayer.clearLayers();
    const startLine = renderStreet(state.puzzle.start, "#3b6fd4", true);
    const endLine = renderStreet(state.puzzle.end, "#3b6fd4", true);

    if (startLine && endLine) {
        map.fitBounds(startLine.getBounds().extend(endLine.getBounds()), {
            padding: [30, 30],
        });
    }

    updateStatusCard();
    guessInput.focus();
}

difficultySelect.addEventListener("change", () => {
    startNewGame(state.mode);
});

dailyButton.addEventListener("click", () => startNewGame("daily"));
randomButton.addEventListener("click", () => startNewGame("random"));

startNewGame("daily");