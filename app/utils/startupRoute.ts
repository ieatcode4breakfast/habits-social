export type StartupRoute = '/habits';

export const resolveStartupRoute = (_isOnline: boolean): StartupRoute => {
  return '/habits';
};
