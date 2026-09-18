/**
 * Curated practice problems per roadmap topic: real, verified Codeforces problems used to
 * auto-grade topic completion (see js/roadmap.js isDone/practiceStatus). Sourced by targeted
 * research per topic - for each topic, real candidates were pulled from the live Codeforces API
 * (tag + rating filtered), cross-referenced against the topic own reference article for
 * problems it lists, and individually verified by reading the actual problem statement before
 * being accepted - never invented. Per-topic count = max(2, topic.hitScore).
 *
 * Topics with NO entry here (Contest Meta-Skills only) stay on the old manual-checkbox system -
 * see js/roadmap.js isDone(), which only uses this file data when a topic actually has an entry.
 *
 * A small number of entries marked confidence:"low" (and a few "medium") are best-effort fallback
 * picks (the closest reasonable match found within a bounded search) rather than a fully confirmed
 * fit - see each subject research summary for why.
 *
 * Cross-subject duplicate cleanup pass: every problem that had been independently picked as the
 * best fit by two different topics research passes was resolved to appear in exactly one topic
 * (the better-fitting one), with a freshly researched and verified replacement problem found for
 * the topic that lost its slot. Zero duplicate {contestId, index} pairs remain across all 283
 * problems. Also fixed: 5 dead (404) resource.url links in roadmap-data.js found during and after
 * research (usaco.guide moved/renamed several pages) - all 99 resource links now verified live.
 *
 * All 7 non-meta subjects complete: math, ds, graphs, dp, strings, greedy, geometry.
 * 90 topics, 283 problems total.
 */
