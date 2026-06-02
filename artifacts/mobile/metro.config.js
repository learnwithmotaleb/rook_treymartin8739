const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Block internal Clerk temp packages that cause resolver noise
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /@clerk\/shared_tmp_/,
];

// Speed up module resolution
config.resolver.unstable_enablePackageExports = true;

// Reduce transform concurrency noise on Replit
config.maxWorkers = 2;

module.exports = config;
