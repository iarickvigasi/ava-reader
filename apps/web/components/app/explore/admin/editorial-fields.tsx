import { useTranslations } from "next-intl";
import { EditionFormatField } from "./edition-format-field";
import { CategoryFields } from "./category-fields";
import { LocalizedFields } from "./localized-fields";
import { TextInput } from "@/components/ui/text-input";
import { metadataFields } from "@/features/explore/admin/metadata-fields";
import type {
  EditFieldsProps,
  EditorialKind,
  MetadataRow,
} from "@/features/explore/admin/types";
import { StringListField } from "./string-list-field";
import { MetadataRows } from "./metadata-rows";
import { CreditFields } from "./credit-fields";

export function EditorialFields({
  kind,
  data,
  change,
}: EditFieldsProps & { kind: EditorialKind }) {
  const t = useTranslations("explore.editorialForm");
  return (
    <div className="space-y-6">
      {metadataFields(kind).map((field) => (
        <TextInput
          key={field.key}
          label={t(field.label)}
          type={field.type ?? "text"}
          required={field.required}
          value={String(data[field.key] ?? "")}
          onChange={(value) =>
            change(
              field.key,
              field.type === "number" ? (value ? Number(value) : null) : value,
            )
          }
        />
      ))}
      {kind === "editions" && (
        <EditionFormatField
          value={String(data.format)}
          change={(value) => change("format", value)}
        />
      )}
      {(kind === "authors"
        ? ["aliases"]
        : kind === "works"
          ? ["subjects"]
          : []
      ).map((key) => (
        <StringListField
          key={key}
          label={key}
          values={(data[key] ?? []) as string[]}
          change={(values) => change(key, values)}
        />
      ))}
      {kind === "works" && (
        <CategoryFields
          values={(data.categories ?? []) as string[]}
          change={(values) => change("categories", values)}
        />
      )}
      {kind !== "editions" && (
        <LocalizedFields
          author={kind === "authors"}
          data={data}
          change={change}
        />
      )}
      {kind !== "authors" && (
        <CreditFields
          rows={data.credits as MetadataRow[]}
          change={(rows) => change("credits", rows)}
        />
      )}
      {kind === "editions" && (
        <MetadataRows
          title={t("identifiers")}
          rows={data.identifiers as MetadataRow[]}
          columns={[
            { key: "scheme", label: t("identifierType") },
            { key: "normalizedValue", label: t("value") },
          ]}
          change={(rows) => change("identifiers", rows)}
        />
      )}
    </div>
  );
}
