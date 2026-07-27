const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Block internal Clerk temp packages that cause resolver noise
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /@clerk\/shared_tmp_/,
  /react-native-purchases-ui_tmp_/,
];

module.exports = config;
