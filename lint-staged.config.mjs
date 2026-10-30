const quotePath = (file) => `"${file.replace(/"/g, '\\"')}"`;

export default {
  "(apps|packages)/**/*.{js,ts,jsx,tsx}": (files) =>
    `biome lint --reporter summary --config-path=biome-staged.json ${files.map(quotePath).join(" ")}`,
};
