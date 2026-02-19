#!/usr/bin/env -S npx tsx
import { execFile as execFileCb } from "child_process";
import { readFile, cp, rm } from "fs/promises";
import { promisify } from "util";

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
      `mkdir -p "${dir}" && git ls-files -z | tar -c --null -T - | tar -x -C "${dir}" && ln -s ${cwd}/node_modules ${dir}/node_modules && ln -s ${cwd}/lib ${dir}/lib`,
    ]);
  });
  await Promise.all(workers);
  return root;
}

async function runGambit(solFiles: string[]): Promise<Mutant[]> {
  await rm("gambit_out", { recursive: true, force: true });
  const { stdout: remappingsRaw } = await execFile("forge", ["remappings"]);
  const remappings = remappingsRaw.trim().split("\n").filter(Boolean);
  const remapArgs = remappings.flatMap((r) => ["--solc_remappings", r]);
  for (const file of solFiles) {
    await execFile("gambit", ["mutate", "--filename", file, ...remapArgs]);
  }
  const raw = await readFile("gambit_out/gambit_results.json", "utf-8");
  return JSON.parse(raw);
}

async function processMutants(
  tempDir: string,
  mutants: Mutant[],
  workerCount: number,
) {
  const queues: Mutant[][] = Array.from({ length: workerCount }, () => []);
  for (let i = 0; i < mutants.length; i++)
    queues[i % workerCount].push(mutants[i]);

  let killed = 0;
  let survived = 0;

  const workers = queues.map(async (queue, workerIdx) => {
    const workerDir = `${tempDir}/worker-${workerIdx}`;
    for (const mutant of queue) {
      await cp(`gambit_out/${mutant.name}`, `${workerDir}/${mutant.original}`);
      try {
        await execFile("forge", ["test", "--optimize", "false", "--root", workerDir]);
        survived++;
        console.log(
          `[SURVIVED] #${mutant.id} ${mutant.description} ${mutant.original}`,
        );
      } catch {
        killed++;
        console.log(
          `[KILLED]   #${mutant.id} ${mutant.description} ${mutant.original}`,
        );
      }
    }
  });

  await Promise.all(workers);
  console.log(
    `\n${killed + survived} mutants tested: ${killed} killed, ${survived} survived`,
  );
}

async function main() {
  const solFiles = process.argv.slice(2);
  if (solFiles.length === 0) {
    console.error("Usage: mutest <sol-file> [sol-file ...]");
    process.exit(1);
  }

  const workerCount = 10;
  console.log(`Setting up ${workerCount} workers...`);
  const tempDir = await setupWorkers(workerCount);

  try {
    console.log(`Running gambit on ${solFiles.join(", ")}...`);
    const mutants = await runGambit(solFiles);
    console.log(`Generated ${mutants.length} mutants, running tests...\n`);
    await processMutants(tempDir, mutants, workerCount);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main();
