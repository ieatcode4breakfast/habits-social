export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const cf = event.context.cloudflare;
  
  const checkSecret = (key: string) => {
    const val = (config as any)[key] 
             || (process as any)?.env?.[key] 
             || (process as any)?.env?.[`NUXT_${key}`]
             || cf?.env?.[key];

    if (!val) return 'MISSING';
    if (typeof val !== 'string') return `NOT_A_STRING (${typeof val})`;
    if (val === 'undefined') return 'STRING_UNDEFINED';
    if (val.length < 5) return 'TOO_SHORT';
    return `PRESENT (length: ${val.length})`;
  };

  return {
    databaseUrl: checkSecret('databaseUrl'),
    jwtSecret: checkSecret('jwtSecret'),
    pusherAppId: checkSecret('pusherAppId'),
    pusherSecret: checkSecret('pusherSecret'),
    pusherKey: checkSecret('pusherKey'),
    pusherCluster: checkSecret('pusherCluster'),
    nodeEnv: process.env.NODE_ENV,
    nitroPreset: process.env.NITRO_PRESET,
    hasCloudflareContext: !!cf,
    cfEnvKeys: cf?.env ? Object.keys(cf.env) : []
  };
});
