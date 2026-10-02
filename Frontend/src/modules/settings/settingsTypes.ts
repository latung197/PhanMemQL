/** Props of every Settings screen: what the signed-in user may do on the screen's function. */
export interface SettingsViewProps {
  /** Thêm mới. */
  canCreate: boolean;
  /** Sửa bản ghi đã lưu (cả lưu các trang cấu hình). */
  canEdit: boolean;
  canDelete: boolean;
}
