import React from 'react';
import type { GridViewColumn } from './GridView';
import { RecordStamp, RecordStampCell } from './RecordStamp';

/** "Người tạo" and "Người sửa" columns (name + time), sortable by time. */
export const recordStampColumns = <T extends { stamp: RecordStamp }>(t: (key: string) => string): GridViewColumn<T>[] => [
  {
    key: 'createdAt', header: t('recordStamp.created'), width: '150px', sortable: true, accessor: x => x.stamp.createdAt,
    render: x => <RecordStampCell name={x.stamp.createdBy} time={x.stamp.createdAt} />
  },
  {
    key: 'updatedAt', header: t('recordStamp.updated'), width: '150px', sortable: true, accessor: x => x.stamp.updatedAt ?? '',
    render: x => <RecordStampCell name={x.stamp.updatedBy} time={x.stamp.updatedAt} />
  }
];
