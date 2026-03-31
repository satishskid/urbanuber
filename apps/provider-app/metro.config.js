// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Exclude heavy AI packages from Metro bundle — loaded at runtime only
config.resolver.blockList = [
  /onnxruntime-web\/dist\/ort\.bundle/,
  /@huggingface\/transformers\/node_modules\/onnxruntime-web/,
];

module.exports = withNativeWind(config, { input: "./global.css" });
