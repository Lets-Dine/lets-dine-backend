const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";

interface StartupBannerOptions {
  name: string;
  port: number;
  docsPath: string;
  apiPrefix: string;
}

function stripAnsi(input: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes is the point
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

export function printStartupBanner({ name, port, docsPath, apiPrefix }: StartupBannerOptions): void {
  const baseUrl = `http://localhost:${port}`;
  const lines = [
    `${BOLD}${name}${RESET}`,
    "",
    `${DIM}Local:${RESET}  ${CYAN}${baseUrl}/${apiPrefix}${RESET}`,
    `${DIM}Docs:${RESET}   ${CYAN}${baseUrl}${docsPath}${RESET}`,
  ];

  const width = Math.max(...lines.map(line => stripAnsi(line).length)) + 4;
  const horizontal = "═".repeat(width);

  const rendered = lines.map(line => {
    const padding = " ".repeat(width - stripAnsi(line).length - 2);
    return `${GREEN}║${RESET} ${line}${padding} ${GREEN}║${RESET}`;
  });

  // biome-ignore lint/suspicious/noConsole: printing the boot banner is this function's entire job
  console.log(["", `${GREEN}╔${horizontal}╗${RESET}`, ...rendered, `${GREEN}╚${horizontal}╝${RESET}`, ""].join("\n"));
}
