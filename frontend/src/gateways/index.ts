import { backendAuthGateway } from './backendAuthGateway';
import { backendGameGateway } from './backendGameGateway';
import { DATA_MODE } from './indexRuntime';
import { mockAuthGateway } from './mockAuthGateway';
import { mockGameGateway } from './mockGameGateway';
import type { AuthGateway, GameGateway } from './types';

function getAuthGateway(): AuthGateway {
  if (DATA_MODE === 'backend') {
    return backendAuthGateway;
  }
  return mockAuthGateway;
}

function getGameGateway(): GameGateway {
  if (DATA_MODE === 'backend') {
    return backendGameGateway;
  }
  return mockGameGateway;
}

export const authGateway = getAuthGateway();
export const gameGateway = getGameGateway();
export { DATA_MODE };
