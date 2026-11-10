// {{tenVi}} ({{ma}}), backend /api/{{phanHe}}/{{kebab}}. The list is paged on the server.
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface {{Ten}}Record {
  code: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface Save{{Ten}}Input {
  code: string;
  name: string;
  note: string;
  isActive: boolean;
  version?: number;
}

export const {{tens}}Api = createCatalogApi<{{Ten}}Record, Save{{Ten}}Input>({
  url: '/api/{{phanHe}}/{{kebab}}', fileName: '{{tenFile}}'
});
