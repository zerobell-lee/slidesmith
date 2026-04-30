#!/usr/bin/env tsx
import { argv, exit } from 'node:process';

const subcommand = argv[2];

const commands: Record<string, () => Promise<void>> = {};

async function main(): Promise<void> {
  if (!subcommand || !commands[subcommand]) {
    console.error(`Usage: cli.ts <subcommand>\nKnown: ${Object.keys(commands).join(', ') || '(none yet)'}`);
    exit(1);
  }
  await commands[subcommand]();
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
