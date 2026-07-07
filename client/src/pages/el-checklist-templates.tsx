import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ListChecks, Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import type { CaseChecklistTemplate, CaseChecklistTemplateItem } from "@shared/schema";

export default function ElChecklistTemplatesPage() {
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery<CaseChecklistTemplate[]>({
    queryKey: ["/api/case-checklist-templates"],
  });

  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; editing: CaseChecklistTemplate | null }>({ open: false, editing: null });
  const [templateForm, setTemplateForm] = useState({ name: "", notes: "" });
  const [deleteTemplate, setDeleteTemplate] = useState<CaseChecklistTemplate | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const [itemDialog, setItemDialog] = useState<{ open: boolean; templateId: string; editing: CaseChecklistTemplateItem | null }>({ open: false, templateId: "", editing: null });
  const [itemForm, setItemForm] = useState({ title: "", description: "" });
  const [deleteItem, setDeleteItem] = useState<CaseChecklistTemplateItem | null>(null);

  const createTemplate = useMutation({
    mutationFn: (data: { name: string; notes: string }) => apiRequest("POST", "/api/case-checklist-templates", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates"] }); setTemplateDialog({ open: false, editing: null }); toast({ title: "Template created" }); },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; notes: string } }) => apiRequest("PATCH", `/api/case-checklist-templates/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates"] }); setTemplateDialog({ open: false, editing: null }); toast({ title: "Template updated" }); },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/case-checklist-templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates"] }); setDeleteTemplate(null); toast({ title: "Template deleted" }); },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const createItem = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: { title: string; description: string } }) =>
      apiRequest("POST", `/api/case-checklist-templates/${templateId}/items`, data),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates", templateId, "items"] });
      setItemDialog({ open: false, templateId: "", editing: null });
      toast({ title: "Item added" });
    },
    onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, templateId, data }: { id: string; templateId: string; data: { title: string; description: string } }) =>
      apiRequest("PATCH", `/api/case-checklist-template-items/${id}`, data),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates", templateId, "items"] });
      setItemDialog({ open: false, templateId: "", editing: null });
      toast({ title: "Item updated" });
    },
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ id, templateId }: { id: string; templateId: string }) => apiRequest("DELETE", `/api/case-checklist-template-items/${id}`),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates", templateId, "items"] });
      setDeleteItem(null);
      toast({ title: "Item removed" });
    },
    onError: () => toast({ title: "Failed to remove item", variant: "destructive" }),
  });

  function openCreateTemplate() {
    setTemplateForm({ name: "", notes: "" });
    setTemplateDialog({ open: true, editing: null });
  }

  function openEditTemplate(t: CaseChecklistTemplate) {
    setTemplateForm({ name: t.name, notes: t.notes ?? "" });
    setTemplateDialog({ open: true, editing: t });
  }

  function handleTemplateSubmit() {
    if (!templateForm.name.trim()) return;
    if (templateDialog.editing) {
      updateTemplate.mutate({ id: templateDialog.editing.id, data: templateForm });
    } else {
      createTemplate.mutate(templateForm);
    }
  }

  function openAddItem(templateId: string) {
    setItemForm({ title: "", description: "" });
    setItemDialog({ open: true, templateId, editing: null });
  }

  function openEditItem(item: CaseChecklistTemplateItem) {
    setItemForm({ title: item.title, description: item.description ?? "" });
    setItemDialog({ open: true, templateId: item.templateId, editing: item });
  }

  function handleItemSubmit() {
    if (!itemForm.title.trim()) return;
    if (itemDialog.editing) {
      updateItem.mutate({ id: itemDialog.editing.id, templateId: itemDialog.templateId, data: itemForm });
    } else {
      createItem.mutate({ templateId: itemDialog.templateId, data: itemForm });
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-pink-600" />
            Essential Documents Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Create reusable document lists that can be loaded into any case.
          </p>
        </div>
        <Button onClick={openCreateTemplate} className="bg-pink-600 hover:bg-pink-700" data-testid="button-create-template">
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      )}

      {!isLoading && templates.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a template to quickly populate Essential Documents on a case.</p>
            <Button onClick={openCreateTemplate} className="mt-4 bg-pink-600 hover:bg-pink-700">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {templates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            expanded={expandedTemplate === template.id}
            onToggle={() => setExpandedTemplate(prev => prev === template.id ? null : template.id)}
            onEdit={() => openEditTemplate(template)}
            onDelete={() => setDeleteTemplate(template)}
            onAddItem={() => openAddItem(template.id)}
            onEditItem={openEditItem}
            onDeleteItem={(item) => setDeleteItem(item)}
          />
        ))}
      </div>

      {/* Template create/edit dialog */}
      <Dialog open={templateDialog.open} onOpenChange={(open) => setTemplateDialog(prev => ({ ...prev, open }))}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{templateDialog.editing ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>Give this template a name and optional notes to describe when it should be used.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name <span className="text-destructive">*</span></label>
              <Input
                value={templateForm.name}
                onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Tribunal Claim — Standard"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={templateForm.notes}
                onChange={e => setTemplateForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="When to use this template, what it covers…"
                rows={3}
                data-testid="input-template-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog({ open: false, editing: null })}>Cancel</Button>
            <Button
              onClick={handleTemplateSubmit}
              disabled={!templateForm.name.trim() || createTemplate.isPending || updateTemplate.isPending}
              className="bg-pink-600 hover:bg-pink-700"
              data-testid="button-save-template"
            >
              {templateDialog.editing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item create/edit dialog */}
      <Dialog open={itemDialog.open} onOpenChange={(open) => setItemDialog(prev => ({ ...prev, open }))}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{itemDialog.editing ? "Edit Document Item" : "Add Document Item"}</DialogTitle>
            <DialogDescription>Each item represents a document that will appear in Essential Documents when this template is loaded.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Title <span className="text-destructive">*</span></label>
              <Input
                value={itemForm.title}
                onChange={e => setItemForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. ET1 Claim Form"
                data-testid="input-item-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Input
                value={itemForm.description}
                onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this document"
                data-testid="input-item-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ open: false, templateId: "", editing: null })}>Cancel</Button>
            <Button
              onClick={handleItemSubmit}
              disabled={!itemForm.title.trim() || createItem.isPending || updateItem.isPending}
              className="bg-pink-600 hover:bg-pink-700"
              data-testid="button-save-item"
            >
              {itemDialog.editing ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete template confirm */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTemplate?.name}</strong> and all its document items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTemplate && deleteTemplateMutation.mutate(deleteTemplate.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete item confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteItem?.title}</strong> from this template?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteItem && deleteItemMutation.mutate({ id: deleteItem.id, templateId: deleteItem.templateId })}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateCard({
  template, expanded, onToggle, onEdit, onDelete, onAddItem, onEditItem, onDeleteItem,
}: {
  template: CaseChecklistTemplate;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: CaseChecklistTemplateItem) => void;
  onDeleteItem: (item: CaseChecklistTemplateItem) => void;
}) {
  const { data: items = [] } = useQuery<CaseChecklistTemplateItem[]>({
    queryKey: ["/api/case-checklist-templates", template.id, "items"],
    queryFn: () => fetch(`/api/case-checklist-templates/${template.id}/items`, { credentials: "include" }).then(r => r.json()),
    enabled: expanded,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <button className="flex-1 text-left" onClick={onToggle} data-testid={`button-expand-template-${template.id}`}>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{template.name}</CardTitle>
              <Badge variant="outline" className="text-xs">{expanded ? "—" : `${items.length || "?"} items`}</Badge>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            {template.notes && (
              <CardDescription className="mt-1 text-sm">{template.notes}</CardDescription>
            )}
          </button>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-template-${template.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive" data-testid={`button-delete-template-${template.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 border-t">
          <div className="space-y-2 mt-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No items yet — add documents below.</p>
            )}
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-md border bg-muted/30">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditItem(item)} data-testid={`button-edit-item-${item.id}`}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDeleteItem(item)} data-testid={`button-delete-item-${item.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={onAddItem} data-testid={`button-add-item-${template.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Document Item
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
