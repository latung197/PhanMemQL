// Declaration of one catalog screen (danh mục) for CatalogScreen: the screen only says what is specific to it
// (columns, form, Excel columns, extra filters); loading, search, filters, Excel import / export, bulk delete,
// permissions and messages are the same for every catalog. See docs/phat-trien/them-danh-muc.md.
import type React from 'react';
import type { GridViewColumn } from '../common/GridView';
import type { CatalogApi } from '../../hooks/useCatalog';
import type { PagedQuery } from '../../services/paging';
import type { SubMenuKey } from '../../types';

/** One column of the Excel file (export, import, template). Values are read into the save input's field `key`. */
export interface ExcelColumn<TInput> {
  key: keyof TInput & string;
  /** Column title in the file; import also accepts the key itself. */
  header: string;
  required?: boolean;
  type?: 'text' | 'number' | 'boolean';
  /** Character width of the column in exported files. */
  width?: number;
  /** Example value written in the template file. */
  example?: string | number | boolean;
}

/**
 * Extra filter of a catalog (the status filter is built in for records with isActive). For a server-paged catalog the
 * `key` is the query parameter sent to the list endpoint and `match` is not used.
 */
export interface CatalogFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Only for a catalog still loaded as a whole list (getAll); a server-paged catalog filters on the server. */
  match?: (item: T, value: string) => boolean;
}

export interface ImportRowError { row: number; message: string }
export interface ImportResult { created: number; updated: number; errors: ImportRowError[] }
export interface DeleteManyResult { deleted: number; errors: ImportRowError[] }
export type ImportMode = 'create' | 'upsert';

/** What a rename or merge of a code would touch: rows of which tables hold the code. */
export interface CodeChangePreview {
  code: string;
  name?: string | null;
  intoCode?: string | null;
  intoName?: string | null;
  usages: { table: string; tableName: string; count: number }[];
  total: number;
}

/** The shared endpoints of đổi mã / gộp mã (only the catalogs that allow it answer; the others refuse). */
export interface CodeChangeApi {
  preview: (key: string, into?: string) => Promise<CodeChangePreview>;
  rename: (key: string, newCode: string, version?: number) => Promise<unknown>;
  merge: (key: string, into: string) => Promise<unknown>;
}

/** Backend endpoints of a catalog: CRUD plus the optional shared batch endpoints (CatalogBatch). */
export interface CatalogScreenApi<T, TInput> extends CatalogApi<T, TInput> {
  /** Excel file of everything the list's filters match, made by the server (export right + change log). Takes the query without the page. */
  exportAll?: (query: PagedQuery) => Promise<void>;
  importMany?: (rows: TInput[], mode: ImportMode) => Promise<ImportResult>;
  removeMany?: (keys: string[]) => Promise<DeleteManyResult>;
  /** Đổi mã / gộp mã (the screen shows the buttons only when its definition has codeChange and the user holds CHANGE_CODE). */
  codeChange?: CodeChangeApi;
}

export interface CatalogFormProps<T, TInput> {
  form: TInput;
  setForm: (next: TInput) => void;
  /** The record being edited; undefined for a new one. */
  editing?: T;
}

export interface CatalogDefinition<T, TInput> {
  /** Function code: permissions (view / create / edit / delete / export) come from it. */
  functionCode: SubMenuKey;
  api: CatalogScreenApi<T, TInput>;
  /** Key in the URLs (code or id). */
  keyOf: (item: T) => string;
  /** Text naming one record in messages, e.g. `${x.code} - ${x.name}`. */
  describe: (item: T) => string;
  icon: React.ReactNode;
  texts: {
    title: string;
    subtitle?: string;
    /** Short name for messages: "đơn vị tính". */
    noun: string;
    add: string;
    searchPlaceholder?: string;
    addTitle: string;
    editTitle: (item: T) => string;
    /** Base name of exported files, without extension. */
    fileName: string;
  };
  columns: GridViewColumn<T>[];
  /** Text searched by the search box; by default every text / number field of the record. */
  searchText?: (item: T) => string;
  filters?: CatalogFilter<T>[];
  excel: {
    columns: ExcelColumn<TInput>[];
    /** Record → row of the exported file (same shape as the import rows). */
    toRow: (item: T) => TInput;
  };
  emptyInput: TInput;
  toInput: (item: T) => TInput;
  /** Applied before saving or importing (trim, upper-case codes...). */
  normalize?: (input: TInput) => TInput;
  renderForm: (props: CatalogFormProps<T, TInput>) => React.ReactNode;
  /** Allows renaming and merging codes of this catalog (backend CatalogSpec.CodeChange): the lookup name to pick the merge target. */
  codeChange?: { lookup: string };
  /** Modal width of the form. */
  formWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}
