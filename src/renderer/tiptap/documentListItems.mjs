import { ListItem } from '@tiptap/extension-list';

// A Word paragraph may own both outline and numbering semantics. Keep its
// heading node inside the existing list item, with the OSS editing commands.
export const DocumentListItems = ListItem.extend({
  content: '(paragraph | heading) block*',
});
