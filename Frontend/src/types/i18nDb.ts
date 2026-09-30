/**
 * SYSTEM DATABASE LOCALIZATION & MULTI-LANGUAGE ENTITIES
 * 
 * =========================================================================================
 * C# ASP.NET CORE ENTITY FRAMEWORK DB MAPPING REFERENCE FOR YOUR BACKEND DEVELOPMENT:
 * =========================================================================================
 * 
 * [Table("SysResources")]
 * public class SysResourceEntity {
 *     [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
 *     [Required] public string CategoryCode { get; set; } = "GENERAL"; // E.g. "MENU", "CATALOG", "REPORT"
 *     [Required] public string ResourceKey { get; set; } = null!; // E.g. "inv_material_cat.title"
 *     [Required] public string CultureCode { get; set; } = "vi-VN"; // "vi-VN" | "en-US"
 *     [Required] public string ResourceValue { get; set; } = null!;
 *     public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
 * }
 * 
 * [Table("SysEntityLocalizations")]
 * public class SysEntityLocalizationEntity {
 *     [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
 *     [Required] public string EntityName { get; set; } = null!; // E.g. "SysMaterial", "SysWarehouse"
 *     [Required] public string EntityId { get; set; } = null!; // Foreign Key to Target Entity
 *     [Required] public string FieldName { get; set; } = null!; // E.g. "MaterialName", "Description"
 *     [Required] public string CultureCode { get; set; } = "en-US";
 *     [Required] public string LocalizedValue { get; set; } = null!;
 * }
 * =========================================================================================
 */

export interface SysResource {
  id: string;
  categoryCode: 'MENU' | 'CATALOG' | 'SYSTEM' | 'REPORT' | 'VALIDATION';
  resourceKey: string;
  cultureCode: 'vi' | 'en' | 'vi-VN' | 'en-US';
  resourceValue: string;
  updatedAt: string;
}

export interface SysEntityLocalization {
  id: string;
  entityName: string; // e.g., 'SysMaterial', 'SysWarehouse', 'SysCompanyUnit'
  entityId: string;
  fieldName: string; // e.g., 'name', 'description', 'unitName'
  cultureCode: 'vi' | 'en' | 'vi-VN' | 'en-US';
  localizedValue: string;
}

export interface CSharpI18nResponse {
  culture: string;
  resources: Record<string, string>;
  totalCount: number;
}
