import { env_obj } from '../../config';

export function getEnvVariable(key: string) {
    if (typeof window !== 'undefined' && window.ENV) {
      return window.ENV[key];
    } else {
      return env_obj[key];
    }
}