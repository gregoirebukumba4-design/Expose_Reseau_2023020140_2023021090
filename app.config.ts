import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config: baseConfig }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const easProjectId = process.env.EAS_PROJECT_ID;

  return {
    ...baseConfig,
    name: baseConfig.name ?? 'Expose_Reseau_2023020140_2023021090',
    slug: baseConfig.slug ?? 'expose-reseau-2023020140-2023021090',
    android: {
      ...baseConfig.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...baseConfig.android?.config,
              googleMaps: { apiKey: googleMapsApiKey },
            },
          }
        : {}),
    },
    extra: {
      ...baseConfig.extra,
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};
