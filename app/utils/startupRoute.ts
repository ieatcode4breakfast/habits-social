export type StartupRoute = '/habits' | '/social';

export const resolveStartupRoute = (isOnline: boolean): StartupRoute => {
  return isOnline ? '/social' : '/habits';
};
