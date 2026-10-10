import { startServer as launch } from '../../server/index.js';

export * from '../../server/index.js';
export const startServer = (options) => launch({ ...options, accountsFile: false });
