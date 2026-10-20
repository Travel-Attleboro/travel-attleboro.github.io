function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getTodaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function bfs(graph, start) {
  const dist = {};
  dist[start] = 0;

  const queue = [start];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const neighbors = graph[current] || [];

    for (const next of neighbors) {
      if (dist[next] === undefined) {
        dist[next] = dist[current] + 1;
        queue.push(next);
      }
    }
  }

  return dist;
}

function shortenStreetName(name) {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bplace\b/g, "pl")
    .replace(/\bterrace\b/g, "ter")
    .replace(/\bcircle\b/g, "cir")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bparkway\b/g, "pkwy")
    .replace(/\bhighway\b/g, "hwy")
    .replace(/\bextension\b/g, "ext")
    .replace(/\s+/g, " ");
}

function buildStreetLookup(graph) {
  const lookup = {};
  for (const name of Object.keys(graph)) {
    const raw = name.trim().toLowerCase();
    const shorten = shortenStreetName(name);

    lookup[raw] = name;
    lookup[shorten] = name;
  }
  return lookup;
}

function isMajorRoad(graph, name) {
  const connections = graph[name] ? graph[name].length : 0;
  const isMinorSuffix = /(Court|Place|Circle|Way|Terrace)$/i.test(name);
  return connections >= 3 && !isMinorSuffix;
}

function getAvailableStreets(graph, duplicates = [], difficulty = "easy") {
  const allStreets = Object.keys(graph).filter(name => !duplicates.includes(name));
  if (difficulty === "all") {
    return allStreets;
  }

  return allStreets.filter(name => isMajorRoad(graph, name));
}

function createPuzzle(graph, randomFn, duplicates = [], difficulty = "easy") {
  const availableStreets = getAvailableStreets(graph, duplicates, difficulty);
  const minConnections = difficulty === "easy" ? 4 : 6;
  const maxConnections = difficulty === "easy" ? 7 : 13;

  while (true) {
    const startIndex = Math.floor(randomFn() * availableStreets.length);
    const start = availableStreets[startIndex];
    const dist = bfs(graph, start);

    const candidates = availableStreets.filter(street => {
      const hops = dist[street];
      return hops !== undefined && hops >= minConnections && hops <= maxConnections;
    });

    if (candidates.length > 0) {
      const endIndex = Math.floor(randomFn() * candidates.length);
      const end = candidates[endIndex];

      return {
        start: start,
        end: end,
        hops: dist[end]
      };
    }
  }
}

function findShortestRoute(graph, puzzle, fromEnd) {
  const route = [puzzle.start];
  let current = puzzle.start;

  while (current !== puzzle.end) {
    const neighbors = graph[current] || [];

    current = neighbors.find(next => fromEnd[next] === fromEnd[current] - 1);
    if (!current) {
      break;
    }

    route.push(current);
  }

  return route;
}

function isConnected(graph, puzzle, state) {
  const allowed = new Set([puzzle.start, puzzle.end]);
  for (const g of state.guesses) {
    allowed.add(g.name);
  }

  const visited = new Set([puzzle.start]);
  const queue = [puzzle.start];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];

    if (current === puzzle.end) {
      return true;
    }

    const neighbors = graph[current] || [];
    for (const next of neighbors) {
      if (allowed.has(next) && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

function evaluateGuess(inputName, puzzle, state, graph, lookup) {
  const guessedName = lookup[inputName.trim().toLowerCase()];
  if (!guessedName || !graph[guessedName]) {
    return {
      valid: false,
      error: "Unknown street name."
    };
  }

  const isStartOrEnd = [puzzle.start, puzzle.end].includes(guessedName);
  const alreadyGuessed = state.guesses.some(g => g.name === guessedName);
  if (isStartOrEnd || alreadyGuessed) {
    return {
      valid: false,
      error: "Street name already guessed."
    };
  }

  const extra = state.fromStart[guessedName] + state.fromEnd[guessedName] - puzzle.hops;

  let color = "red";
  if (extra === 0) {
    color = "green";
  } else if (extra === 1) {
    color = "yellow";
  }

  return {
    valid: true,
    name: guessedName,
    extra: extra,
    color: color
  };
}