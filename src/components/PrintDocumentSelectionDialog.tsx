import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export interface PrintDocumentOption {
  id: string;
  name: string;
  totalPages: number;
}

interface PrintDocumentSelectionDialogProps {
  open: boolean;
  documents: PrintDocumentOption[];
  selectedDocumentIds: Set<string>;
  onOpenChange: (open: boolean) => void;
  onSelectionChange: (documentId: string, selected: boolean) => void;
  onPrintAll: () => void;
  onPrintSelected: () => void;
}

export function PrintDocumentSelectionDialog({
  open,
  documents,
  selectedDocumentIds,
  onOpenChange,
  onSelectionChange,
  onPrintAll,
  onPrintSelected,
}: PrintDocumentSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg bg-card border-border rounded-xl font-sans">
        <DialogHeader>
          <DialogTitle>Choose documents to print</DialogTitle>
          <DialogDescription>
            All documents are selected by default. Unselect any document you want to skip.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {documents.map((document) => (
            <label
              key={document.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
            >
              <Checkbox
                checked={selectedDocumentIds.has(document.id)}
                onCheckedChange={(checked) => onSelectionChange(document.id, checked === true)}
              />
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{document.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {document.totalPages} page{document.totalPages === 1 ? '' : 's'}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onPrintSelected} disabled={selectedDocumentIds.size === 0}>
            Select Print
          </Button>
          <Button onClick={onPrintAll}>Print All</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
