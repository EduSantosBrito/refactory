import { runSync } from "./effectRuntime";
import {
  getLocalStorageItemEffect,
  getSessionStorageItemEffect,
  removeLocalStorageItemEffect,
  removeSessionStorageItemEffect,
  setLocalStorageItemEffect,
  setSessionStorageItemEffect,
} from "./browserStorage.service";

export const getLocalStorageItem = (key: string): string | null =>
  runSync(getLocalStorageItemEffect(key));

export const setLocalStorageItem = (key: string, value: string): boolean =>
  runSync(setLocalStorageItemEffect(key, value));

export const removeLocalStorageItem = (key: string): boolean =>
  runSync(removeLocalStorageItemEffect(key));

export const getSessionStorageItem = (key: string): string | null =>
  runSync(getSessionStorageItemEffect(key));

export const setSessionStorageItem = (key: string, value: string): boolean =>
  runSync(setSessionStorageItemEffect(key, value));

export const removeSessionStorageItem = (key: string): boolean =>
  runSync(removeSessionStorageItemEffect(key));
