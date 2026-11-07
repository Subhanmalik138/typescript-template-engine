#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { TemplateEngine, TemplateError, View } from "./engine";

const USAGE = `template-engine — render Mustache-style templates from the command line

Usage:
  template-engine render <template> <data.json> [--partials <dir>] [--output <file>]
  template-engine check <template> [<template> ...]
  template-engine --help

  <template>   Path to a .mustache template file, or "-" to read stdin.
  <data.json>  Path to a JSON file with the view, or "-" to read stdin.
  --partials  Directory of partial files; each file name (without
              extension) is a partial name.
  --output    Write the result to a file instead of stdout.
`;

function fail(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

function readInput(target: string): string {
  if (target === "-") return fs.readFileSync(0, "utf8");
  if (!fs.existsSync(target)) fail(`file not found: ${target}`);
  return fs.readFileSync(target, "utf8");
}

function loadPartials(dir: string): Record<string, string> {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    fail(`partials directory not found: ${dir}`);
  }
  const partials: Record<string, string> = {};
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (!fs.statSync(full).isFile()) continue;
    partials[path.basename(file, path.extname(file))] = fs.readFileSync(full, "utf8");
  }
  return partials;
}

function parseArgs(argv: string[]): { positionals: string[]; flags: Record<string, string> } {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`flag --${name} needs a value`);
      flags[name] = value;
      i++;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function main(): void {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const [command, ...rest] = positionals;
  const engine = new TemplateEngine();

  if (command === "render") {
    const [templatePath, dataPath] = rest;
    if (!templatePath || !dataPath) fail("render needs <template> and <data.json>");
    const template = readInput(templatePath);
    const rawData = readInput(dataPath);
    let view: unknown;
    try {
      view = JSON.parse(rawData);
    } catch {
      fail(`invalid JSON in ${dataPath}`);
    }
    const partials = flags.partials ? loadPartials(flags.partials) : {};
    let output: string;
    try {
      output = engine.render(template, view as unknown as View, { partials });
    } catch (err) {
      if (err instanceof TemplateError) fail(err.message);
      throw err;
    }
    if (flags.output) {
      fs.writeFileSync(flags.output, output);
    } else {
      process.stdout.write(output);
    }
    return;
  }

  if (command === "check") {
    if (rest.length === 0) fail("check needs at least one template file");
    let failed = false;
    for (const templatePath of rest) {
      try {
        engine.validate(readInput(templatePath));
        process.stdout.write(`ok: ${templatePath}\n`);
      } catch (err) {
        failed = true;
        process.stderr.write(`invalid: ${templatePath}: ${err instanceof Error ? err.message : err}\n`);
      }
    }
    process.exit(failed ? 1 : 0);
    return;
  }

  if (command === "--help" || command === "-h" || command === undefined) {
    process.stdout.write(USAGE);
    return;
  }

  fail(`unknown command: ${command}\n\n${USAGE}`);
}

main();
