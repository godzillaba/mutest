# mutest

Mutation testing for Solidity. Uses [Gambit](https://github.com/Certora/gambit) to generate mutants and [Foundry](https://github.com/foundry-rs/foundry) to test them.

## Usage

```sh
npx @godzillaba/mutest src/Counter.sol
```

Pass one or more Solidity files. Mutest will:

1. Create 10 parallel copies of your project
2. Generate mutants with Gambit (e.g. `++` -> `--`, assignments replaced)
3. Run `forge test` against each mutant across the worker copies
4. Report which mutants were killed (tests caught them) or survived (coverage gap)

Surviving mutants are written to `gambit_out/survivors.json`.

### Re-testing survivors

Run without arguments to re-test only the survivors from a previous run:

```sh
npx @godzillaba/mutest
```

This reads `gambit_out/survivors.json` (or falls back to `gambit_out/gambit_results.json`) and re-runs the test suite against those mutants. Useful after improving your tests to check if previously surviving mutants are now caught.

## Requirements

- [Foundry](https://getfoundry.sh/) (`forge`)
- [Gambit](https://github.com/Certora/gambit) (`gambit`)
- `solc` in PATH
- Node.js >= 18
