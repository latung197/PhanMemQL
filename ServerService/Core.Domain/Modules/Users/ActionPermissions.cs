using System.Text.Json;
using System.Text.Json.Serialization;

namespace Core.Domain.Modules.Users;

/// <summary>Actions of Frontend ActionPermissions, used to protect API endpoints.</summary>
public enum PermissionAction
{
    View,
    /// <summary>Add new records (also copy and import).</summary>
    Create,
    /// <summary>Change saved records.</summary>
    Edit,
    Delete,
    Approve,
    Print,
    /// <summary>Export data to a file (Excel...).</summary>
    Export
}

/// <summary>
/// The seven actions granted per function (Frontend/src/types/index.ts ActionPermissions). JSON written before Create /
/// Edit and Print / Export were split (createEdit, printExport: seed files, settings backups) is still read.
/// </summary>
[JsonConverter(typeof(ActionPermissionsJsonConverter))]
public sealed record ActionPermissions(bool View, bool Create, bool Edit, bool Delete, bool Approve, bool Print, bool Export)
{
    public static ActionPermissions Full { get; } = new(true, true, true, true, true, true, true);
    public static ActionPermissions None { get; } = new(false, false, false, false, false, false, false);

    public bool HasAny() => View || Create || Edit || Delete || Approve || Print || Export;

    public bool Allows(PermissionAction action) => action switch
    {
        PermissionAction.View => View,
        PermissionAction.Create => Create,
        PermissionAction.Edit => Edit,
        PermissionAction.Delete => Delete,
        PermissionAction.Approve => Approve,
        PermissionAction.Print => Print,
        PermissionAction.Export => Export,
        _ => false
    };
}

/// <summary>Writes the seven actions in camelCase; also reads the old createEdit / printExport keys.</summary>
public sealed class ActionPermissionsJsonConverter : JsonConverter<ActionPermissions>
{
    public override ActionPermissions Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.StartObject) throw new JsonException("ActionPermissions must be an object.");
        var values = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
        {
            var name = reader.GetString()!;
            reader.Read();
            if (reader.TokenType is JsonTokenType.True or JsonTokenType.False) values[name] = reader.GetBoolean();
            else reader.Skip();
        }
        bool Get(string name, string? legacy = null) =>
            values.TryGetValue(name, out var value) ? value : legacy is not null && values.GetValueOrDefault(legacy);
        return new ActionPermissions(Get("view"), Get("create", "createEdit"), Get("edit", "createEdit"), Get("delete"),
            Get("approve"), Get("print", "printExport"), Get("export", "printExport"));
    }

    public override void Write(Utf8JsonWriter writer, ActionPermissions value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteBoolean("view", value.View);
        writer.WriteBoolean("create", value.Create);
        writer.WriteBoolean("edit", value.Edit);
        writer.WriteBoolean("delete", value.Delete);
        writer.WriteBoolean("approve", value.Approve);
        writer.WriteBoolean("print", value.Print);
        writer.WriteBoolean("export", value.Export);
        writer.WriteEndObject();
    }
}
