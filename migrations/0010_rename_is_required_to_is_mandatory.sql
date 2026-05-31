-- Rename is_required → is_mandatory across all relevant tables
ALTER TABLE document_types RENAME COLUMN is_required TO is_mandatory;
ALTER TABLE folder_templates RENAME COLUMN is_required TO is_mandatory;
ALTER TABLE folder_document_type_rules RENAME COLUMN is_required TO is_mandatory;
ALTER TABLE document_templates RENAME COLUMN is_required TO is_mandatory;
ALTER TABLE documents RENAME COLUMN is_required TO is_mandatory;
ALTER TABLE training_courses RENAME COLUMN is_required TO is_mandatory;
ALTER TABLE training_modules RENAME COLUMN is_required TO is_mandatory;
