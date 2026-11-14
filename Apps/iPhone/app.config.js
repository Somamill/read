// Native releases bundle their code and use Xcode signing; no hosted updates.
module.exports = ({ config }) => {
  if (process.env.DOT_EDITION !== 'store') return config;
  return {
    ...config,
    plugins: [...(config.plugins || []).map(plugin => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      if (name === 'expo-audio') return [name, { microphonePermission: false, recordAudioAndroid: false, enableBackgroundRecording: false, enableBackgroundPlayback: true }];
      if (name === 'expo-secure-store') return [name, { faceIDPermission: false }];
      return plugin;
    }), ['./plugins/with-store-signing', { profileName: 'dot read IOS_APP_STORE' }], ...(process.env.DOT_PLATFORM === 'macos' ? ['./plugins/with-mac-catalyst'] : [])],
    updates: { ...config.updates, enabled: false },
    ios: {
      ...config.ios,
      appleTeamId: 'YJH8WWUVF3',
      buildNumber: process.env.DOT_BUILD_NUMBER || config.ios?.buildNumber || '1',
      privacyManifests: {
        ...config.ios?.privacyManifests,
        NSPrivacyTracking: false,
        // Optional sync providers retain these records under the user's account.
        NSPrivacyCollectedDataTypes: ['NSPrivacyCollectedDataTypeOtherUserContent', 'NSPrivacyCollectedDataTypeProductInteraction', 'NSPrivacyCollectedDataTypeUserID'].map(type => ({
          NSPrivacyCollectedDataType: type,
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        })),
      },
      config: { ...config.ios?.config, usesNonExemptEncryption: false },
      infoPlist: {
        ...config.ios?.infoPlist,
        NSLocalNetworkUsageDescription: 'Connect to the library server you choose on your local network.',
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    extra: { ...config.extra, edition: 'store' },
  };
};
