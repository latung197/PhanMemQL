/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the ERP backend (ServerService), e.g. http://localhost:2512 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
