# Optimized C++ Solver

This directory contains a stripped-down, performance-focused river solver. It targets CFR+, Linear CFR, and DCFR with alternating updates, a compact public tree, and vector-form showdown evaluation.

## Build

```sh
cmake -S cpp -B cpp/build
cmake --build cpp/build -j
```

To build with double-precision regrets/strategy sums, add `-DCFR_USE_DOUBLE=ON`:

```sh
cmake -S cpp -B cpp/build -DCFR_USE_DOUBLE=ON
cmake --build cpp/build -j
```

## Run

```sh
./cpp/build/river_solver_optimized --algo cfr+ --iters 2000
```
To load a subgame JSON file produced by the GUI, pass `--config path/to/subgame.json`.
