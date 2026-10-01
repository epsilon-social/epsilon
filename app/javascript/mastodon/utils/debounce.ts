import { debounce } from 'lodash';

import type { AppDispatch } from 'mastodon/store';

export const debounceWithDispatchAndArguments = <T>(
  fn: (dispatch: AppDispatch, ...args: T[]) => void,
  // ==========================================
  // EPSILON : IN-POST FOLLOW BUTTON — forward lodash's maxWait so a steady
  // call stream (busy live feed mounting statuses) cannot postpone the
  // trailing flush forever.
  // ==========================================
  { delay = 100, maxWait }: { delay?: number; maxWait?: number },
) => {
  let argumentBuffer: T[] = [];
  let dispatchBuffer: AppDispatch;

  const wrapped = debounce(
    () => {
      const tmpBuffer = argumentBuffer;
      argumentBuffer = [];
      fn(dispatchBuffer, ...tmpBuffer);
    },
    delay,
    maxWait === undefined ? undefined : { maxWait },
  );
  // ==========================================

  return (dispatch: AppDispatch, ...args: T[]) => {
    dispatchBuffer = dispatch;
    argumentBuffer.push(...args);
    wrapped();
  };
};
