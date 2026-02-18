import { execFile, type ExecFileException } from "node:child_process";

export function execFileAsync(
  cmd: string,
  args: string[],
  opts: { cwd: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { encoding: "utf-8", cwd: opts.cwd },
      (err: ExecFileException | null, stdout: string) => {
        if (err) {
          reject(new Error(err.message));
        } else {
          resolve(stdout);
        }
      },
    );
  });
}