const ROADMAP_PROBLEMS = {
  "math.modular-arithmetic": [
    {
      "contestId": 913,
      "index": "A",
      "name": "Modular Exponentiation",
      "rating": 900,
      "confidence": "high"
    },
    {
      "contestId": 630,
      "index": "A",
      "name": "Again Twenty Five!",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 1684,
      "index": "B",
      "name": "Z mod X = C",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 2084,
      "index": "A",
      "name": "Max and Mod",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 2039,
      "index": "A",
      "name": "Shohag Loves Mod",
      "rating": 800,
      "confidence": "high"
    }
  ],
  "math.gcd-extended-euclid": [
    {
      "contestId": 1325,
      "index": "A",
      "name": "EhAb AnD gCd",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 1370,
      "index": "A",
      "name": "Maximum GCD",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 1389,
      "index": "A",
      "name": "LCM Problem",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 7,
      "index": "C",
      "name": "Line",
      "rating": 1800,
      "confidence": "high"
    }
  ],
  "math.sieve-factorization": [
    {
      "contestId": 26,
      "index": "A",
      "name": "Almost Prime",
      "rating": 900,
      "confidence": "high"
    },
    {
      "contestId": 17,
      "index": "A",
      "name": "Noldbach problem",
      "rating": 1000,
      "confidence": "high"
    },
    {
      "contestId": 776,
      "index": "B",
      "name": "Sherlock and his girlfriend",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 230,
      "index": "B",
      "name": "T-primes",
      "rating": 1300,
      "confidence": "high"
    }
  ],
  "math.basic-combinatorics": [
    {
      "contestId": 1771,
      "index": "A",
      "name": "Hossam and Combinatorics",
      "rating": 900,
      "confidence": "high"
    },
    {
      "contestId": 1582,
      "index": "B",
      "name": "Luntik and Subsequences",
      "rating": 900,
      "confidence": "high"
    },
    {
      "contestId": 1827,
      "index": "A",
      "name": "Counting Orders",
      "rating": 1100,
      "confidence": "high"
    },
    {
      "contestId": 459,
      "index": "B",
      "name": "Pashmak and Flowers",
      "rating": 1300,
      "confidence": "high"
    }
  ],
  "math.modular-combinatorics": [
    {
      "contestId": 1433,
      "index": "E",
      "name": "Two Round Dances",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 1795,
      "index": "D",
      "name": "Triangle Coloring",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 1288,
      "index": "C",
      "name": "Two Arrays",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 1462,
      "index": "E1",
      "name": "Close Tuples (easy version)",
      "rating": 1500,
      "confidence": "high"
    }
  ],
  "math.inclusion-exclusion": [
    {
      "contestId": 1750,
      "index": "D",
      "name": "Count GCD",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 1228,
      "index": "E",
      "name": "Another Filling the Grid",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 1329,
      "index": "B",
      "name": "Dreamoon Likes Sequences",
      "rating": 1700,
      "confidence": "low"
    }
  ],
  "math.crt": [
    {
      "contestId": 2217,
      "index": "C",
      "name": "Grid Covering",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 687,
      "index": "B",
      "name": "Remainders Game",
      "rating": 1800,
      "confidence": "high"
    }
  ],
  "math.totient": [
    {
      "contestId": 776,
      "index": "E",
      "name": "The Holmes Children",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 915,
      "index": "G",
      "name": "Coprime Arrays",
      "rating": 2300,
      "confidence": "high"
    }
  ],
  "math.probability-ev": [
    {
      "contestId": 453,
      "index": "A",
      "name": "Little Pony and Expected Maximum",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 518,
      "index": "D",
      "name": "Ilya and Escalator",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 235,
      "index": "B",
      "name": "Let's Play Osu!",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "math.matrix-exponentiation": [
    {
      "contestId": 222,
      "index": "E",
      "name": "Decoding Genome",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 852,
      "index": "B",
      "name": "Neural Network country",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 1117,
      "index": "D",
      "name": "Magic Gems",
      "rating": 2100,
      "confidence": "high"
    }
  ],
  "math.game-theory-nim": [
    {
      "contestId": 2239,
      "index": "A",
      "name": "Nim Game Is XOR Game",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 15,
      "index": "C",
      "name": "Industrial Nim",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "math.fft-ntt": [
    {
      "contestId": 954,
      "index": "I",
      "name": "Yet Another String Matching Problem",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 1096,
      "index": "G",
      "name": "Lucky Tickets",
      "rating": 2400,
      "confidence": "high"
    }
  ],
  "math.generating-functions": [
    {
      "contestId": 438,
      "index": "E",
      "name": "The Child and Binary Tree",
      "rating": 3100,
      "confidence": "high"
    },
    {
      "contestId": 1349,
      "index": "D",
      "name": "Slime and Biscuits",
      "rating": 3200,
      "confidence": "high"
    }
  ],
  "math.xor-basis": [
    {
      "contestId": 895,
      "index": "C",
      "name": "Square Subsets",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 1100,
      "index": "F",
      "name": "Ivan and Burgers",
      "rating": 2500,
      "confidence": "high"
    }
  ],
  "math.mobius": [
    {
      "contestId": 803,
      "index": "F",
      "name": "Coprime Subsequences",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 1900,
      "index": "D",
      "name": "Small GCD",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "ds.stl-basics": [
    {
      "contestId": 1003,
      "index": "A",
      "name": "Polycarp's Pockets",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 339,
      "index": "A",
      "name": "Helpful Maths",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 1703,
      "index": "B",
      "name": "ICPC Balloons",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 158,
      "index": "B",
      "name": "Taxi",
      "rating": 1100,
      "confidence": "high"
    },
    {
      "contestId": 71,
      "index": "A",
      "name": "Way Too Long Words",
      "rating": 800,
      "confidence": "high"
    }
  ],
  "ds.arrays-prefix-sums": [
    {
      "contestId": 1006,
      "index": "C",
      "name": "Three Parts of the Array",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 1364,
      "index": "A",
      "name": "XXXXX",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 295,
      "index": "A",
      "name": "Greg and Array",
      "rating": 1400,
      "confidence": "high"
    },
    {
      "contestId": 816,
      "index": "B",
      "name": "Karen and Coffee",
      "rating": 1400,
      "confidence": "high"
    },
    {
      "contestId": 466,
      "index": "C",
      "name": "Number of Ways",
      "rating": 1700,
      "confidence": "high"
    }
  ],
  "ds.stacks-queues-monotonic": [
    {
      "contestId": 612,
      "index": "C",
      "name": "Replace To Make Regular Bracket Sequence",
      "rating": 1400,
      "confidence": "high"
    },
    {
      "contestId": 1795,
      "index": "C",
      "name": "Tea Tasting",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 280,
      "index": "B",
      "name": "Maximum Xor Secondary",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 5,
      "index": "C",
      "name": "Longest Regular Bracket Sequence",
      "rating": 1900,
      "confidence": "high"
    }
  ],
  "ds.priority-queue": [
    {
      "contestId": 960,
      "index": "B",
      "name": "Minimize the error",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 1106,
      "index": "D",
      "name": "Lunar New Year and a Wander",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 681,
      "index": "C",
      "name": "Heap Operations",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 1526,
      "index": "C2",
      "name": "Potions (Hard Version)",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 962,
      "index": "D",
      "name": "Merge Equals",
      "rating": 1600,
      "confidence": "high"
    }
  ],
  "ds.dsu": [
    {
      "contestId": 1620,
      "index": "A",
      "name": "Equal or Not Equal",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 1829,
      "index": "E",
      "name": "The Lakes",
      "rating": 1100,
      "confidence": "high"
    },
    {
      "contestId": 217,
      "index": "A",
      "name": "Ice Skating",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 977,
      "index": "E",
      "name": "Cyclic Components",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 25,
      "index": "D",
      "name": "Roads not only in Berland",
      "rating": 1900,
      "confidence": "high"
    }
  ],
  "ds.fenwick": [
    {
      "contestId": 1234,
      "index": "D",
      "name": "Distinct Characters Queries",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 459,
      "index": "D",
      "name": "Pashmak and Parmida's problem",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 220,
      "index": "B",
      "name": "Little Elephant and Array",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 61,
      "index": "E",
      "name": "Enemy is weak",
      "rating": 1900,
      "confidence": "high"
    }
  ],
  "ds.segment-tree": [
    {
      "contestId": 356,
      "index": "A",
      "name": "Knight Tournament",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 339,
      "index": "D",
      "name": "Xenia and Bit Operations",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 482,
      "index": "B",
      "name": "Interesting Array",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 380,
      "index": "C",
      "name": "Sereja and Brackets",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 474,
      "index": "F",
      "name": "Ant colony",
      "rating": 2100,
      "confidence": "high"
    }
  ],
  "ds.lazy-propagation": [
    {
      "contestId": 242,
      "index": "E",
      "name": "XOR on Segment",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 52,
      "index": "C",
      "name": "Circular RMQ",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 915,
      "index": "E",
      "name": "Physical Education Lessons",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 817,
      "index": "F",
      "name": "MEX Queries",
      "rating": 2300,
      "confidence": "high"
    }
  ],
  "ds.sparse-table": [
    {
      "contestId": 1547,
      "index": "F",
      "name": "Array Stabilization (GCD version)",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 475,
      "index": "D",
      "name": "CGCDSSQ",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 514,
      "index": "D",
      "name": "R2D2 and Droid Army",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "ds.ordered-set": [
    {
      "contestId": 675,
      "index": "D",
      "name": "Tree Construction",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 1354,
      "index": "D",
      "name": "Multiset",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 785,
      "index": "E",
      "name": "Anton and Permutation",
      "rating": 2200,
      "confidence": "high"
    }
  ],
  "ds.sqrt-decomp-mo": [
    {
      "contestId": 617,
      "index": "E",
      "name": "XOR and Favorite Number",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 86,
      "index": "D",
      "name": "Powerful array",
      "rating": 2200,
      "confidence": "high"
    }
  ],
  "ds.persistent-segtree": [
    {
      "contestId": 813,
      "index": "E",
      "name": "Army Creation",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 840,
      "index": "D",
      "name": "Destiny",
      "rating": 2500,
      "confidence": "high"
    }
  ],
  "ds.segtree-beats": [
    {
      "contestId": 438,
      "index": "D",
      "name": "The Child and Sequence",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 679,
      "index": "E",
      "name": "Bear and Bad Powers of 42",
      "rating": 3100,
      "confidence": "high"
    }
  ],
  "ds.merge-sort-tree": [
    {
      "contestId": 558,
      "index": "E",
      "name": "A Simple Task",
      "rating": 2300,
      "confidence": "low"
    },
    {
      "contestId": 1000,
      "index": "F",
      "name": "One Occurrence",
      "rating": 2400,
      "confidence": "low"
    }
  ],
  "ds.link-cut-tree": [
    {
      "contestId": 117,
      "index": "E",
      "name": "Tree or not Tree",
      "rating": 2900,
      "confidence": "high"
    },
    {
      "contestId": 587,
      "index": "E",
      "name": "Duff as a Queen",
      "rating": 2900,
      "confidence": "high"
    }
  ],
  "graphs.bfs-dfs": [
    {
      "contestId": 862,
      "index": "B",
      "name": "Mahmoud and Ehab and the bipartiteness",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 893,
      "index": "C",
      "name": "Rumor",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 948,
      "index": "A",
      "name": "Protect Sheep",
      "rating": 900,
      "confidence": "high"
    },
    {
      "contestId": 500,
      "index": "A",
      "name": "New Year Transportation",
      "rating": 1000,
      "confidence": "high"
    },
    {
      "contestId": 1033,
      "index": "A",
      "name": "King Escape",
      "rating": 1000,
      "confidence": "high"
    }
  ],
  "graphs.tree-basics": [
    {
      "contestId": 115,
      "index": "A",
      "name": "Party",
      "rating": 900,
      "confidence": "high"
    },
    {
      "contestId": 913,
      "index": "B",
      "name": "Christmas Spruce",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 522,
      "index": "A",
      "name": "Reposts",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 1676,
      "index": "G",
      "name": "White-Black Balanced Subtrees",
      "rating": 1300,
      "confidence": "high"
    }
  ],
  "graphs.topo-sort": [
    {
      "contestId": 510,
      "index": "C",
      "name": "Fox And Names",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 919,
      "index": "D",
      "name": "Substring",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 928,
      "index": "C",
      "name": "Dependency management",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 1385,
      "index": "E",
      "name": "Directing Edges",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "graphs.dijkstra": [
    {
      "contestId": 601,
      "index": "A",
      "name": "The Two Routes",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 986,
      "index": "A",
      "name": "Fair",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 916,
      "index": "C",
      "name": "Jamie and Interesting Graph",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 20,
      "index": "C",
      "name": "Dijkstra?",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 545,
      "index": "E",
      "name": "Paths and Trees",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "graphs.bellman-ford": [
    {
      "contestId": 95,
      "index": "C",
      "name": "Volleyball",
      "rating": 1900,
      "confidence": "low"
    },
    {
      "contestId": 187,
      "index": "B",
      "name": "AlgoRace",
      "rating": 1800,
      "confidence": "low"
    },
    {
      "contestId": 1249,
      "index": "E",
      "name": "By Elevator or Stairs?",
      "rating": 1700,
      "confidence": "low"
    }
  ],
  "graphs.floyd-warshall": [
    {
      "contestId": 295,
      "index": "B",
      "name": "Greg and Graph",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 33,
      "index": "B",
      "name": "String Problem",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 25,
      "index": "C",
      "name": "Roads in Berland",
      "rating": 1900,
      "confidence": "high"
    }
  ],
  "graphs.01-bfs": [
    {
      "contestId": 1063,
      "index": "B",
      "name": "Labyrinth",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 877,
      "index": "D",
      "name": "Olya and Energy Drinks",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 173,
      "index": "B",
      "name": "Chamber of Secrets",
      "rating": 1800,
      "confidence": "high"
    }
  ],
  "graphs.flow-basics": [
    {
      "contestId": 546,
      "index": "E",
      "name": "Soldier and Traveling",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 498,
      "index": "C",
      "name": "Array and Operations",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 653,
      "index": "D",
      "name": "Delivery Bears",
      "rating": 2200,
      "confidence": "high"
    }
  ],
  "graphs.mst": [
    {
      "contestId": 160,
      "index": "D",
      "name": "Edges in MST",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 1245,
      "index": "D",
      "name": "Shichikuji and Power Grid",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 1133,
      "index": "F1",
      "name": "Spanning Tree with Maximum Degree",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 1242,
      "index": "B",
      "name": "0-1 MST",
      "rating": 1900,
      "confidence": "high"
    }
  ],
  "graphs.bridges-articulation": [
    {
      "contestId": 1986,
      "index": "F",
      "name": "Non-academic Problem",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 732,
      "index": "F",
      "name": "Tourist Reform",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 118,
      "index": "E",
      "name": "Bertown roads",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "graphs.scc": [
    {
      "contestId": 22,
      "index": "E",
      "name": "Scheme",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 427,
      "index": "C",
      "name": "Checkposts",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 999,
      "index": "E",
      "name": "Reachability from the Capital",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "graphs.lca": [
    {
      "contestId": 191,
      "index": "C",
      "name": "Fools and Roads",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 1328,
      "index": "E",
      "name": "Tree Queries",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 587,
      "index": "C",
      "name": "Duff in the Army",
      "rating": 2200,
      "confidence": "low"
    },
    {
      "contestId": 1714,
      "index": "G",
      "name": "Path Prefixes",
      "rating": 1700,
      "confidence": "high"
    }
  ],
  "graphs.functional-graphs": [
    {
      "contestId": 1020,
      "index": "B",
      "name": "Badge",
      "rating": 1000,
      "confidence": "high"
    },
    {
      "contestId": 702,
      "index": "E",
      "name": "Analysis of Pathes in Functional Graph",
      "rating": 2100,
      "confidence": "high"
    }
  ],
  "graphs.euler-path": [
    {
      "contestId": 1334,
      "index": "D",
      "name": "Minimum Euler Cycle",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 508,
      "index": "D",
      "name": "Tanya and Password",
      "rating": 2500,
      "confidence": "high"
    }
  ],
  "graphs.max-flow": [
    {
      "contestId": 1082,
      "index": "G",
      "name": "Petya and Graph",
      "rating": 2400,
      "confidence": "high"
    },
    {
      "contestId": 510,
      "index": "E",
      "name": "Fox And Dinner",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 78,
      "index": "E",
      "name": "Evacuation",
      "rating": 2300,
      "confidence": "high"
    }
  ],
  "graphs.mcmf": [
    {
      "contestId": 1437,
      "index": "C",
      "name": "Chef Monocarp",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 1913,
      "index": "E",
      "name": "Matrix Problem",
      "rating": 2400,
      "confidence": "high"
    }
  ],
  "graphs.bipartite-matching": [
    {
      "contestId": 1027,
      "index": "F",
      "name": "Session in BSU",
      "rating": 2400,
      "confidence": "high"
    },
    {
      "contestId": 852,
      "index": "D",
      "name": "Exploration plan",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 1470,
      "index": "D",
      "name": "Strange Housing",
      "rating": 2200,
      "confidence": "low"
    }
  ],
  "graphs.two-sat": [
    {
      "contestId": 776,
      "index": "D",
      "name": "The Door Problem",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 780,
      "index": "D",
      "name": "Innokenty and a Football League",
      "rating": 1900,
      "confidence": "high"
    }
  ],
  "graphs.hld": [
    {
      "contestId": 1254,
      "index": "D",
      "name": "Tree Queries",
      "rating": 2700,
      "confidence": "high"
    },
    {
      "contestId": 1017,
      "index": "G",
      "name": "The Tree",
      "rating": 3200,
      "confidence": "medium"
    }
  ],
  "graphs.centroid-decomposition": [
    {
      "contestId": 342,
      "index": "E",
      "name": "Xenia and Tree",
      "rating": 2400,
      "confidence": "high"
    },
    {
      "contestId": 715,
      "index": "C",
      "name": "Digit Tree",
      "rating": 2700,
      "confidence": "high"
    }
  ],
  "graphs.small-to-large": [
    {
      "contestId": 600,
      "index": "E",
      "name": "Lomsat gelral",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 1467,
      "index": "E",
      "name": "Distinctive Roots in a Tree",
      "rating": 2500,
      "confidence": "low"
    }
  ],
  "dp.recursion-backtracking": [
    {
      "contestId": 9,
      "index": "C",
      "name": "Hexadecimal's Numbers",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 1097,
      "index": "B",
      "name": "Petr and a Combination Lock",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 476,
      "index": "B",
      "name": "Dreamoon and WiFi",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 550,
      "index": "B",
      "name": "Preparing Olympiad",
      "rating": 1400,
      "confidence": "high"
    },
    {
      "contestId": 581,
      "index": "D",
      "name": "Three Logos",
      "rating": 1700,
      "confidence": "high"
    }
  ],
  "dp.dp-basics": [
    {
      "contestId": 698,
      "index": "A",
      "name": "Vacations",
      "rating": 1400,
      "confidence": "high"
    },
    {
      "contestId": 1195,
      "index": "C",
      "name": "Basketball Exercise",
      "rating": 1400,
      "confidence": "high"
    },
    {
      "contestId": 455,
      "index": "A",
      "name": "Boredom",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 706,
      "index": "C",
      "name": "Hard problem",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 977,
      "index": "F",
      "name": "Consecutive Subsequence",
      "rating": 1700,
      "confidence": "high"
    }
  ],
  "dp.interval-dp": [
    {
      "contestId": 607,
      "index": "B",
      "name": "Zuma",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 1509,
      "index": "C",
      "name": "The Sports Festival",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 149,
      "index": "D",
      "name": "Coloring Brackets",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 1132,
      "index": "F",
      "name": "Clear the String",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "dp.bitmask-dp": [
    {
      "contestId": 580,
      "index": "D",
      "name": "Kefa and Dishes",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 453,
      "index": "B",
      "name": "Little Pony and Harmony Chest",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 1102,
      "index": "F",
      "name": "Elongated Matrix",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 11,
      "index": "D",
      "name": "A Simple Task",
      "rating": 2200,
      "confidence": "high"
    }
  ],
  "dp.meet-in-the-middle": [
    {
      "contestId": 888,
      "index": "E",
      "name": "Maximum Subsequence",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 1006,
      "index": "F",
      "name": "Xor-Paths",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 585,
      "index": "D",
      "name": "Lizard Era: Beginning",
      "rating": 2300,
      "confidence": "high"
    }
  ],
  "dp.digit-dp": [
    {
      "contestId": 1036,
      "index": "C",
      "name": "Classy Numbers",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 628,
      "index": "D",
      "name": "Magic Numbers",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 55,
      "index": "D",
      "name": "Beautiful numbers",
      "rating": 2500,
      "confidence": "high"
    }
  ],
  "dp.tree-dp": [
    {
      "contestId": 682,
      "index": "C",
      "name": "Alyona and the Tree",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 219,
      "index": "D",
      "name": "Choosing Capital for Treeland",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 1092,
      "index": "F",
      "name": "Tree with Maximum Cost",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 1187,
      "index": "E",
      "name": "Tree Painting",
      "rating": 2100,
      "confidence": "high"
    }
  ],
  "dp.dp-ds-optimization": [
    {
      "contestId": 1061,
      "index": "C",
      "name": "Multiplicity",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 597,
      "index": "C",
      "name": "Subsequences",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 474,
      "index": "E",
      "name": "Pillars",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "dp.sos-dp": [
    {
      "contestId": 165,
      "index": "E",
      "name": "Compatible Numbers",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 449,
      "index": "D",
      "name": "Jzzhu and Numbers",
      "rating": 2400,
      "confidence": "high"
    }
  ],
  "dp.dc-optimization": [
    {
      "contestId": 833,
      "index": "B",
      "name": "The Bakery",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 321,
      "index": "E",
      "name": "Ciel and Gondolas",
      "rating": 2600,
      "confidence": "high"
    }
  ],
  "dp.cht": [
    {
      "contestId": 319,
      "index": "C",
      "name": "Kalila and Dimna in the Logging Industry",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 932,
      "index": "F",
      "name": "Escape Through Leaf",
      "rating": 2700,
      "confidence": "high"
    }
  ],
  "dp.knuth-opt": [
    {
      "contestId": 1101,
      "index": "F",
      "name": "Trucks and Cities",
      "rating": 2400,
      "confidence": "high"
    },
    {
      "contestId": 643,
      "index": "C",
      "name": "Levels and Regions",
      "rating": 2400,
      "confidence": "low"
    }
  ],
  "dp.slope-trick": [
    {
      "contestId": 713,
      "index": "C",
      "name": "Sonya and Problem Wihtout a Legend",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 865,
      "index": "D",
      "name": "Buy Low Sell High",
      "rating": 2400,
      "confidence": "high"
    }
  ],
  "strings.string-hashing": [
    {
      "contestId": 1800,
      "index": "D",
      "name": "Remove Two Letters",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 1045,
      "index": "I",
      "name": "Palindrome Pairs",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 1137,
      "index": "B",
      "name": "Camp Schedule",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 559,
      "index": "B",
      "name": "Equivalent Strings",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 1200,
      "index": "E",
      "name": "Compress Words",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "strings.kmp": [
    {
      "contestId": 1092,
      "index": "C",
      "name": "Prefixes and Suffixes",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 471,
      "index": "D",
      "name": "MUH and Cube Walls",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 432,
      "index": "D",
      "name": "Prefixes and Suffixes",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 808,
      "index": "G",
      "name": "Anthem of Berland",
      "rating": 2300,
      "confidence": "high"
    }
  ],
  "strings.z-function": [
    {
      "contestId": 126,
      "index": "B",
      "name": "Password",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 535,
      "index": "D",
      "name": "Tavas and Malekas",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 1984,
      "index": "D",
      "name": "''a'' String Problem",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "strings.trie": [
    {
      "contestId": 706,
      "index": "D",
      "name": "Vasiliy's Multiset",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 923,
      "index": "C",
      "name": "Perfect Security",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 1285,
      "index": "D",
      "name": "Dr. Evil Underscores",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 514,
      "index": "C",
      "name": "Watto and Mechanism",
      "rating": 2000,
      "confidence": "high"
    }
  ],
  "strings.manacher": [
    {
      "contestId": 1326,
      "index": "D2",
      "name": "Prefix-Suffix Palindrome (Hard version)",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 7,
      "index": "D",
      "name": "Palindrome Degree",
      "rating": 2200,
      "confidence": "high"
    },
    {
      "contestId": 245,
      "index": "H",
      "name": "Queries for Number of Palindromes",
      "rating": 1800,
      "confidence": "low"
    }
  ],
  "strings.aho-corasick": [
    {
      "contestId": 710,
      "index": "F",
      "name": "String Set Queries",
      "rating": 2400,
      "confidence": "high"
    },
    {
      "contestId": 963,
      "index": "D",
      "name": "Frequency of String",
      "rating": 2500,
      "confidence": "high"
    },
    {
      "contestId": 1400,
      "index": "F",
      "name": "x-prime Substrings",
      "rating": 2800,
      "confidence": "high"
    }
  ],
  "strings.suffix-array": [
    {
      "contestId": 149,
      "index": "E",
      "name": "Martian Strings",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 873,
      "index": "F",
      "name": "Forbidden Indices",
      "rating": 2400,
      "confidence": "high"
    }
  ],
  "strings.suffix-automaton": [
    {
      "contestId": 128,
      "index": "B",
      "name": "String",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 235,
      "index": "C",
      "name": "Cyclical Quest",
      "rating": 2700,
      "confidence": "high"
    }
  ],
  "strings.palindromic-tree": [
    {
      "contestId": 835,
      "index": "D",
      "name": "Palindromic characteristics",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 17,
      "index": "E",
      "name": "Palisection",
      "rating": 2900,
      "confidence": "low"
    }
  ],
  "greedy.sort-greedy": [
    {
      "contestId": 34,
      "index": "B",
      "name": "Sale",
      "rating": 900,
      "confidence": "high"
    },
    {
      "contestId": 1399,
      "index": "A",
      "name": "Remove Smallest",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 230,
      "index": "A",
      "name": "Dragons",
      "rating": 1000,
      "confidence": "high"
    },
    {
      "contestId": 1360,
      "index": "B",
      "name": "Honest Coach",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 160,
      "index": "A",
      "name": "Twins",
      "rating": 900,
      "confidence": "high"
    }
  ],
  "greedy.binary-search": [
    {
      "contestId": 1201,
      "index": "C",
      "name": "Maximum Median",
      "rating": 1400,
      "confidence": "high"
    },
    {
      "contestId": 706,
      "index": "B",
      "name": "Interesting drink",
      "rating": 1100,
      "confidence": "high"
    },
    {
      "contestId": 474,
      "index": "B",
      "name": "Worms",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 1352,
      "index": "C",
      "name": "K-th Not Divisible by n",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 1873,
      "index": "E",
      "name": "Building an Aquarium",
      "rating": 1100,
      "confidence": "high"
    }
  ],
  "greedy.two-pointers": [
    {
      "contestId": 2000,
      "index": "B",
      "name": "Seating in a Bus",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 1873,
      "index": "D",
      "name": "1D Eraser",
      "rating": 800,
      "confidence": "high"
    },
    {
      "contestId": 1840,
      "index": "C",
      "name": "Ski Resort",
      "rating": 1000,
      "confidence": "high"
    },
    {
      "contestId": 1691,
      "index": "B",
      "name": "Shoe Shuffling",
      "rating": 1000,
      "confidence": "high"
    },
    {
      "contestId": 1843,
      "index": "A",
      "name": "Sasha and Array Coloring",
      "rating": 800,
      "confidence": "high"
    }
  ],
  "greedy.coordinate-compression": [
    {
      "contestId": 600,
      "index": "B",
      "name": "Queries about less or equal elements",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 1000,
      "index": "C",
      "name": "Covered Points Count",
      "rating": 1700,
      "confidence": "high"
    },
    {
      "contestId": 1042,
      "index": "D",
      "name": "Petya and Array",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 1730,
      "index": "A",
      "name": "Planets",
      "rating": 800,
      "confidence": "low"
    }
  ],
  "greedy.exchange-argument": [
    {
      "contestId": 545,
      "index": "C",
      "name": "Woodcutters",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 276,
      "index": "C",
      "name": "Little Girl and Maximum Sum",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 479,
      "index": "C",
      "name": "Exams",
      "rating": 1400,
      "confidence": "high"
    }
  ],
  "greedy.pq-greedy": [
    {
      "contestId": 1526,
      "index": "C1",
      "name": "Potions (Easy Version)",
      "rating": 1500,
      "confidence": "high"
    },
    {
      "contestId": 1498,
      "index": "B",
      "name": "Box Fitting",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 85,
      "index": "B",
      "name": "Embassy Queue",
      "rating": 1800,
      "confidence": "high"
    }
  ],
  "greedy.matroid-greedy": [
    {
      "contestId": 1108,
      "index": "F",
      "name": "MST Unification",
      "rating": 2100,
      "confidence": "high"
    },
    {
      "contestId": 1909,
      "index": "C",
      "name": "Heavy Intervals",
      "rating": 1400,
      "confidence": "low"
    }
  ],
  "greedy.heuristic-greedy": [
    {
      "contestId": 2195,
      "index": "H",
      "name": "Codeforces Heuristic Contest 001",
      "rating": 2400,
      "confidence": "high"
    },
    {
      "contestId": 2201,
      "index": "G",
      "name": "Codeforces Heuristic Contest 1001",
      "rating": 3500,
      "confidence": "low"
    }
  ],
  "geometry.vectors-orientation": [
    {
      "contestId": 227,
      "index": "A",
      "name": "Where do I Turn?",
      "rating": 1300,
      "confidence": "high"
    },
    {
      "contestId": 749,
      "index": "B",
      "name": "Parallelogram is Back",
      "rating": 1200,
      "confidence": "high"
    },
    {
      "contestId": 1642,
      "index": "A",
      "name": "Hard Way",
      "rating": 800,
      "confidence": "medium"
    },
    {
      "contestId": 1468,
      "index": "F",
      "name": "Full Turn",
      "rating": 1700,
      "confidence": "medium"
    }
  ],
  "geometry.point-segment": [
    {
      "contestId": 1030,
      "index": "B",
      "name": "Vasya and Cornfield",
      "rating": 1100,
      "confidence": "high"
    },
    {
      "contestId": 593,
      "index": "B",
      "name": "Anton and Lines",
      "rating": 1600,
      "confidence": "high"
    },
    {
      "contestId": 1028,
      "index": "C",
      "name": "Rectangles",
      "rating": 1600,
      "confidence": "medium"
    }
  ],
  "geometry.line-sweep": [
    {
      "contestId": 612,
      "index": "D",
      "name": "The Union of k-Segments",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 2074,
      "index": "D",
      "name": "Counting Points",
      "rating": 1400,
      "confidence": "medium"
    },
    {
      "contestId": 1401,
      "index": "E",
      "name": "Divide Square",
      "rating": 2400,
      "confidence": "high"
    }
  ],
  "geometry.convex-hull": [
    {
      "contestId": 2172,
      "index": "I",
      "name": "Birthday",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 166,
      "index": "B",
      "name": "Polygons",
      "rating": 2100,
      "confidence": "medium"
    },
    {
      "contestId": 70,
      "index": "D",
      "name": "Professor's task",
      "rating": 2700,
      "confidence": "medium"
    }
  ],
  "geometry.polygon-area-picks": [
    {
      "contestId": 1030,
      "index": "D",
      "name": "Vasya and Triangle",
      "rating": 1800,
      "confidence": "high"
    },
    {
      "contestId": 1548,
      "index": "D1",
      "name": "Gregor and the Odd Cows (Easy)",
      "rating": 2300,
      "confidence": "high"
    },
    {
      "contestId": 340,
      "index": "B",
      "name": "Maximal Area Quadrilateral",
      "rating": 2100,
      "confidence": "medium"
    }
  ],
  "geometry.closest-pair": [
    {
      "contestId": 120,
      "index": "J",
      "name": "Minimum Sum",
      "rating": 1900,
      "confidence": "high"
    },
    {
      "contestId": 429,
      "index": "D",
      "name": "Tricky Function",
      "rating": 2200,
      "confidence": "high"
    }
  ],
  "geometry.rotating-calipers": [
    {
      "contestId": 55,
      "index": "E",
      "name": "Very simple problem",
      "rating": 2500,
      "confidence": "high"
    },
    {
      "contestId": 682,
      "index": "E",
      "name": "Alyona and Triangles",
      "rating": 2600,
      "confidence": "high"
    }
  ],
  "geometry.halfplane-intersection": [
    {
      "contestId": 280,
      "index": "A",
      "name": "Rectangle Puzzle",
      "rating": 2000,
      "confidence": "medium"
    },
    {
      "contestId": 1218,
      "index": "B",
      "name": "Guarding warehouses",
      "rating": 3000,
      "confidence": "low"
    }
  ],
  "geometry.circle-geometry": [
    {
      "contestId": 600,
      "index": "D",
      "name": "Area of Two Circles' Intersection",
      "rating": 2000,
      "confidence": "high"
    },
    {
      "contestId": 1,
      "index": "C",
      "name": "Ancient Berland Circus",
      "rating": 2100,
      "confidence": "high"
    }
  ]
};
