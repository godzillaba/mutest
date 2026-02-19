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

Example output:

```
[KILLED]   #1 DeleteExpressionMutation src/Counter.sol
[KILLED]   #2 AssignmentMutation src/Counter.sol
[SURVIVED] #3 AssignmentMutation src/Counter.sol

3 mutants tested: 2 killed, 1 survived
```

## Requirements

- [Foundry](https://getfoundry.sh/) (`forge`)
- [Gambit](https://github.com/Certora/gambit) (`gambit`)
- `solc` in PATH
- Node.js >= 18
