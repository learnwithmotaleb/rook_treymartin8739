/**
 * Expo config plugin — enables module maps for CocoaPods dependencies.
 *
 * Clerk's iOS App Check integration includes Swift pods that depend on
 * GoogleUtilities and RecaptchaInterop. CocoaPods requires modular headers
 * to integrate that dependency chain as static libraries during EAS builds.
 */

const { withPodfile } = require("expo/config-plugins");

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withModularHeaders = (config) =>
  withPodfile(config, (config) => {
    const directive = "use_modular_headers!";
    const { contents } = config.modResults;

    if (contents.includes(directive)) {
      return config;
    }

    const platformDeclaration = contents.match(/^platform :ios,.*$/m);
    if (!platformDeclaration) {
      throw new Error(
        "Unable to enable modular headers: generated Podfile has no iOS platform declaration."
      );
    }

    config.modResults.contents = contents.replace(
      platformDeclaration[0],
      `${platformDeclaration[0]}\n\n${directive}`
    );

    return config;
  });

module.exports = withModularHeaders;