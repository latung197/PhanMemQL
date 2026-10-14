import React from 'react';

/**
 * One fixed-width place of the "Thao tác" column of a voucher list: the buttons of the same function sit in the same place on every
 * row (an empty slot keeps its width), so the column lines up whatever the status of the row. Slots, left to right: edit, the step
 * forward (send for approval / approve / post / unpost: only one of them applies to a status), the step aside (withdraw / cancel),
 * print, delete.
 */
export const RowActionSlot: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">{children}</span>
);
