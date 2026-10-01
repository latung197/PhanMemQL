import React from 'react';

/**
 * Fills the {name} placeholders of a translated text with React nodes, so a value can keep its markup while the
 * word order stays the translator's: interpolate(t('controls.grid.selected'), { n: <strong>{count}</strong> }).
 */
export const interpolate = (text: string, values: Record<string, React.ReactNode>): React.ReactNode[] =>
  text.split(/(\{\w+\})/g).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name !== undefined && name in values ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part;
  });
