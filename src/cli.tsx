#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import meow from "meow";
import { loadConfig } from "./lib/config.js";
import { App } from "./app.js";
import { ensureSetup } from "./setup.js";

const cli = meow(
  `
  Usage
    $ claude-overview              Start the dashboard

  Options
    --config, -c  Path to config file

  Keybindings
    j/k or arrows  Navigate sessions
    Enter           Attach to session (opens Terminal.app)
    n               New session (pick worktree)
    p               Open plan file
    d               Delete/kill session
    r               Refresh
    q               Quit
`,
  {
    importMeta: import.meta,
    flags: {
      config: { type: "string", shortFlag: "c" },
    },
  },
);

ensureSetup();
const config = loadConfig(cli.flags.config);
console.clear();
render(<App config={config} />);
