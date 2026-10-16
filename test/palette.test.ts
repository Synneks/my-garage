import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const theme = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../src/app.css", import.meta.url), "utf8");
const tailwind = readFileSync(
  new URL(import.meta.resolve("tailwindcss/theme.css")),
  "utf8",
);
const declarations = (css: string): Record<string, string> =>
  Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
const root = declarations(theme.match(/:root\s*{([^}]+)}/)![1]);
const dark = declarations(theme.match(/\.dark\s*{([^}]+)}/)![1]);
const development = declarations(
  app.match(/\.sidebar-development\s*{([^}]+)}/)![1],
);
const scales = declarations(tailwind);

function luminance(token: string, tokens: Record<string, string>): number {
  let value = tokens[`--${token}`];
  while (value?.startsWith("var(")) {
    const name = value.slice(4, -1);
    value = tokens[name] ?? scales[name];
  }
  assert.ok(value, `Missing palette value: ${token}`);
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const channels = (
      hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex
    )
      .match(/../g)!
      .map((c) => parseInt(c, 16) / 255);
    return channels.reduce(
      (sum, c, i) =>
        sum +
        [0.2126, 0.7152, 0.0722][i] *
          (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
      0,
    );
  }
  const match = value.match(/^oklch\(([\d.]+)(%)? ([\d.]+) ([\d.]+)\)$/);
  assert.ok(match, `Unsupported palette color: ${value}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]),
    hue = (Number(match[4]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue),
    b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return channels.reduce(
    (sum, c, i) =>
      sum + [0.2126, 0.7152, 0.0722][i] * Math.max(0, Math.min(1, c)),
    0,
  );
}

function checkPairs(
  tokens: Record<string, string>,
  pairs: readonly (readonly string[])[],
  minimum: number,
) {
  for (const [foreground, background] of pairs) {
    const values = [
      luminance(foreground, tokens),
      luminance(background, tokens),
    ].sort((a, b) => a - b);
    const contrast = (values[1] + 0.05) / (values[0] + 0.05);
    assert.ok(
      contrast >= minimum,
      `${foreground} on ${background}: ${contrast.toFixed(2)}:1, expected ${minimum}:1`,
    );
  }
}

const textPairs = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["destructive-foreground", "destructive-hover"],
  ...["background", "card", "muted", "accent"].flatMap((surface) =>
    [
      "muted-foreground",
      "link",
      "brand",
      "warning-foreground",
      "destructive",
    ].map((text) => [text, surface]),
  ),
  ...["danger", "warning", "success", "info"].map((status) => [
    `${status}-foreground`,
    status,
  ]),
];
const sidebarText = [
  ["sidebar-foreground", "sidebar"],
  ["sidebar-muted-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-foreground", "sidebar-accent"],
  ["sidebar-primary", "sidebar-accent"],
  ["sidebar-primary-foreground", "sidebar-primary"],
];
const sidebarControls = [
  ["sidebar-border", "sidebar"],
  ["sidebar-border", "sidebar-accent"],
  ["sidebar-ring", "sidebar"],
  ["sidebar-ring", "sidebar-accent"],
];
for (const [name, tokens] of [
  ["light", root],
  ["dark", { ...root, ...dark }],
] as const) {
  test(`${name} palette text and status pairs meet WCAG AA normal-text contrast`, () =>
    checkPairs(tokens, [...textPairs, ...sidebarText], 4.5));
  test(`${name} palette control boundaries and focus rings meet 3:1 contrast`, () =>
    checkPairs(
      tokens,
      [
        ...["background", "card", "muted"].flatMap((surface) =>
          ["input", "ring"].map((indicator) => [indicator, surface]),
        ),
        ...sidebarControls,
      ],
      3,
    ));
}
test("development navigation keeps readable text and distinguishable controls", () => {
  checkPairs({ ...root, ...development }, sidebarText, 4.5);
  checkPairs({ ...root, ...development }, sidebarControls, 3);
});
