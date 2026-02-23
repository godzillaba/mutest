#!/usr/bin/env -S npx tsx
import { execFile as execFileCb } from "child_process";
import { readFile, writeFile, cp, rm, readdir } from "fs/promises";
import { promisify } from "util";
import { join } from "path";

const execFile = promisify(execFileCb);

interface Mutant {
  id: string;
  description: string;
  name: string;
  original: string;
}

async function setupWorkers(workerCount: number): Promise<string> {
  const { stdout: tempDir } = await execFile("mktemp", ["-d"]);
  const root = tempDir.trim();
  const cwd = process.cwd()

  const workers = Array.from({ length: workerCount }, (_, i) => {
    const dir = `${root}/worker-${i}`;
    return execFile("bash", [
      "-c",
      `mkdir -p "${dir}" && git ls-files -z --cached --others --exclude-standard | tar -c --null -T - | tar -x -C "${dir}" && ln -s ${cwd}/node_modules ${dir}/node_modules && ln -s ${cwd}/lib ${dir}/lib`,
    ]);
  });
  await Promise.all(workers);
  return root;
}

async function runGambit(solFiles: string[], concurrency: number): Promise<Mutant[]> {
  await rm("gambit_out", { recursive: true, force: true });
  const { stdout: remappingsRaw } = await execFile("forge", ["remappings"]);
  const remappings = remappingsRaw.trim().replaceAll('/=', '=').split("\n").filter(Boolean);
  const remapArgs = remappings.flatMap((r) => ["--solc_remappings", r]);

  const results: Mutant[] = [];
  const pending = [...solFiles];

  async function worker() {
    while (pending.length > 0) {
      const file = pending.shift()!;
      const outdir = `gambit_out/${file}`;
      await execFile("gambit", [
        "mutate", "--filename", file, "--outdir", outdir, ...remapArgs,
      ]);
      const raw = await readFile(`${outdir}/gambit_results.json`, "utf-8");
      const mutants: Mutant[] = JSON.parse(raw);
      results.push(...mutants);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function processMutants(
  tempDir: string,
  mutants: Mutant[],
  workerCount: number,
) {
  const queues: Mutant[][] = Array.from({ length: workerCount }, () => []);
  for (let i = 0; i < mutants.length; i++)
    queues[i % workerCount].push(mutants[i]);

  let done = 0;
  const survivors: Mutant[] = [];

  const workers = queues.map(async (queue, workerIdx) => {
    const workerDir = `${tempDir}/worker-${workerIdx}`;
    for (const mutant of queue) {
      const dest = `${workerDir}/${mutant.original}`;
      const backup = `${dest}.orig`;
      await cp(dest, backup);
      await cp(`gambit_out/${mutant.original}/${mutant.name}`, dest);
      try {
        await execFile("forge", ["test", "--optimize", "false", "--root", workerDir]);
        survivors.push(mutant);
      } catch {}
      await cp(backup, dest);
      done++;
      console.log(`${done}/${mutants.length} tested`);
    }
  });

  await Promise.all(workers);
  const killed = mutants.length - survivors.length;
  console.log(`\n\n${killed} killed, ${survivors.length} survived`);
  await writeFile("gambit_out/survivors.json", JSON.stringify(survivors, null, 2) + "\n");
  console.log(`Wrote survivors.json`);
}

async function findJsonFiles(dir: string, name: string): Promise<string[]> {
  const results: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await findJsonFiles(full, name));
    else if (entry.name === name) results.push(full);
  }
  return results;
}

async function loadExistingMutants(): Promise<Mutant[]> {
  try {
    const raw = await readFile("gambit_out/survivors.json", "utf-8");
    const survivors: Mutant[] = JSON.parse(raw);
    if (survivors.length > 0) {
      console.log(`Found survivors.json, re-testing ${survivors.length} survivors...`);
      return survivors;
    }
  } catch {}
  const files = await findJsonFiles("gambit_out", "gambit_results.json");
  const all: Mutant[] = [];
  for (const f of files) {
    const raw = await readFile(f, "utf-8");
    all.push(...JSON.parse(raw));
  }
  return all;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let workers = 8;
  const solFiles: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workers" || args[i] === "-w") {
      workers = parseInt(args[++i], 10);
    } else {
      solFiles.push(args[i]);
    }
  }
  return { solFiles, workers };
}

async function main() {
  const { solFiles, workers: workerCount } = parseArgs();
  console.log(`Setting up ${workerCount} workers...`);
  const tempDir = await setupWorkers(workerCount);

  try {
    let mutants: Mutant[];
    if (solFiles.length > 0) {
      console.log(`Running gambit on ${solFiles.join(", ")}...`);
      mutants = await runGambit(solFiles, workerCount);
    } else {
      console.log("No files specified, using existing gambit_out/...");
      mutants = await loadExistingMutants();
    }
    console.log(`${mutants.length} mutants, running tests...\n`);
    await processMutants(tempDir, mutants, workerCount);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main();
