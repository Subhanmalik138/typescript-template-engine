#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const engine_1 = require("./engine");
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
function fail(message) {
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
}
function readInput(target) {
    if (target === "-")
        return fs.readFileSync(0, "utf8");
    if (!fs.existsSync(target))
        fail(`file not found: ${target}`);
    return fs.readFileSync(target, "utf8");
}
function loadPartials(dir) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        fail(`partials directory not found: ${dir}`);
    }
    const partials = {};
    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (!fs.statSync(full).isFile())
            continue;
        partials[path.basename(file, path.extname(file))] = fs.readFileSync(full, "utf8");
    }
    return partials;
}
function parseArgs(argv) {
    const positionals = [];
    const flags = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("--")) {
            const name = arg.slice(2);
            const value = argv[i + 1];
            if (value === undefined || value.startsWith("--"))
                fail(`flag --${name} needs a value`);
            flags[name] = value;
            i++;
        }
        else {
            positionals.push(arg);
        }
    }
    return { positionals, flags };
}
function main() {
    const { positionals, flags } = parseArgs(process.argv.slice(2));
    const [command, ...rest] = positionals;
    const engine = new engine_1.TemplateEngine();
    if (command === "render") {
        const [templatePath, dataPath] = rest;
        if (!templatePath || !dataPath)
            fail("render needs <template> and <data.json>");
        const template = readInput(templatePath);
        const rawData = readInput(dataPath);
        let view;
        try {
            view = JSON.parse(rawData);
        }
        catch {
            fail(`invalid JSON in ${dataPath}`);
        }
        const partials = flags.partials ? loadPartials(flags.partials) : {};
        let output;
        try {
            output = engine.render(template, view, { partials });
        }
        catch (err) {
            if (err instanceof engine_1.TemplateError)
                fail(err.message);
            throw err;
        }
        if (flags.output) {
            fs.writeFileSync(flags.output, output);
        }
        else {
            process.stdout.write(output);
        }
        return;
    }
    if (command === "check") {
        if (rest.length === 0)
            fail("check needs at least one template file");
        let failed = false;
        for (const templatePath of rest) {
            try {
                engine.validate(readInput(templatePath));
                process.stdout.write(`ok: ${templatePath}\n`);
            }
            catch (err) {
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
