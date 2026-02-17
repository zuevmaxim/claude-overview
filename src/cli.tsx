#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import meow from "meow";
import { loadConfig } from "./lib/config.js";
import { App } from "./app.js";
import { runSetup } from "./setup.js";

const cli = meow(
  `
  Usage
    $ claude-overview              Start the dashboard
    $ claude-overview setup        Install Claude Code hooks

  Options
    --config, -c  Path to config file

  Keybindings
    j/k or arrows  Navigate sessions
    Enter           Attach to session (opens Terminal.app)
    n               New session (pick worktree)
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

const command = cli.input[0];

if (command === "setup") {
  runSetup();
} else {
  const config = loadConfig(cli.flags.config);
  render(<App config={config} />);
}
