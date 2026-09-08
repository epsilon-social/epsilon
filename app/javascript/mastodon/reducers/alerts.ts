import { createReducer } from '@reduxjs/toolkit';

import { showAlert, dismissAlert, clearAlerts } from 'mastodon/actions/alerts';
import type { Alert, TranslatableString } from 'mastodon/models/alert';

const initialState: Alert[] = [];

let id = 0;

// ==========================================
// EPSILON : OFFLINE UPLOAD ALERT
// Identity of an alert's copy, so identical alerts can be deduplicated.
// A batch upload losing the network dispatches one failure per in-flight
// media, which would otherwise stack N identical banners.
// ==========================================
const translatableId = (value: TranslatableString | undefined): string =>
  typeof value === 'object' ? (value.id ?? '') : (value ?? '');

const alertContentKey = (alert: Pick<Alert, 'title' | 'message'>): string =>
  `${translatableId(alert.title)}|${translatableId(alert.message)}`;
// ==========================================

export const alertsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(showAlert, (state, { payload }) => {
      // ==========================================
      // EPSILON : OFFLINE UPLOAD ALERT
      // Skip a new alert if one with identical copy is already showing.
      // ==========================================
      if (
        state.some(
          (alert) => alertContentKey(alert) === alertContentKey(payload),
        )
      ) {
        return;
      }
      // ==========================================
      state.push({
        key: id++,
        ...payload,
      });
    })
    .addCase(dismissAlert, (state, { payload: { key } }) => {
      return state.filter((item) => item.key !== key);
    })
    .addCase(clearAlerts, () => {
      return [];
    });
});
