import type { LibraryBookInfo } from "@/lib/api-types";
import { useCollectionPicker } from "@/features/library/collection-picker/use-collection-picker";
import { CollectionPickerDialog } from "./collection-picker-dialog";

export function CollectionPickerModal(props: {
  libraryItemId: string;
  memberships: LibraryBookInfo["collections"];
  onClose: () => void;
}) {
  const picker = useCollectionPicker(props);
  return <CollectionPickerDialog picker={picker} />;
}
