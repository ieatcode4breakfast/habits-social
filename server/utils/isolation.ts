import type { H3Event } from 'h3';

export const isDummyUsername = (username?: string): boolean => {
  if (!username) return false;
  
  // Matches "asdf" followed by nothing, or a number from 1 to 150
  const match = username.toLowerCase().match(/^asdf(\d+)?$/);
  if (!match) return false;
  
  const numStr = match[1];
  if (!numStr) return true; // Just "asdf"
  
  const num = parseInt(numStr);
  return num >= 1 && num <= 150;
};

/**
 * Returns a SQL regex that matches 'asdf' or 'asdf1' through 'asdf150'
 */
export const ISOLATION_REGEX = '^asdf([1-9]|[1-9][0-9]|1[0-4][0-9]|150)?$';

