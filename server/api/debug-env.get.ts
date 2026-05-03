export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  
  const checkSecret = (val: any) => {
    if (!val) return 'MISSING';
    if (typeof val !== 'string') return `NOT_A_STRING (${typeof val})`;
    if (val === 'undefined') return 'STRING_UNDEFINED';
    if (val.length < 5) return 'TOO_SHORT';
    return `PRESENT (length: ${val.length})`;
  };

  return {
    databaseUrl: checkSecret(config.databaseUrl),
    jwtSecret: checkSecret(config.jwtSecret),
    pusherAppId: checkSecret(config.pusherAppId),
    pusherSecret: checkSecret(config.pusherSecret),
    pusherKey: checkSecret(config.public.pusherKey),
    pusherCluster: checkSecret(config.public.pusherCluster),
    nodeEnv: process.env.NODE_ENV,
    nitroPreset: process.env.NITRO_PRESET
  };
});
