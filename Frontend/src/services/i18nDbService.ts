import { INITIAL_SYS_RESOURCES, INITIAL_ENTITY_LOCALIZATIONS } from '../mock/initialI18nData';
import { SysResource, SysEntityLocalization, CSharpI18nResponse } from '../types/i18nDb';

const STORAGE_KEY_SYS_RESOURCES = 'serp_sys_resources';
const STORAGE_KEY_ENTITY_LOCALIZATIONS = 'serp_entity_localizations';

export const i18nDbService = {
  /**
   * Fetch all database resource translation keys stored in `SysResources` table
   */
  getSysResources(): SysResource[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SYS_RESOURCES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load sys_resources from storage:', e);
    }
    localStorage.setItem(STORAGE_KEY_SYS_RESOURCES, JSON.stringify(INITIAL_SYS_RESOURCES));
    return INITIAL_SYS_RESOURCES;
  },

  /**
   * Get dynamic resource dictionary payload matching C# Web API response:
   * GET /api/v1/i18n/resources?culture=en-US
   */
  getDictionaryByCulture(culture: 'vi' | 'en' | 'vi-VN' | 'en-US'): CSharpI18nResponse {
    const allResources = this.getSysResources();
    const isEn = culture === 'en' || culture === 'en-US';
    const targetCulture = isEn ? 'en' : 'vi';

    const dict: Record<string, string> = {};
    allResources
      .filter(r => r.cultureCode === targetCulture || r.cultureCode.startsWith(targetCulture))
      .forEach(r => {
        dict[r.resourceKey] = r.resourceValue;
      });

    return {
      culture: targetCulture === 'en' ? 'en-US' : 'vi-VN',
      resources: dict,
      totalCount: Object.keys(dict).length
    };
  },

  /**
   * Add or Update a Database Translation Resource Key in `SysResources` table
   */
  saveResource(resource: SysResource): SysResource[] {
    const list = this.getSysResources();
    const index = list.findIndex(r => r.id === resource.id);
    if (index >= 0) {
      list[index] = { ...resource, updatedAt: new Date().toISOString().split('T')[0] };
    } else {
      list.push({ ...resource, updatedAt: new Date().toISOString().split('T')[0] });
    }
    localStorage.setItem(STORAGE_KEY_SYS_RESOURCES, JSON.stringify(list));
    return list;
  },

  /**
   * Delete a DB translation key
   */
  deleteResource(id: string): SysResource[] {
    const list = this.getSysResources().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY_SYS_RESOURCES, JSON.stringify(list));
    return list;
  },

  /**
   * Reset DB localization table back to default seed
   */
  resetToDefaultSeed(): SysResource[] {
    localStorage.setItem(STORAGE_KEY_SYS_RESOURCES, JSON.stringify(INITIAL_SYS_RESOURCES));
    localStorage.setItem(STORAGE_KEY_ENTITY_LOCALIZATIONS, JSON.stringify(INITIAL_ENTITY_LOCALIZATIONS));
    return INITIAL_SYS_RESOURCES;
  },

  /**
   * Fetch Entity-level field localization override (e.g., Material name in English)
   */
  getEntityLocalizations(): SysEntityLocalization[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENTITY_LOCALIZATIONS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load entity_localizations:', e);
    }
    localStorage.setItem(STORAGE_KEY_ENTITY_LOCALIZATIONS, JSON.stringify(INITIAL_ENTITY_LOCALIZATIONS));
    return INITIAL_ENTITY_LOCALIZATIONS;
  },

  /**
   * C# EF Core Code Generator & SQL Scripts for backend C# developer integration
   */
  getCSharpBackendCode(): {
    csharpEntities: string;
    csharpController: string;
    sqlScript: string;
  } {
    const csharpEntities = `
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ERP.Core.Entities
{
    [Table("SysResources")]
    public class SysResourceEntity
    {
        [Key]
        [MaxLength(50)]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(50)]
        public string CategoryCode { get; set; } = "GENERAL";

        [Required]
        [MaxLength(200)]
        public string ResourceKey { get; set; } = null!;

        [Required]
        [MaxLength(10)]
        public string CultureCode { get; set; } = "vi-VN"; // "vi-VN" or "en-US"

        [Required]
        public string ResourceValue { get; set; } = null!;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    [Table("SysEntityLocalizations")]
    public class SysEntityLocalizationEntity
    {
        [Key]
        [MaxLength(50)]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(100)]
        public string EntityName { get; set; } = null!; // E.g. "SysMaterial"

        [Required]
        [MaxLength(50)]
        public string EntityId { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string FieldName { get; set; } = null!; // E.g. "MaterialName"

        [Required]
        [MaxLength(10)]
        public string CultureCode { get; set; } = "en-US";

        [Required]
        public string LocalizedValue { get; set; } = null!;
    }
}`;

    const csharpController = `
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ERP.Infrastructure.Data;
using ERP.Core.Entities;

namespace ERP.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class I18nController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public I18nController(ApplicationDbContext db)
        {
            _db = db;
        }

        // GET: /api/v1/i18n/resources?culture=en-US
        [HttpGet("resources")]
        public async Task<IActionResult> GetResources([FromQuery] string culture = "vi-VN")
        {
            var culturePrefix = culture.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "vi";

            var resources = await _db.Set<SysResourceEntity>()
                .Where(r => r.CultureCode.StartsWith(culturePrefix))
                .ToDictionaryAsync(r => r.ResourceKey, r => r.ResourceValue);

            return Ok(new
            {
                Culture = culture,
                Resources = resources,
                TotalCount = resources.Count
            });
        }

        // POST: /api/v1/i18n/resources
        [HttpPost("resources")]
        public async Task<IActionResult> UpsertResource([FromBody] SysResourceEntity model)
        {
            var existing = await _db.Set<SysResourceEntity>()
                .FirstOrDefaultAsync(r => r.ResourceKey == model.ResourceKey && r.CultureCode == model.CultureCode);

            if (existing != null)
            {
                existing.ResourceValue = model.ResourceValue;
                existing.CategoryCode = model.CategoryCode;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                if (string.IsNullOrEmpty(model.Id)) model.Id = Guid.NewGuid().ToString();
                model.UpdatedAt = DateTime.UtcNow;
                await _db.Set<SysResourceEntity>().AddAsync(model);
            }

            await _db.SaveChangesAsync();
            return Ok(model);
        }
    }
}`;

    const sqlScript = `
-- SQL SERVER / POSTGRESQL DDL CREATION SCRIPT FOR DYNAMIC I18N SYSTEM
CREATE TABLE SysResources (
    Id NVARCHAR(50) PRIMARY KEY,
    CategoryCode NVARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    ResourceKey NVARCHAR(200) NOT NULL,
    CultureCode NVARCHAR(10) NOT NULL DEFAULT 'vi-VN',
    ResourceValue NVARCHAR(MAX) NOT NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_SysResources_KeyCulture ON SysResources(ResourceKey, CultureCode);

CREATE TABLE SysEntityLocalizations (
    Id NVARCHAR(50) PRIMARY KEY,
    EntityName NVARCHAR(100) NOT NULL,
    EntityId NVARCHAR(50) NOT NULL,
    FieldName NVARCHAR(100) NOT NULL,
    CultureCode NVARCHAR(10) NOT NULL DEFAULT 'en-US',
    LocalizedValue NVARCHAR(MAX) NOT NULL
);

CREATE INDEX IX_SysEntityLocalizations_Entity ON SysEntityLocalizations(EntityName, EntityId, FieldName, CultureCode);
`;

    return {
      csharpEntities,
      csharpController,
      sqlScript
    };
  }
};
